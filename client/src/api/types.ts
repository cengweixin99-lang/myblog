export interface PostSummary {
  id: number;
  title: string;
  date: string;
  isTop: boolean;
  status: 'draft' | 'published';
}

export interface PostDetail extends PostSummary {
  content: string;
  contentHtml: string;
}

export interface CreatePostRequest {
  title: string;
  date: string;
  content: string;
  isTop?: boolean;
  status?: 'draft' | 'published';
}
