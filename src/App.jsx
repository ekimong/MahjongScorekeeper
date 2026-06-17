import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EditProvider } from './context/EditContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventPage from './pages/EventPage';
import TablePage from './pages/TablePage';
import ScoringWizard from './pages/ScoringWizard';
import GuestView from './pages/GuestView';
import EditEntry from './pages/EditEntry';
import History from './pages/History';

export default function App() {
  return (
    <AuthProvider>
      <EditProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/join/:token" element={<GuestView />} />
            <Route path="/edit/:token" element={<EditEntry />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/event/:eventId" element={<ProtectedRoute allowGuest><EventPage /></ProtectedRoute>} />
            <Route path="/event/:eventId/table/:tableId" element={<ProtectedRoute allowGuest><TablePage /></ProtectedRoute>} />
            <Route
              path="/event/:eventId/table/:tableId/round/:roundId/score"
              element={<ProtectedRoute allowGuest><ScoringWizard /></ProtectedRoute>}
            />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </EditProvider>
    </AuthProvider>
  );
}
