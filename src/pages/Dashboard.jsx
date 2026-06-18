import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserEvents, createEvent } from '../lib/firestore';

const EVENT_TYPES = [
  { value: 'open_play', label: 'Open Play', enabled: true },
  { value: 'tournament', label: 'Tournament', enabled: false },
];

function formatDefaultName(type, date, time) {
  if (!type || !date || !time) return '';
  const label = EVENT_TYPES.find((t) => t.value === type)?.label || '';
  const [year, month, day] = date.split('-');
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${label} - ${month}/${day}/${year} ${hour12}:${m}${ampm}`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // New event form state
  const [eventType, setEventType] = useState('open_play');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventName, setEventName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    getUserEvents()
      .then((evts) => { setEvents(evts); setLoading(false); })
      .catch((err) => { setLoadError(err.message || 'Failed to load events.'); setLoading(false); });
  }, [user.uid]);

  // Auto-update name whenever type/date/time change, unless user has manually edited it
  useEffect(() => {
    if (!nameTouched) {
      setEventName(formatDefaultName(eventType, eventDate, eventTime));
    }
  }, [eventType, eventDate, eventTime, nameTouched]);

  function handleNameChange(e) {
    setNameTouched(true);
    setEventName(e.target.value);
  }

  // Reset name to auto when user clears the field
  function handleNameBlur(e) {
    if (!e.target.value.trim()) {
      setNameTouched(false);
      setEventName(formatDefaultName(eventType, eventDate, eventTime));
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!eventDate || !eventTime || !eventName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const { id } = await createEvent(user.uid, eventName.trim(), eventType, eventDate, eventTime);
      navigate(`/event/${id}`);
    } catch (err) {
      console.error('createEvent error:', err);
      setCreateError(err.message || 'Failed to create event.');
      setCreating(false);
    }
  }

  const formReady = eventDate && eventTime && eventName.trim();

  return (
    <div className="page">
      <header className="page-header">
        <h1>🀄 Mahjong Scorekeeper</h1>
        <div className="header-right">
          <span className="user-name">{user.displayName}</span>
          <button onClick={logout} className="btn-secondary btn-sm">Sign out</button>
        </div>
      </header>

      <main className="page-main">
        <section className="card">
          <h2>New event</h2>
          <form onSubmit={handleCreate} className="event-form">

            <fieldset className="form-group">
              <legend>Event type</legend>
              <div className="type-options">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn-choice ${eventType === t.value ? 'selected' : ''} ${!t.enabled ? 'disabled' : ''}`}
                    disabled={!t.enabled}
                    onClick={() => t.enabled && setEventType(t.value)}
                    title={!t.enabled ? 'Coming soon' : undefined}
                  >
                    {t.label}
                    {!t.enabled && <span className="coming-soon">Soon</span>}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="form-row">
              <label>
                Date
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Start time
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              Event name
              <input
                value={eventName}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                placeholder="Auto-filled from type, date & time"
                required
              />
            </label>

            {createError && <p className="error">{createError}</p>}
            <button type="submit" className="btn-primary" disabled={creating || !formReady}>
              {creating ? 'Creating…' : 'Create event'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Your events</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : loadError ? (
            <p className="error">{loadError}</p>
          ) : events.length === 0 ? (
            <p className="muted">No events yet. Create one above.</p>
          ) : (
            <ul className="event-list">
              {events.map((evt) => (
                <li key={evt.id}>
                  <Link to={`/event/${evt.id}`} className="event-link">
                    <span className="event-name">{evt.name}</span>
                    <span className="event-date">
                      {evt.createdAt?.toDate
                        ? evt.createdAt.toDate().toLocaleDateString()
                        : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <Link to="/history" className="btn-secondary">View my hand history</Link>
        </section>
      </main>
    </div>
  );
}
