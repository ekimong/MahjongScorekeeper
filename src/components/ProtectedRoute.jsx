import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEdit } from '../context/EditContext';

export default function ProtectedRoute({ children, allowGuest = false }) {
  const { user, loading } = useAuth();
  const { canEdit } = useEdit();
  const { eventId } = useParams();

  if (loading) return <div className="loading">Loading…</div>;
  if (user) return children;
  if (allowGuest && eventId && canEdit(eventId)) return children;
  return <Navigate to="/login" replace />;
}
