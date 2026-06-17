import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getEventByEditToken } from '../lib/firestore';
import { useEdit } from '../context/EditContext';

export default function EditEntry() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { grantEdit } = useEdit();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const event = await getEventByEditToken(token);
      if (!event) { setNotFound(true); return; }
      // Ensure the user has an auth session (anonymous if not signed in)
      // so Firestore write rules (request.auth != null) are satisfied.
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      grantEdit(event.id);
      navigate(`/event/${event.id}`, { replace: true });
    }
    load();
  }, [token]);

  if (notFound) return <div className="page"><p>Edit link not found or has expired.</p></div>;
  return <div className="loading">Loading…</div>;
}
