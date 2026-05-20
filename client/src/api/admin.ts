import useSWR, { mutate } from 'swr';
import type { PostSummary, PostDetail, CreatePostRequest } from './types';

const BASE_URL = '/api/admin';
const TOKEN_KEY = 'admin_token';
const UNAUTHORIZED_ERROR = 'Unauthorized';

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function handleUnauthorized(): never {
  clearToken();

  if (!window.location.pathname.startsWith('/admin/login')) {
    window.location.assign('/admin/login');
  }

  throw new Error(UNAUTHORIZED_ERROR);
}

async function readResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (res.status === 401) {
    handleUnauthorized();
  }

  const json = await res.json() as ApiResponse<T>;

  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Request failed');
  }

  return json;
}

function authHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const token = getToken();

  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }

  return nextHeaders;
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: authHeaders(init.headers),
  });
  const json = await readResponse<T>(res);

  return json.data as T;
}

const postsFetcher = (url: string): Promise<ApiResponse<PostSummary[]>> => {
  return fetch(url, {
    headers: authHeaders(),
  }).then(readResponse<PostSummary[]>);
};

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.message === UNAUTHORIZED_ERROR;
}

export function useAdminPosts() {
  const { data, error, isLoading } = useSWR<ApiResponse<PostSummary[]>, Error, string>(
    `${BASE_URL}/posts`,
    postsFetcher
  );

  return {
    posts: data?.data || [],
    isLoading,
    isError: error,
  };
}

export const adminApi = {
  login: async (password: string): Promise<{ token: string }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (json.success && json.data?.token) {
      setToken(json.data.token);
      return json.data;
    }
    throw new Error(json.message || 'Login failed');
  },

  logout: () => {
    clearToken();
  },

  isLoggedIn: (): boolean => {
    return !!getToken();
  },

  getPost: async (id: number): Promise<PostDetail> => {
    return adminRequest<PostDetail>(`/posts/${id}`);
  },

  createPost: async (post: CreatePostRequest): Promise<PostSummary> => {
    const data = await adminRequest<PostSummary>('/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post),
    });
    mutate(`${BASE_URL}/posts`);
    return data;
  },

  updatePost: async (id: number, post: Partial<CreatePostRequest>): Promise<PostSummary> => {
    const data = await adminRequest<PostSummary>(`/posts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(post),
    });
    mutate(`${BASE_URL}/posts`);
    return data;
  },

  deletePost: async (id: number): Promise<void> => {
    await adminRequest<void>(`/posts/${id}`, {
      method: 'DELETE',
    });
    mutate(`${BASE_URL}/posts`);
  },

  toggleTop: async (id: number): Promise<PostSummary> => {
    const data = await adminRequest<PostSummary>(`/posts/${id}/top`, {
      method: 'PATCH',
    });
    mutate(`${BASE_URL}/posts`);
    return data;
  },

  publishPost: async (id: number): Promise<PostSummary> => {
    const data = await adminRequest<PostSummary>(`/posts/${id}/publish`, {
      method: 'PATCH',
    });
    mutate(`${BASE_URL}/posts`);
    return data;
  },

  uploadFile: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    return adminRequest<{ url: string }>('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
