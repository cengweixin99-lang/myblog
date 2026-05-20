import { Marked } from 'marked';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('#')
  ) {
    return true;
  }

  try {
    const protocol = new URL(trimmed).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' || protocol === 'tel:';
  } catch {
    return false;
  }
}

const marked = new Marked({
  gfm: true,
  breaks: true,
});

marked.use({
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    },
    link(token) {
      if (!isSafeUrl(token.href)) {
        return escapeHtml(token.text);
      }

      const href = escapeHtml(token.href);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      const text = token.text;

      return `<a href="${href}"${title}>${text}</a>`;
    },
    image(token) {
      if (!isSafeUrl(token.href)) {
        return escapeHtml(token.text);
      }

      const src = escapeHtml(token.href);
      const alt = escapeHtml(token.text);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';

      return `<img src="${src}" alt="${alt}"${title} />`;
    },
  },
});

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown) as string;
}
