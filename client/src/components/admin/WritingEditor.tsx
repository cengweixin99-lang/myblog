import { useEffect, useRef } from 'react';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { CrepeBuilder } from '@milkdown/crepe/builder';
import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { imageBlock } from '@milkdown/crepe/feature/image-block';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { editorViewOptionsCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

type WritingEditorProps = {
  defaultValue: string;
  onChange: (markdown: string) => void;
  onUpload: (file: File) => Promise<string>;
};

const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, figure';

function isPrintableKey(event: KeyboardEvent) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function preventInvalidHeadingShortcut(view: { state: any; dispatch: (tr: any) => void }, event: KeyboardEvent) {
  if (event.key !== ' ' || !view.state.selection.empty) return false;

  const { $from } = view.state.selection;
  const parent = $from.parent;
  if (parent.type.name !== 'paragraph') return false;

  const textBeforeCursor = parent.textContent.slice(0, $from.parentOffset);
  if (!/^#{7,}$/.test(textBeforeCursor)) return false;

  event.preventDefault();
  view.dispatch(view.state.tr.insertText(' '));
  return true;
}

function collapseEmptyHeading(view: { state: any; dispatch: (tr: any) => void }, event: KeyboardEvent) {
  if (event.key !== 'Backspace' || !view.state.selection.empty) return false;

  const { $from } = view.state.selection;
  const parent = $from.parent;
  if (parent.type.name !== 'heading' || parent.textContent.length > 0) return false;

  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return false;

  event.preventDefault();

  const nodeStart = $from.before();
  let tr = view.state.tr.replaceWith(
    nodeStart,
    nodeStart + parent.nodeSize,
    paragraphType.create()
  );
  tr = tr.setSelection(TextSelection.create(tr.doc, nodeStart + 1));
  view.dispatch(tr);
  return true;
}

function repairMalformedHeading(view: { state: any; dispatch: (tr: any) => void }, event: KeyboardEvent) {
  if (!view.state.selection.empty) return false;

  const { $from } = view.state.selection;
  const parent = $from.parent;
  if (parent.type.name !== 'heading' || parent.attrs.level !== 6 || !parent.textContent.startsWith('#')) {
    return false;
  }

  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return false;

  const nodeStart = $from.before();
  let nextText = parent.textContent;
  let nextOffset = $from.parentOffset;

  if (event.key === 'Backspace') {
    if (nextOffset <= 0) return false;
    nextText = `${nextText.slice(0, nextOffset - 1)}${nextText.slice(nextOffset)}`;
    nextOffset -= 1;
  } else if (event.key === 'Delete') {
    nextText = `${nextText.slice(0, nextOffset)}${nextText.slice(nextOffset + 1)}`;
  } else if (isPrintableKey(event)) {
    nextText = `${nextText.slice(0, nextOffset)}${event.key}${nextText.slice(nextOffset)}`;
    nextOffset += event.key.length;
  } else {
    return false;
  }

  event.preventDefault();

  const content = nextText ? view.state.schema.text(nextText) : undefined;
  let tr = view.state.tr.replaceWith(
    nodeStart,
    nodeStart + parent.nodeSize,
    paragraphType.create(null, content ? [content] : undefined)
  );
  tr = tr.setSelection(TextSelection.create(tr.doc, nodeStart + 1 + nextOffset));
  view.dispatch(tr);
  return true;
}

function ensureCaretVisible(root: Node | null) {
  if (!root) return;

  const documentRef = root.ownerDocument;
  if (!documentRef) return;

  const selection = documentRef.getSelection();
  const anchorNode = selection?.anchorNode;
  if (!anchorNode || !root.contains(anchorNode)) return;

  const anchorElement =
    anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
  const target = anchorElement?.closest(BLOCK_SELECTOR) ?? anchorElement;
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const topSafeArea = 120;
  const bottomSafeArea = 180;
  const viewportHeight = documentRef.defaultView?.innerHeight ?? 0;

  if (rect.bottom > viewportHeight - bottomSafeArea || rect.top < topSafeArea) {
    target.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }
}

function WritingEditorInner({ defaultValue, onChange, onUpload }: WritingEditorProps) {
  const initialValueRef = useRef(defaultValue);
  const onChangeRef = useRef(onChange);
  const onUploadRef = useRef(onUpload);
  const editorRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onUploadRef.current = onUpload;
  }, [onUpload]);

  useEditor(
    (root) => {
      editorRootRef.current = root;

      const crepe = new CrepeBuilder({
        root,
        defaultValue: initialValueRef.current,
      });

      crepe.editor.config((ctx) => {
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          handleKeyDown: (view, event) => {
            if (
              preventInvalidHeadingShortcut(view, event) ||
              collapseEmptyHeading(view, event) ||
              repairMalformedHeading(view, event)
            ) {
              return true;
            }

            return prev.handleKeyDown?.(view, event) ?? false;
          },
        }));
      });

      crepe
        .addFeature(cursor)
        .addFeature(listItem)
        .addFeature(linkTooltip)
        .addFeature(codeMirror)
        .addFeature(imageBlock, {
          onUpload: (file) => onUploadRef.current(file),
          blockOnUpload: (file) => onUploadRef.current(file),
          inlineOnUpload: (file) => onUploadRef.current(file),
        });

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
          requestAnimationFrame(() => {
            ensureCaretVisible(editorRootRef.current);
          });
        });
      });

      return crepe;
    },
    []
  );

  return <Milkdown />;
}

export default function WritingEditor(props: WritingEditorProps) {
  return (
    <MilkdownProvider>
      <WritingEditorInner {...props} />
    </MilkdownProvider>
  );
}
