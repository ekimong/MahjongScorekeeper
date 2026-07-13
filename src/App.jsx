import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventPage from './pages/EventPage';
import TablePage from './pages/TablePage';
import ScoringWizard from './pages/ScoringWizard';
import GuestView from './pages/GuestView';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join/:token" element={<GuestView />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/event/:eventId" element={<ProtectedRoute><EventPage /></ProtectedRoute>} />
          <Route path="/event/:eventId/table/:tableId" element={<ProtectedRoute><TablePage /></ProtectedRoute>} />
          <Route
            path="/event/:eventId/table/:tableId/round/:roundId/score"
            element={<ProtectedRoute><ScoringWizard /></ProtectedRoute>}
          />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
