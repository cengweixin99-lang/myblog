import { Link } from 'react-router-dom';
import { useAdminPosts } from '../../api/admin';
import '../../styles/Home.css';
import '../../styles/admin/AdminDashboard.css';

function TopMark() {
  return (
    <span className="top-badge" aria-label="Pinned" title="Pinned">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function AdminDashboard() {
  const { posts, isLoading, isError } = useAdminPosts();
  const publishedPosts = posts.filter((post) => post.status === 'published');

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isError) return <div className="loading">Failed to load posts.</div>;

  return (
    <div className="dashboard">
      {publishedPosts.length === 0 ? (
        <p className="empty">No posts yet.</p>
      ) : (
        <div className="posts-grid">
          {publishedPosts.map((post) => (
            <article key={post.id} className="post-card">
              <div className="post-title admin-post-title-line">
                {post.isTop ? <TopMark /> : null}
                <Link to={`/admin/post/${post.id}`} className="admin-post-title-link">
                  <span className="admin-post-title-text hover-underline-animation">{post.title}</span>
                </Link>
              </div>
              <p className="post-date">{post.date}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
