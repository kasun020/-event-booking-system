import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsApi } from '../api/events';
import { bookingsApi } from '../api/bookings';

export default function DashboardPage() {
  const { user, isOrganizer, isAdmin } = useAuth();
  const [stats, setStats] = useState({ events: 0, bookings: 0 });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventsApi.getAll().catch(() => []),
      user ? bookingsApi.getAll().catch(() => []) : Promise.resolve([]),
    ]).then(([events, bookings]) => {
      const userBookings = bookings.filter((b) => b.userId === user?.id);
      setStats({ events: events.length, bookings: userBookings.length });
      setRecentEvents(events.slice(0, 3));
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="dashboard-hero">
        <div className="hero-orb hero-orb1" />
        <div className="hero-orb hero-orb2" />
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome back,{' '}
            <span className="gradient-text">{user?.name || 'Guest'}</span>
          </h1>
          <p className="hero-subtitle">
            Discover amazing events and manage your bookings all in one place.
          </p>
          <div className="hero-actions">
            <Link to="/events" id="browse-events-btn" className="btn-primary btn-lg">
              Browse Events
            </Link>
            {isOrganizer && (
              <Link to="/events/create" id="create-event-btn" className="btn-outline btn-lg">
                + Create Event
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {user && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎉</div>
            <div className="stat-value">{loading ? '—' : stats.events}</div>
            <div className="stat-label">Total Events</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎟</div>
            <div className="stat-value">{loading ? '—' : stats.bookings}</div>
            <div className="stat-label">My Bookings</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-value">{user.role}</div>
            <div className="stat-label">Account Type</div>
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="section">
        <div className="section-header">
          <h2>Recent Events</h2>
          <Link to="/events" className="section-link">View all →</Link>
        </div>

        {loading ? (
          <div className="loading-grid">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" />)}
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎭</div>
            <p>No events yet. Be the first to create one!</p>
            {isOrganizer && <Link to="/events/create" className="btn-primary">Create Event</Link>}
          </div>
        ) : (
          <div className="events-grid">
            {recentEvents.map((event) => {
              const date = new Date(event.date);
              return (
                <Link to={`/events/${event.id}`} key={event.id} className="event-card">
                  <div className="event-card-header">
                    <div className="event-date-badge">
                      <span className="event-day">{date.getDate()}</span>
                      <span className="event-month">{date.toLocaleString('default', { month: 'short' })}</span>
                    </div>
                    <span className={`badge ${event.isPublished ? 'badge-green' : 'badge-yellow'}`}>
                      {event.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="event-card-body">
                    <h3 className="event-name">{event.name}</h3>
                    {event.description && <p className="event-description">{event.description}</p>}
                    <div className="event-meta">
                      <div className="event-meta-item"><span className="meta-icon">📍</span><span>{event.venue}</span></div>
                      <div className="event-meta-item"><span className="meta-icon">👤</span><span>{event.organizerName}</span></div>
                    </div>
                  </div>
                  <div className="event-card-footer"><span className="view-details">View Details →</span></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Service Cards */}
      <div className="section">
        <h2 className="section-title">Services</h2>
        <div className="services-grid">
          <Link to="/events" className="service-card">
            <div className="service-icon">🎭</div>
            <div className="service-name">Events</div>
            <div className="service-desc">Browse and discover events</div>
            <div className="service-status online">● Online</div>
          </Link>
          <Link to="/bookings" className="service-card">
            <div className="service-icon">🎟</div>
            <div className="service-name">Bookings</div>
            <div className="service-desc">Manage your tickets</div>
            <div className="service-status online">● Online</div>
          </Link>
          <Link to="/payment" className="service-card service-card-disabled">
            <div className="service-icon">💳</div>
            <div className="service-name">Payment</div>
            <div className="service-desc">Secure payment processing</div>
            <div className="service-status offline">⏳ Coming Soon</div>
          </Link>
          <Link to="/notifications" className="service-card service-card-disabled">
            <div className="service-icon">🔔</div>
            <div className="service-name">Notifications</div>
            <div className="service-desc">Real-time alerts</div>
            <div className="service-status offline">⏳ Coming Soon</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
