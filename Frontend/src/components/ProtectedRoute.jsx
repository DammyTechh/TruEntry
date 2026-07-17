import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../lib/constants';
import { PageLoader } from './ui/Misc';

export function ProtectedRoute({ allow, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (allow && !allow.includes(user.role)) {
    // Signed in but wrong portal — send them to their own.
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  }
  return children;
}

// Redirect already-authenticated users away from auth pages.
export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  return children;
}
