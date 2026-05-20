import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import '../../styles/App.css';
import '../../styles/admin/AdminLayout.css';

const navItems = [
  { label: 'Published', to: '/admin' },
  { label: 'Drafts', to: '/admin/drafts' },
  { label: 'Write', to: '/admin/write' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWritingRoute = location.pathname === '/admin/write' || location.pathname.startsWith('/admin/edit/');

  const handleLogout = () => {
    adminApi.logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="page-layout admin-layout">
      <hr />
      <header className="header admin-header">
        <div className="container admin-header-row">
          <nav className="admin-nav" aria-label="Admin navigation">
            <ul className="nav-list admin-nav-list">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/admin'} className="hover-underline-animation">
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="admin-signout" onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14 7.5V6.25A1.25 1.25 0 0 0 12.75 5h-5.5A1.25 1.25 0 0 0 6 6.25v11.5A1.25 1.25 0 0 0 7.25 19h5.5A1.25 1.25 0 0 0 14 17.75V16.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M10 12h8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="m15 8.75 3.25 3.25L15 15.25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>
      <main className={`page-content admin-main-container${isWritingRoute ? ' admin-main-container--editor' : ' container'}`}>
        <Outlet />
      </main>
    </div>
  );
}
