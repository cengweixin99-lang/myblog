import useSWR from 'swr';

const BASE_URL = '/api';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export interface ClientPostSummary {
  id: number;
  title: string;
  date: string;
  isTop: boolean;
}

export interface ClientPostDetail {
  id: number;
  title: string;
  date: string;
  content: string;
  contentHtml: string;
  isTop: boolean;
}

export function useClientPosts() {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: ClientPostSummary[] }>(
    `${BASE_URL}/posts`,
    fetcher
  );

  return {
    posts: data?.data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useTopPosts() {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: ClientPostSummary[] }>(
    `${BASE_URL}/posts/top`,
    fetcher
  );

  return {
    posts: data?.data || [],
    isLoading,
    isError: error,
  };
}

export function usePostDetail(id: string | number | null) {
  const { data, error, isLoading } = useSWR<{ success: boolean; data: ClientPostDetail }>(
    id === null ? null : `${BASE_URL}/posts/${id}`,
    fetcher
  );

  return {
    post: data?.data,
    isLoading,
    isError: error,
  };
}

export const getClientPosts = () => fetch(`${BASE_URL}/posts`).then(res => res.json());
export const getTopPosts = () => fetch(`${BASE_URL}/posts/top`).then(res => res.json());
export const getPostDetail = (id: string | number) => fetch(`${BASE_URL}/posts/${id}`).then(res => res.json());
