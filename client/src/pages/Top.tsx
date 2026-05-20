import { Link } from 'react-router-dom';
import { useTopPosts } from '../api/client';
import '../styles/Home.css';
import '../styles/Top.css';

function Top() {
  const { posts, isLoading } = useTopPosts();

  if (isLoading) return <main className='page-content container'><p>Loading...</p></main>;

  return (
    <main className="page-content container">
      <p className='sign'>Top</p>
      <div className="top-posts-timeline">
        {posts.map(post => (
          <article key={post.id} className="top-post-row">
            <span className="top-post-date">{post.date}</span>
            <Link to={`/post/${post.id}`} className="top-post-title">
              {post.title}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}

export default Top;
