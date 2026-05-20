import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, isUnauthorizedError } from '../../api/admin';
import type { CreatePostRequest } from '../../api/types';
import WritingEditor from '../../components/admin/WritingEditor';
import '../../styles/Home.css';
import '../../styles/admin/PostEditor.css';

type HeadingItem = {
  id: string;
  level: number;
  text: string;
};

function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split(/\r?\n/);
  const headings: HeadingItem[] = [];
  let inCodeBlock = false;
  let occurrence = 0;

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const text = match[2]
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/[*_~`>#-]/g, '')
      .trim();

    if (!text) continue;

    headings.push({
      id: `heading-${occurrence}`,
      level: match[1].length,
      text,
    });
    occurrence += 1;
  }

  return headings;
}

export default function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [deleting, setDeleting] = useState(false);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const headings = extractHeadings(content);

  useEffect(() => {
    const node = titleInputRef.current;
    if (!node) return;

    node.style.height = '0px';
    node.style.height = `${Math.max(node.scrollHeight, 44)}px`;
  }, [title]);

  useEffect(() => {
    if (!isEdit) return;

    const postId = Number(id);
    if (!Number.isInteger(postId) || postId <= 0) {
      navigate('/admin', { replace: true });
      return;
    }

    let isMounted = true;
    setLoading(true);

    adminApi
      .getPost(postId)
      .then((post) => {
        if (!isMounted) return;
        setTitle(post.title);
        setContent(post.content);
        setDate(post.date);
      })
      .catch((error) => {
        if (!isUnauthorizedError(error)) {
          navigate('/admin', { replace: true });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEdit, navigate]);

  const handleUpload = async (file: File) => {
    const { url } = await adminApi.uploadFile(file);
    return url;
  };

  const handleSave = async (publish = false) => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setSaving(true);
    try {
      const postData: CreatePostRequest = {
        title: title.trim(),
        content,
        date,
        status: publish ? 'published' : 'draft',
      };

      if (isEdit && id) {
        await adminApi.updatePost(Number(id), postData);
      } else {
        await adminApi.createPost(postData);
      }

      navigate(publish ? '/admin' : '/admin/drafts');
    } catch {
      alert(publish ? 'Publish failed' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !id || !window.confirm('Delete this post?')) return;

    setDeleting(true);
    try {
      await adminApi.deletePost(Number(id));
      navigate('/admin/drafts', { replace: true });
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        alert('Delete failed');
      }
      setDeleting(false);
    }
  };

  const handleJumpToHeading = (heading: HeadingItem) => {
    const headingNodes = Array.from(
      document.querySelectorAll(
        '.editor-canvas .ProseMirror h1, .editor-canvas .ProseMirror h2, .editor-canvas .ProseMirror h3, .editor-canvas .ProseMirror h4, .editor-canvas .ProseMirror h5, .editor-canvas .ProseMirror h6'
      )
    );

    const currentIndex = headings.findIndex((item) => item.id === heading.id);
    const sameTextIndex = headings.slice(0, currentIndex).filter((item) => item.text === heading.text).length;
    const target = headingNodes.filter((node) => node.textContent?.trim() === heading.text)[sameTextIndex];
    if (!(target instanceof HTMLElement)) return;

    target.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="editor-page">
      <div className="editor-workbench">
        <article className="admin-editor-card">
          <textarea
            ref={titleInputRef}
            rows={1}
            className="editor-title"
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            spellCheck={false}
          />
          <div className="editor-meta-row">
            <label className="editor-date-field">
              <span className="editor-meta-label">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={saving || deleting}
              />
            </label>
          </div>

          <div className="editor-body">
            <div className="editor-canvas">
              <WritingEditor key={id ?? 'new-post'} defaultValue={content} onChange={setContent} onUpload={handleUpload} />
            </div>
          </div>

          <div className="editor-footer">
            <div className="editor-actions">
              {isEdit && (
                <button className="btn-delete" onClick={handleDelete} disabled={saving || deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button className="btn-draft" onClick={() => handleSave(false)} disabled={saving || deleting}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-publish" onClick={() => handleSave(true)} disabled={saving || deleting}>
                {saving ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </article>

        <aside className="editor-side-rail" aria-label="Editor tools">
          {headings.length > 0 && (
            <div className="editor-outline">
              <div className="editor-outline-card">
                <div className="editor-outline-label">CONTENTS</div>
                <ol className="editor-outline-list">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <button
                        type="button"
                        className={`editor-outline-link editor-outline-link--level-${Math.min(heading.level, 3)}`}
                        onClick={() => handleJumpToHeading(heading)}
                      >
                        {heading.text}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
