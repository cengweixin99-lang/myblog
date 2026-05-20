import { z } from 'zod';

// 统一的 API 响应格式
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export const PostSchema = z.object({
  id: z.number(),
  title: z.string().min(1, { message: "标题不能为空" }),
  date: z.string(),
  content: z.string().min(1, { message: "正文内容不能为空" }), 
  isTop: z.boolean().optional(), // 这个可以可选，因为后端可以用 || false 来兜底
  createdAt: z.string().optional(), // 后端自增，前端提交时可选
  updatedAt: z.string().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type Post = z.infer<typeof PostSchema>;

export const PostSummarySchema = PostSchema.omit({
  content: true,
});
export type PostSummary = z.infer<typeof PostSummarySchema>;


export const CreatePostRequestSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;


export const UpdatePostRequestSchema = CreatePostRequestSchema.partial();
export type UpdatePostRequest = z.infer<typeof UpdatePostRequestSchema>;