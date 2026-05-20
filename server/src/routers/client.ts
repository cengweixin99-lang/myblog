import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { postStore } from '../data/posts.js';
import type { ApiResponse, Post, PostSummary } from '../types/index.js';
import type { RenderedPost } from '../types/api.js';
import { renderMarkdown } from '../utils/markdown.js';

const clientRoute = new Hono();

const paramSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

clientRoute.get('/posts', (c) => {
  const postsSummary = postStore.getAllSummaries();
  return c.json<ApiResponse<PostSummary[]>>({
    success: true,
    data: postsSummary,
  });
});

clientRoute.get('/posts/top', (c) => {
  const topSummaries = postStore.getTopSummaries();
  return c.json<ApiResponse<PostSummary[]>>({
    success: true,
    data: topSummaries,
  });
});

clientRoute.get('/posts/:id', zValidator('param', paramSchema), (c) => {
  const { id } = c.req.valid('param');
  const post = postStore.getById(id);

  if (!post) {
    return c.json<ApiResponse<null>>({
      success: false,
      message: 'Post not found',
    }, 404);
  }

  const renderedPost: RenderedPost = {
    ...post,
    contentHtml: renderMarkdown(post.content),
  };

  return c.json<ApiResponse<RenderedPost>>({
    success: true,
    data: renderedPost,
  });
});

export default clientRoute;
