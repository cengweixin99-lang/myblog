import { Link } from 'react-router-dom';
import { useAdminPosts } from '../../api/admin';
import '../../styles/Home.css';
import '../../styles/admin/AdminDashboard.css';

export default function AdminDrafts() {
  const { posts, isLoading, isError } = useAdminPosts();
  const draftPosts = posts.filter((post) => post.status === 'draft');

  if (isLoading) return <div className="loading">Loading...</div>;
  if (isError) return <div className="loading">Failed to load drafts.</div>;

  return (
    <div className="dashboard">
      {posts.length === 0 || draftPosts.length === 0 ? (
        <p className="empty">Draft box is empty.</p>
      ) : (
        <div className="posts-grid admin-posts-grid">
          {draftPosts.map((post) => (
            <article key={post.id} className="post-card admin-post-card">
              <Link to={`/admin/edit/${post.id}`} className="post-title hover-underline-animation admin-post-title-line">
                <span>{post.title}</span>
              </Link>
              <p className="post-date">{post.date}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
