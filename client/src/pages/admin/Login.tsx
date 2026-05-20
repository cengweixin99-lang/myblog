import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import '../../styles/App.css';
import '../../styles/admin/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (adminApi.isLoggedIn()) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await adminApi.login(password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-layout">
      <hr />
      <main className="page-content container admin-login-page">
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <h1 className="admin-login-title">Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="admin-login-input"
            placeholder="Password"
            autoFocus
          />
          {error ? <p className="admin-login-error">{error}</p> : null}
          <button type="submit" className="admin-login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
