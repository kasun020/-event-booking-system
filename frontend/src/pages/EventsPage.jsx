import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/events';
import EventCard from '../components/EventCard';
import { useAuth } from '../context/AuthContext';

export default function EventsPage() {
  const { isOrganizer } = useAuth();
  const [events, setEvents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | published | upcoming | past
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsApi.getAll()
      .then((data) => {
        setEvents(data);
        setFiltered(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const now = new Date();
    let result = events;

    if (filter === 'published') result = result.filter((e) => e.isPublished);
    if (filter === 'upcoming') result = result.filter((e) => new Date(e.date) >= now);
    if (filter === 'past') result = result.filter((e) => new Date(e.date) < now);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.organizerName?.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [search, filter, events]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">{events.length} events available</p>
        </div>
        {isOrganizer && (
          <Link to="/events/create" id="create-event-link" className="btn-primary">
            + Create Event
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          id="events-search"
          type="search"
          placeholder="Search events, venues, organizers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <div className="filter-tabs">
          {['all', 'published', 'upcoming', 'past'].map((f) => (
            <button
              key={f}
              id={`filter-${f}`}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="events-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No events found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="events-grid">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
