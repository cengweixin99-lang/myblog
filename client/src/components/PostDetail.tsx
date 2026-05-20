import { Link, useParams } from 'react-router-dom';
import { usePostDetail } from '../api/client';
import '../styles/Home.css';
import '../styles/PostDetail.css';

export default function PostDetail() {
  const { id } = useParams();
  const postId = Number(id);
  const isValidPostId = Number.isInteger(postId) && postId > 0;
  const { post, isLoading, isError } = usePostDetail(isValidPostId ? postId : null);

  if (!isValidPostId) {
    return (
      <main className="page-content container">
        <h2>404 - Not Found</h2>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="page-content container">
        <p>Loading...</p>
      </main>
    );
  }

  if (isError || !post) {
    return (
      <main className="page-content container">
        <h2>404 - Not Found</h2>
      </main>
    );
  }

  return (
    <main className="page-content container">
      <div className="posts-grid">
        <article className="post-card">
          <Link to={`/post/${post.id}`} className="post-title hover-underline-animation">
            {post.title}
          </Link>
          <p className="post-date">{post.date}</p>
          <section className="post-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </article>
      </div>
    </main>
  );
}
