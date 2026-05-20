import { Link } from 'react-router-dom';
import { useClientPosts } from '../api/client';
import '../styles/Home.css';

function Home() {
  const { posts, isLoading, isError } = useClientPosts();

  if (isLoading) return <main className="page-content container"><p>Loading...</p></main>;
  if (isError) return <main className="page-content container"><p>Failed to load posts</p></main>;

  return (
    <main className="page-content container">
      <div className="posts-grid">
        {posts.map(post => (
          <article key={post.id} className="post-card">
            <Link to={`/post/${post.id}`} className="post-title hover-underline-animation">
              {post.title}
            </Link>
            <p className="post-date">{post.date}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default Home;
