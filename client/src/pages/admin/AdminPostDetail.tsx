import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi, isUnauthorizedError } from '../../api/admin';
import type { PostDetail as PostDetailType } from '../../api/types';
import '../../styles/Home.css';
import '../../styles/PostDetail.css';
import '../../styles/admin/AdminPostDetail.css';

function TopMark() {
  return (
    <span className="top-badge" aria-label="Pinned" title="Pinned">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function AdminPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const postId = Number(id);
  const isValidPostId = Number.isInteger(postId) && postId > 0;

  const [post, setPost] = useState<PostDetailType | null>(null);
  const [loading, setLoading] = useState(isValidPostId);
  const [busyAction, setBusyAction] = useState<'pin' | 'delete' | null>(null);

  useEffect(() => {
    if (!isValidPostId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    adminApi
      .getPost(postId)
      .then((data) => {
        if (isMounted) {
          setPost(data);
        }
      })
      .catch((error) => {
        if (!isUnauthorizedError(error)) {
          navigate('/admin', { replace: true });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isValidPostId, navigate, postId]);

  const handleToggleTop = async () => {
    if (!post) return;

    setBusyAction('pin');
    try {
      const updated = await adminApi.toggleTop(post.id);
      setPost((current) => (current ? { ...current, isTop: updated.isTop } : current));
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        alert('Update failed');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!post || !window.confirm(`Delete "${post.title}"?`)) return;

    setBusyAction('delete');
    try {
      await adminApi.deletePost(post.id);
      navigate('/admin', { replace: true });
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        alert('Delete failed');
      }
      setBusyAction(null);
    }
  };

  if (!isValidPostId) return <div className="loading">Not found.</div>;
  if (loading) return <div className="loading">Loading...</div>;
  if (!post) return <div className="loading">Not found.</div>;

  return (
    <div className="posts-grid admin-detail-page">
      <article className="post-card admin-detail-card">
        <div className="post-title admin-post-title-line admin-static-link">
          {post.isTop ? <TopMark /> : null}
          <Link to={`/admin/post/${post.id}`} className="admin-post-title-link">
            <span className="admin-post-title-text hover-underline-animation">{post.title}</span>
          </Link>
        </div>
        <p className="post-date">{post.date}</p>
        <section className="post-content admin-detail-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </article>

      <div className="admin-detail-footer">
        <div className="admin-detail-actions">
          <button type="button" className="admin-detail-action" onClick={handleToggleTop} disabled={busyAction !== null}>
            {post.isTop ? 'Unpin' : 'Pin'}
          </button>
          <Link to={`/admin/edit/${post.id}`} className="admin-detail-link">
            Edit
          </Link>
          <button type="button" className="admin-detail-action" onClick={handleDelete} disabled={busyAction !== null}>
            {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        <Link to="/admin" className="admin-detail-back">
          <span aria-hidden="true">&larr;</span>
          <span>Back</span>
        </Link>
      </div>
    </div>
  );
}
