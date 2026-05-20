import { z } from 'zod';
import { randomBytes } from 'crypto';
const ADMIN_PASSWORD = process.env.ADMIN_TOKEN || 'myblog-admin-token-2024';
const DEFAULT_TOKEN_TTL_HOURS = 24 * 7;
const tokenTtlHours = Number(process.env.ADMIN_TOKEN_TTL_HOURS ?? DEFAULT_TOKEN_TTL_HOURS);
const tokenTtlMs = Number.isFinite(tokenTtlHours) && tokenTtlHours > 0
    ? tokenTtlHours * 60 * 60 * 1000
    : DEFAULT_TOKEN_TTL_HOURS * 60 * 60 * 1000;
const validTokens = new Map();
export const loginSchema = z.object({
    password: z.string().min(1),
});
export function verifyPassword(password) {
    return password === ADMIN_PASSWORD;
}
function cleanupExpiredTokens(now = Date.now()) {
    for (const [token, expiresAt] of validTokens.entries()) {
        if (expiresAt <= now) {
            validTokens.delete(token);
        }
    }
}
export function createToken() {
    cleanupExpiredTokens();
    const token = randomBytes(32).toString('hex');
    validTokens.set(token, Date.now() + tokenTtlMs);
    return token;
}
export function verifyToken(token) {
    const expiresAt = validTokens.get(token);
    if (!expiresAt) {
        return false;
    }
    if (expiresAt <= Date.now()) {
        validTokens.delete(token);
        return false;
    }
    return true;
}
export async function authMiddleware(c, next) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({
            success: false,
            message: 'Unauthorized: Missing or invalid token',
        }, 401);
    }
    const token = authHeader.slice(7);
    if (!verifyToken(token)) {
        return c.json({
            success: false,
            message: 'Unauthorized: Invalid token',
        }, 401);
    }
    await next();
}
export { ADMIN_PASSWORD };
