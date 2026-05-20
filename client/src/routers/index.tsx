import { Suspense, lazy } from 'react';
import App from '../App';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import PostDetail from '../components/PostDetail';
import AdminLayout from '../components/admin/AdminLayout';
import { adminApi } from '../api/admin';

const Home = lazy(() => import('../pages/Home'));
const Top = lazy(() => import('../pages/Top'));
const Login = lazy(() => import('../pages/admin/Login'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminDrafts = lazy(() => import('../pages/admin/AdminDrafts'));
const AdminPostDetail = lazy(() => import('../pages/admin/AdminPostDetail'));
const PostEditor = lazy(() => import('../pages/admin/PostEditor'));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<div className="loading">Loading...</div>}>{node}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return adminApi.isLoggedIn()
    ? children
    : <Navigate to="/admin/login" replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "",
        element: withSuspense(<Home />)
      },
      {
        path: "post/:id",
        element: <PostDetail />
      },
      {
        path: "top",
        element: withSuspense(<Top />)
      },
    ]
  },
  {
    path: "/admin/login",
    element: withSuspense(<Login />)
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        path: "",
        element: <ProtectedRoute>{withSuspense(<AdminDashboard />)}</ProtectedRoute>,
      },
      {
        path: "drafts",
        element: <ProtectedRoute>{withSuspense(<AdminDrafts />)}</ProtectedRoute>,
      },
      {
        path: "post/:id",
        element: <ProtectedRoute>{withSuspense(<AdminPostDetail />)}</ProtectedRoute>,
      },
      {
        path: "write",
        element: <ProtectedRoute>{withSuspense(<PostEditor />)}</ProtectedRoute>,
      },
      {
        path: "edit/:id",
        element: <ProtectedRoute>{withSuspense(<PostEditor />)}</ProtectedRoute>,
      },
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);

export default router;
