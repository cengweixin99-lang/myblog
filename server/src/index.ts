import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import clientRoute from './routers/client.js';
import authRoute from './routers/auth.js';
import adminRoute from './routers/admin.js';

const app = new Hono();

// CORS
app.use('/*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];

  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (c.req.method === 'OPTIONS') {
    return c.text('OK', 200);
  }

  await next();
});

app.use('/uploads/*', serveStatic({ root: './public' }));

// 客户端公开接口
app.route('/api', clientRoute);

// 登录接口
app.route('/api/auth', authRoute);

// 管理端接口（需鉴权）
app.route('/api/admin', adminRoute);

// 健康检查
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'Blog API is running',
    endpoints: {
      posts: '/api/posts',
      post: '/api/posts/:id',
      topPosts: '/api/posts/top',
      login: '/api/auth/login',
      adminPosts: '/api/admin/posts',
    }
  });
});

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
