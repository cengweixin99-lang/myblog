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
  path: string;
  date: string;
  updated: string;
  isTop: boolean;
  labels: string[];
  issueUrl: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const README_FILE = path.join(REPO_ROOT, 'README.md');
const OUTPUT_ROOT = path.join(REPO_ROOT, 'site', 'content');
const TAGS_DIR = path.join(OUTPUT_ROOT, 'tags');
const PAGES_DIR = path.join(OUTPUT_ROOT, 'pages');
const DATA_DIR = path.join(REPO_ROOT, 'site', 'data');
const NAVIGATION_DATA_FILE = path.join(DATA_DIR, 'navigation.toml');
const ARCHIVE_FILE = path.join(PAGES_DIR, 'archive.md');
const TAGS_INDEX_FILE = path.join(PAGES_DIR, 'tags.md');
const TOP_LABEL = 'Top';
const SITE_URL = 'https://www.weisley1314.com';
const SPECIAL_NAV_ITEMS = [
  { label: 'About', name: 'About' },
] as const;
const LEGACY_SPECIAL_PAGE_FILES = ['about.md', 'things-i-like.md', 'things-i-dont-like.md'];

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
  return value
    .trim()
    .toLowerCase()
    .replace(/[\\/]/g, '-')
    .replace(/['\u2019]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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

function preserveSingleLineBreaks(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? '';
    const trimmed = line.trimStart();
    const nextTrimmed = nextLine.trimStart();
    const isFence = /^(```|~~~)/.test(trimmed);

    if (isFence) {
      inFence = !inFence;
      result.push(line);
      continue;
    }

    if (
      !inFence &&
      line.trim() &&
      nextLine.trim() &&
      !line.endsWith('  ') &&
      !/^#{1,6}\s/.test(trimmed) &&
      !/^#{1,6}\s/.test(nextTrimmed) &&
      !/^([-+*]|\d+\.)\s/.test(trimmed) &&
      !/^([-+*]|\d+\.)\s/.test(nextTrimmed) &&
      !/^>/.test(trimmed) &&
      !/^>/.test(nextTrimmed) &&
      !/^\|/.test(trimmed) &&
      !/^\|/.test(nextTrimmed)
    ) {
      result.push(`${line}  `);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function issueToPostMeta(issue: GitHubIssue): PostMeta {
  return {
    id: issue.number,
    title: issue.title,
    path: `post/${issue.number}`,
    date: toDateTimeString(issue.created_at),
    updated: toDateTimeString(issue.updated_at),
    isTop: issue.labels.some((label) => label.name === TOP_LABEL),
    labels: issue.labels.map((label) => label.name),
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
        `{ title = "${escapeToml(post.title)}", path = "${escapeToml(post.path)}", date = "${escapeToml(post.date)}" }`
    )
    .join(', ')}]`;
}

function buildInlineArchiveGroups(posts: PostMeta[]) {
  const yearMap = new Map<string, Map<string, PostMeta[]>>();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  for (const post of posts) {
    const date = new Date(post.date);
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const monthMap = yearMap.get(year) ?? new Map<string, PostMeta[]>();
    const monthPosts = monthMap.get(month) ?? [];

    monthPosts.push(post);
    monthMap.set(month, monthPosts);
    yearMap.set(year, monthMap);
  }

  const years = Array.from(yearMap.entries()).sort(([left], [right]) => right.localeCompare(left));

  return `[${years
    .map(([year, monthMap]) => {
      const months = Array.from(monthMap.entries())
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([month, monthPosts]) => {
          const monthIndex = Number(month) - 1;
          const monthName = monthNames[monthIndex] ?? month;
          return `{ month = "${month}", month_name = "${monthName}", count = ${monthPosts.length}, posts = ${buildInlinePostLinks(monthPosts)} }`;
        });
      const count = Array.from(monthMap.values()).reduce((total, monthPosts) => total + monthPosts.length, 0);

      return `{ year = "${year}", count = ${count}, months = [${months.join(', ')}] }`;
    })
    .join(', ')}]`;
}

function buildInlineTagCloud(tags: Array<{ name: string; slug: string; count: number; weight: number }>) {
  return `[${tags
    .map(
      (tag) =>
        `{ name = "${escapeToml(tag.name)}", slug = "${escapeToml(tag.slug)}", count = ${tag.count}, weight = ${tag.weight} }`
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

function formatReadmeDate(value: string) {
  return value.slice(0, 10);
}

function buildCommentsBlock(comments: GitHubIssueComment[]) {
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
  const commentsHtml = buildCommentsBlock(comments);
  const labelLinks = meta.labels.length ? `label_links = ${buildInlineLabelLinks(meta.labels)}` : '';

  return [
    '+++',
    `title = "${escapeToml(meta.title)}"`,
    `date = "${meta.date}"`,
    `updated = "${meta.updated}"`,
    `path = "${escapeToml(meta.path)}"`,
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
    preserveSingleLineBreaks(issue.body?.trim() || ''),
    '',
  ]
    .filter(Boolean)
    .join('\n');
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

function buildArchivePageFile(posts: PostMeta[]) {
  return [
    '+++',
    'title = "Archive"',
    'template = "archive.html"',
    'path = "archive"',
    'draft = false',
    '[extra]',
    `archive_groups = ${buildInlineArchiveGroups(posts)}`,
    '+++',
    '',
  ].join('\n');
}

function buildTagsIndexPageFile(tagMap: Map<string, PostMeta[]>) {
  const counts = Array.from(tagMap.values()).map((posts) => posts.length);
  const min = Math.min(...counts, 1);
  const max = Math.max(...counts, 1);
  const tags = Array.from(tagMap.entries())
    .map(([name, posts]) => {
      const count = posts.length;
      const weight = max === min ? 3 : Math.round(1 + ((count - min) / (max - min)) * 4);
      return {
        name,
        slug: slugifyTag(name),
        count,
        weight,
      };
    })
    .sort((left, right) => {
      if (left.name === TOP_LABEL) return -1;
      if (right.name === TOP_LABEL) return 1;
      return left.name.localeCompare(right.name);
    });

  return [
    '+++',
    'title = "Tags"',
    'template = "tags.html"',
    'path = "tags"',
    'draft = false',
    '[extra]',
    `tag_cloud = ${buildInlineTagCloud(tags)}`,
    '+++',
    '',
  ].join('\n');
}

function buildNavigationDataFile(issues: GitHubIssue[]) {
  const items = SPECIAL_NAV_ITEMS.map((item) => {
    const issue = issues.find((entry) => hasLabel(entry, item.label));
    if (!issue) return null;

    return `{ name = "${escapeToml(item.name)}", path = "post/${issue.number}" }`;
  }).filter(Boolean);

  return [`items = [${items.join(', ')}]`, ''].join('\n');
}

function buildReadmeFile(posts: GitHubIssue[]) {
  const tagMap = new Map<string, PostMeta[]>();

  for (const issue of [...posts].sort(byCreatedDesc)) {
    const meta = issueToPostMeta(issue);
    for (const label of meta.labels) {
      const existing = tagMap.get(label) ?? [];
      existing.push(meta);
      tagMap.set(label, existing);
    }
  }

  const sortedTags = Array.from(tagMap.entries()).sort(([left], [right]) => {
    if (left === TOP_LABEL) return -1;
    if (right === TOP_LABEL) return 1;
    return left.localeCompare(right);
  });

  const tagSections = sortedTags.flatMap(([label, metas]) => [
    `## ${label}`,
    '',
    ...metas.map(
      (post) => `- [${post.title}](${post.issueUrl}) - ${formatReadmeDate(post.date)}`
    ),
    '',
  ]);

  return [
    "# Weisley's Blog",
    '',
    `[Visit the site](${SITE_URL})`,
    '',
    'A minimalist personal blog powered by GitHub Issues, GitHub Actions, and Zola.',
    '',
    '## Posts by Tag',
    '',
    ...tagSections,
    '## Project Notes',
    '',
    '- `scripts/fetch_issues.ts` pulls authored GitHub issues and comments, then generates Zola content.',
    '- `site/` contains the static site templates, styles, config, and generated content.',
    '- `.github/workflows/build-site.yml` rebuilds and deploys the site with GitHub Pages.',
    '',
    'Generated automatically from GitHub Issues.',
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
  await rm(path.join(OUTPUT_ROOT, 'pages'), { recursive: true, force: true });
  await rm(TAGS_DIR, { recursive: true, force: true });
  await rm(path.join(OUTPUT_ROOT, 'archive.md'), { force: true });
  await rm(path.join(OUTPUT_ROOT, 'tags.md'), { force: true });
  await mkdir(TAGS_DIR, { recursive: true });
  await mkdir(PAGES_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const entries = await readdir(OUTPUT_ROOT, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          (/^\d+\.md$/.test(entry.name) || LEGACY_SPECIAL_PAGE_FILES.includes(entry.name))
      )
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

  await writeFile(TAGS_INDEX_FILE, buildTagsIndexPageFile(tagMap), 'utf8');
}

async function writeArchivePage(posts: GitHubIssue[]) {
  const metas = [...posts].sort(byCreatedDesc).map(issueToPostMeta);
  await writeFile(ARCHIVE_FILE, buildArchivePageFile(metas), 'utf8');
}

async function writeNavigationData(issues: GitHubIssue[]) {
  await writeFile(NAVIGATION_DATA_FILE, buildNavigationDataFile(issues), 'utf8');
}

async function writeReadmeIndex(posts: GitHubIssue[]) {
  await writeFile(README_FILE, buildReadmeFile(posts), 'utf8');
}

async function main() {
  await loadServerEnv();
  await ensureDirectories();

  const issues = (await fetchIssues()).sort(byCreatedDesc);
  const author = process.env.GITHUB_AUTHOR ?? process.env.GITHUB_OWNER;
  const authoredIssues = author ? issues.filter((issue) => issue.user.login === author) : issues;

  const posts = authoredIssues.filter((issue) => {
    if (issue.pull_request) return false;
    return true;
  });

  const commentsEntries = await Promise.all(
    posts.map(async (issue) => [issue.number, await fetchIssueComments(issue.number)] as const)
  );
  const commentsByIssueNumber = new Map<number, GitHubIssueComment[]>(commentsEntries);

  await writeSiteContent(posts, commentsByIssueNumber);
  await writeTagPages(posts);
  await writeArchivePage(posts);
  await writeNavigationData(posts);
  await writeReadmeIndex(posts);

  console.log(`Generated ${posts.length} authored issue posts into ${OUTPUT_ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
