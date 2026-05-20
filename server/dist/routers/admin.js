import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { postStore } from '../data/posts.js';
import { authMiddleware } from '../middleware/auth.js';
import { CreatePostRequestSchema, UpdatePostRequestSchema } from '../types/index.js';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { renderMarkdown } from '../utils/markdown.js';
const adminRoute = new Hono();
adminRoute.use('/*', authMiddleware);
const idParamSchema = z.object({
    id: z.string().transform(Number),
});
adminRoute.get('/posts', (c) => {
    const postsSummary = postStore.getAllSummariesAdmin();
    return c.json({
        success: true,
        data: postsSummary,
    });
});
adminRoute.get('/posts/:id', zValidator('param', idParamSchema), (c) => {
    const { id } = c.req.valid('param');
    const post = postStore.getById(id);
    if (!post) {
        return c.json({
            success: false,
            message: 'Post not found',
        }, 404);
    }
    const renderedPost = {
        ...post,
        contentHtml: renderMarkdown(post.content),
    };
    return c.json({
        success: true,
        data: renderedPost,
    });
});
adminRoute.post('/posts', zValidator('json', CreatePostRequestSchema), async (c) => {
    const body = await c.req.json();
    const newPost = postStore.create(body);
    return c.json({
        success: true,
        message: 'Post created successfully',
        data: newPost,
    }, 201);
});
adminRoute.put('/posts/:id', zValidator('param', idParamSchema), zValidator('json', UpdatePostRequestSchema), async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const updatedPost = postStore.update(id, body);
    if (!updatedPost) {
        return c.json({
            success: false,
            message: 'Post not found',
        }, 404);
    }
    return c.json({
        success: true,
        message: 'Post updated successfully',
        data: updatedPost,
    });
});
adminRoute.delete('/posts/:id', zValidator('param', idParamSchema), (c) => {
    const { id } = c.req.valid('param');
    const deleted = postStore.delete(id);
    if (!deleted) {
        return c.json({
            success: false,
            message: 'Post not found',
        }, 404);
    }
    return c.json({
        success: true,
        message: 'Post deleted successfully',
    });
});
adminRoute.patch('/posts/:id/top', zValidator('param', idParamSchema), (c) => {
    const { id } = c.req.valid('param');
    const updatedPost = postStore.toggleTop(id);
    if (!updatedPost) {
        return c.json({
            success: false,
            message: 'Post not found',
        }, 404);
    }
    const status = updatedPost.isTop ? '置顶' : '取消置顶';
    return c.json({
        success: true,
        message: `Post ${status} successfully`,
        data: updatedPost,
    });
});
adminRoute.patch('/posts/:id/publish', zValidator('param', idParamSchema), (c) => {
    const { id } = c.req.valid('param');
    const updatedPost = postStore.update(id, { status: 'published' });
    if (!updatedPost) {
        return c.json({
            success: false,
            message: 'Post not found',
        }, 404);
    }
    return c.json({
        success: true,
        message: 'Post published successfully',
        data: updatedPost,
    });
});
// 文件上传
adminRoute.post('/upload', async (c) => {
    try {
        const body = await c.req.parseBody({ all: true });
        const file = body['file'];
        if (!file || !(file instanceof File)) {
            return c.json({
                success: false,
                message: 'No file provided',
            }, 400);
        }
        const ext = extname(file.name);
        const filename = `${randomBytes(8).toString('hex')}${ext}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }
        const buffer = await file.arrayBuffer();
        await writeFile(join(uploadDir, filename), Buffer.from(buffer));
        const url = `/uploads/${filename}`;
        return c.json({
            success: true,
            data: { url },
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        return c.json({
            success: false,
            message: 'Upload failed',
        }, 500);
    }
});
export default adminRoute;
