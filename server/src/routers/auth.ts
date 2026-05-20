import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { verifyPassword, createToken } from '../middleware/auth.js';

const authRoute = new Hono();

const loginSchema = z.object({
  password: z.string().min(1),
});

authRoute.post('/login', zValidator('json', loginSchema), (c) => {
  const { password } = c.req.valid('json');

  if (verifyPassword(password)) {
    return c.json({
      success: true,
      data: {
        token: createToken(),
      },
    });
  }

  return c.json({
    success: false,
    message: 'Invalid password',
  }, 401);
});

export default authRoute;
