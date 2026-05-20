import type { Post } from './index.js';

export type RenderedPost = Post & {
  contentHtml: string;
};
