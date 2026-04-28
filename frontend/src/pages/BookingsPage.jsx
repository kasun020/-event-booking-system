import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../api/bookings';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import BookingCard from '../components/BookingCard';

export default function BookingsPage() {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      bookingsApi.getAll().catch(() => []),
      eventsApi.getAll().catch(() => []),
    ]).then(([allBookings, allEvents]) => {
      const myBookings = isAdmin
        ? allBookings
        : allBookings.filter((b) => b.userId === user?.id);
      setBookings(myBookings);

      const eventMap = {};
      allEvents.forEach((e) => { eventMap[e.id] = e; });
      setEvents(eventMap);
    })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, isAdmin]);

  const grouped = bookings.reduce((acc, b) => {
    const status = b.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(b);
    return acc;
  }, {});

  const statusOrder = ['CONFIRMED', 'PAID', 'PENDING', 'FAILED', 'CANCELLED'];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'All Bookings' : 'My Bookings'}</h1>
          <p className="page-subtitle">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/events" className="btn-primary">Browse Events</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="bookings-grid">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎟</div>
          <h3>No bookings yet</h3>
          <p>Browse events and book your first ticket!</p>
          <Link to="/events" className="btn-primary">Browse Events</Link>
        </div>
      ) : (
        <div>
          {statusOrder.map((status) => {
            const items = grouped[status];
            if (!items || items.length === 0) return null;
            return (
              <div key={status} className="booking-group">
                <h3 className="booking-group-title">
                  {status} <span className="count-badge">{items.length}</span>
                </h3>
                <div className="bookings-grid">
                  {items.map((booking) => (
                    <div key={booking.id} className="booking-with-event">
                      {events[booking.eventId] && (
                        <div className="booking-event-header">
                          <Link to={`/events/${booking.eventId}`} className="booking-event-name">
                            🎭 {events[booking.eventId].name}
                          </Link>
                          <span className="booking-event-venue">
                            📍 {events[booking.eventId].venue}
                          </span>
                        </div>
                      )}
                      <BookingCard booking={booking} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
