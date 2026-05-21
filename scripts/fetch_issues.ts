import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type GitHubLabel = {
  name: string;
};

type GitHubUser = {
  login: string;
  html_url?: string;
  avatar_url?: string;
};

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: GitHubLabel[];
  user: GitHubUser;
  pull_request?: unknown;
};

type GitHubIssueComment = {
  id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  body?: string | null;
  body_html?: string | null;
  user: GitHubUser;
};

type PostMeta = {
  id: number;
  title: string;
  date: string;
  updated: string;
  isTop: boolean;
  labels: string[];
  issueUrl: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_ROOT = path.join(REPO_ROOT, 'site', 'content');
const PAGES_DIR = path.join(OUTPUT_ROOT, 'pages');
const TAGS_DIR = path.join(OUTPUT_ROOT, 'tags');
const TOP_LABEL = 'Top';
const SPECIAL_PAGE_ROUTES = [
  { label: 'About', slug: 'about', title: 'About' },
  { label: 'Things I like', slug: 'things-i-like', title: 'Things I like' },
  { label: "Things I don't like", slug: 'things-i-dont-like', title: "Things I don't like" },
] as const;
const SPECIAL_PAGE_LABELS = new Set(SPECIAL_PAGE_ROUTES.map((page) => page.label));
const RESERVED_LABELS = new Set([...SPECIAL_PAGE_ROUTES.map((page) => page.label)]);

async function loadServerEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  let content = '';

  try {
    content = await readFile(envPath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!key || process.env[key]) continue;
    process.env[key] = value;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function resolveRepoInfo() {
  const ownerFromEnv = process.env.GITHUB_OWNER?.trim();
  const repoFromEnv = requireEnv('GITHUB_REPO').trim();

  try {
    const url = new URL(repoFromEnv);
    const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1],
      };
    }
  } catch {
    // Not a full URL; fall back to plain owner/repo env values below.
  }

  return {
    owner: ownerFromEnv || requireEnv('GITHUB_OWNER').trim(),
    repo: repoFromEnv.replace(/\.git$/, ''),
  };
}

function toDateTimeString(value: string) {
  return value;
}

function slugifyTag(value: string) {
  return value.trim().toLowerCase().replace(/[\\/]/g, '-').replace(/\s+/g, '-');
}

function escapeToml(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function escapeTomlMultilineLiteral(value: string) {
  return value.replaceAll("'''", '&#39;&#39;&#39;');
}

function issueToPostMeta(issue: GitHubIssue): PostMeta {
  return {
    id: issue.number,
    title: issue.title,
    date: toDateTimeString(issue.created_at),
    updated: toDateTimeString(issue.updated_at),
    isTop: issue.labels.some((label) => label.name === TOP_LABEL),
    labels: issue.labels.map((label) => label.name).filter((name) => !RESERVED_LABELS.has(name)),
    issueUrl: issue.html_url,
  };
}

function buildInlineLabelLinks(labels: string[]) {
  return `[${labels
    .map((label) => `{ name = "${escapeToml(label)}", slug = "${escapeToml(slugifyTag(label))}" }`)
    .join(', ')}]`;
}

function buildInlinePostLinks(posts: PostMeta[]) {
  return `[${posts
    .map(
      (post) =>
        `{ title = "${escapeToml(post.title)}", path = "post/${post.id}", date = "${escapeToml(post.date)}" }`
    )
    .join(', ')}]`;
}

function formatCommentDate(value: string) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function buildCommentsBlock(comments: GitHubIssueComment[], issueUrl: string) {
  if (comments.length === 0) {
    return '';
  }

  const listMarkup = comments
    .map((comment) => {
      const author = comment.user.login || 'GitHub User';
      const avatarUrl = comment.user.avatar_url || '';
      const bodyHtml = comment.body_html?.trim() || `<p>${escapeHtml(comment.body?.trim() || '')}</p>`;

      return [
        '  <article class="comment-item">',
        `    <a class="comment-side" href="${escapeAttribute(comment.html_url)}" target="_blank" rel="noreferrer">`,
        avatarUrl
          ? `      <span class="comment-avatar-link"><img class="comment-avatar" src="${escapeAttribute(avatarUrl)}" alt="${escapeAttribute(author)}" /></span>`
          : '',
        '      <span class="comment-meta">',
        `        <span class="comment-author">${escapeHtml(author)}</span>`,
        `        <span class="comment-date">${escapeHtml(formatCommentDate(comment.created_at))}</span>`,
        '      </span>',
        '    </a>',
        `    <div class="comment-main"><div class="comment-body">${bodyHtml}</div></div>`,
        '  </article>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    '<section class="comments-block">',
    `  <div class="comments-list">\n${listMarkup}\n  </div>`,
    '</section>',
  ].join('\n');
}

function buildPostFile(issue: GitHubIssue, meta: PostMeta, comments: GitHubIssueComment[]) {
  const commentsHtml = buildCommentsBlock(comments, meta.issueUrl);
  const labelLinks = meta.labels.length ? `label_links = ${buildInlineLabelLinks(meta.labels)}` : '';

  return [
    '+++',
    `title = "${escapeToml(meta.title)}"`,
    `date = "${meta.date}"`,
    `updated = "${meta.updated}"`,
    `path = "post/${meta.id}"`,
    `draft = false`,
    `weight = ${meta.isTop ? 1 : 100}`,
    '[extra]',
    `issue_number = ${meta.id}`,
    `issue_url = "${meta.issueUrl}"`,
    `is_top = ${meta.isTop ? 'true' : 'false'}`,
    `has_comments = ${comments.length > 0 ? 'true' : 'false'}`,
    labelLinks,
    "comments_html = '''",
    escapeTomlMultilineLiteral(commentsHtml),
    "'''",
    '+++',
    '',
    issue.body?.trim() || '',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildStandalonePageFile(issue: GitHubIssue, title: string, slug: string) {
  return [
    '+++',
    `title = "${escapeToml(title)}"`,
    `date = "${toDateTimeString(issue.created_at)}"`,
    `updated = "${toDateTimeString(issue.updated_at)}"`,
    `path = "${slug}"`,
    'draft = false',
    `extra = { issue_number = ${issue.number}, issue_url = "${issue.html_url}" }`,
    '+++',
    '',
    issue.body?.trim() || '',
    '',
  ].join('\n');
}

function buildTagPageFile(label: string, posts: PostMeta[]) {
  const slug = slugifyTag(label);

  return [
    '+++',
    `title = "${escapeToml(label)}"`,
    `template = "tag.html"`,
    `path = "tag/${escapeToml(slug)}"`,
    'draft = false',
    '[extra]',
    `label_name = "${escapeToml(label)}"`,
    `post_links = ${buildInlinePostLinks(posts)}`,
    '+++',
    '',
  ].join('\n');
}

function byCreatedDesc(a: GitHubIssue, b: GitHubIssue) {
  return b.created_at.localeCompare(a.created_at);
}

function hasLabel(issue: GitHubIssue, labelName: string) {
  return issue.labels.some((label) => label.name === labelName);
}

async function fetchGitHubJson<T>(url: URL, accept = 'application/vnd.github+json'): Promise<T> {
  const token = requireEnv('GITHUB_TOKEN');

  const response = await fetch(url, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'User-Agent': 'myblog-issue-builder',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub data: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchIssues(): Promise<GitHubIssue[]> {
  const { owner, repo } = resolveRepoInfo();
  const perPage = '100';
  let page = 1;
  const issues: GitHubIssue[] = [];

  while (true) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
    url.searchParams.set('state', 'all');
    url.searchParams.set('sort', 'created');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('per_page', perPage);
    url.searchParams.set('page', String(page));

    const data = await fetchGitHubJson<GitHubIssue[]>(url);
    issues.push(...data);

    if (data.length < Number(perPage)) {
      break;
    }
    page += 1;
  }

  return issues;
}

async function fetchIssueComments(issueNumber: number): Promise<GitHubIssueComment[]> {
  const { owner, repo } = resolveRepoInfo();
  const perPage = '100';
  let page = 1;
  const comments: GitHubIssueComment[] = [];

  while (true) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
    url.searchParams.set('per_page', perPage);
    url.searchParams.set('page', String(page));

    const data = await fetchGitHubJson<GitHubIssueComment[]>(url, 'application/vnd.github.html+json');
    comments.push(...data);

    if (data.length < Number(perPage)) {
      break;
    }
    page += 1;
  }

  return comments;
}

async function ensureDirectories() {
  await rm(PAGES_DIR, { recursive: true, force: true });
  await rm(TAGS_DIR, { recursive: true, force: true });
  await mkdir(PAGES_DIR, { recursive: true });
  await mkdir(TAGS_DIR, { recursive: true });

  const entries = await readdir(OUTPUT_ROOT, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^\d+\.md$/.test(entry.name))
      .map((entry) => rm(path.join(OUTPUT_ROOT, entry.name), { force: true }))
  );
}

async function writeSiteContent(posts: GitHubIssue[], commentsByIssueNumber: Map<number, GitHubIssueComment[]>) {
  const sortedPosts = [...posts].sort(byCreatedDesc);

  await Promise.all(
    sortedPosts.map((issue) => {
      const meta = issueToPostMeta(issue);
      const target = path.join(OUTPUT_ROOT, `${issue.number}.md`);
      const comments = commentsByIssueNumber.get(issue.number) || [];
      return writeFile(target, buildPostFile(issue, meta, comments), 'utf8');
    })
  );
}

async function writeTagPages(posts: GitHubIssue[]) {
  const tagMap = new Map<string, PostMeta[]>();

  for (const issue of [...posts].sort(byCreatedDesc)) {
    const meta = issueToPostMeta(issue);
    for (const label of meta.labels) {
      const existing = tagMap.get(label) ?? [];
      existing.push(meta);
      tagMap.set(label, existing);
    }
  }

  await Promise.all(
    Array.from(tagMap.entries()).map(([label, metas]) =>
      writeFile(path.join(TAGS_DIR, `${slugifyTag(label)}.md`), buildTagPageFile(label, metas), 'utf8')
    )
  );
}

async function writeSpecialPages(issues: GitHubIssue[]) {
  await Promise.all(
    SPECIAL_PAGE_ROUTES.map(async (page) => {
      const issue = issues.find((item) => hasLabel(item, page.label));
      if (!issue) return;

      const target = path.join(PAGES_DIR, `${page.slug}.md`);
      await writeFile(target, buildStandalonePageFile(issue, page.title, page.slug), 'utf8');
    })
  );
}

async function main() {
  await loadServerEnv();
  await ensureDirectories();

  const issues = (await fetchIssues()).sort(byCreatedDesc);
  const author = process.env.GITHUB_AUTHOR ?? process.env.GITHUB_OWNER;
  const authoredIssues = author ? issues.filter((issue) => issue.user.login === author) : issues;

  const posts = authoredIssues.filter((issue) => {
    if (issue.pull_request) return false;
    return !issue.labels.some((label) => SPECIAL_PAGE_LABELS.has(label.name));
  });

  const commentsEntries = await Promise.all(
    posts.map(async (issue) => [issue.number, await fetchIssueComments(issue.number)] as const)
  );
  const commentsByIssueNumber = new Map<number, GitHubIssueComment[]>(commentsEntries);

  await writeSiteContent(posts, commentsByIssueNumber);
  await writeSpecialPages(authoredIssues);
  await writeTagPages(posts);

  console.log(`Generated ${posts.length} authored issue posts into ${OUTPUT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
