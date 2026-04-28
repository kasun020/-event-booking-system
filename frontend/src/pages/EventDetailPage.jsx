import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { ticketsApi } from '../api/tickets';
import { bookingsApi } from '../api/bookings';
import { useAuth } from '../context/AuthContext';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking state
  const [selectedTier, setSelectedTier] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    Promise.all([
      eventsApi.getById(id),
      ticketsApi.getByEvent(id),
    ])
      .then(([ev, inv]) => {
        setEvent(ev);
        setInventory(inv);
        if (inv.length > 0) setSelectedTier(inv[0].tier);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedInventory = inventory.find((i) => i.tier === selectedTier);
  const available = selectedInventory
    ? selectedInventory.totalStock - selectedInventory.reservedStock - selectedInventory.soldStock
    : 0;

  const handleBook = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    setBookingError('');
    setBookingLoading(true);
    try {
      const booking = await bookingsApi.create({
        userId: user.id,
        userEmail: user.email,
        eventId: id,
        ticketTier: selectedTier,
        quantity: Number(quantity),
      });
      setBookingSuccess(booking);
    } catch (err) {
      setBookingError(err.message || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton-detail" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error || 'Event not found'}</div>
      </div>
    );
  }

  const date = new Date(event.date);

  return (
    <div className="page-container">
      <button className="btn-ghost back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="event-detail-layout">
        {/* Event Info */}
        <div className="event-detail-main">
          <div className="event-detail-card">
            <div className="event-detail-header">
              <div className="event-detail-date">
                <div className="big-date-badge">
                  <span className="big-day">{date.getDate()}</span>
                  <span className="big-month">{date.toLocaleString('default', { month: 'long' })}</span>
                  <span className="big-year">{date.getFullYear()}</span>
                </div>
              </div>
              <div className="event-detail-badges">
                <span className={`badge ${event.isPublished ? 'badge-green' : 'badge-yellow'}`}>
                  {event.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>

            <h1 className="event-detail-title">{event.name}</h1>
            {event.description && (
              <p className="event-detail-desc">{event.description}</p>
            )}

            <div className="event-info-grid">
              <div className="info-item">
                <div className="info-label">📍 Venue</div>
                <div className="info-value">{event.venue}</div>
              </div>
              <div className="info-item">
                <div className="info-label">🕐 Date & Time</div>
                <div className="info-value">
                  {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {' at '}
                  {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="info-item">
                <div className="info-label">👤 Organizer</div>
                <div className="info-value">{event.organizerName}</div>
              </div>
              <div className="info-item">
                <div className="info-label">🎟 Capacity</div>
                <div className="info-value">{event.capacity} seats</div>
              </div>
            </div>
          </div>

          {/* Ticket Inventory */}
          <div className="tickets-section">
            <h2>Ticket Tiers</h2>
            {inventory.length === 0 ? (
              <div className="empty-state small">
                <p>No ticket tiers configured for this event yet.</p>
              </div>
            ) : (
              <div className="ticket-tiers">
                {inventory.map((inv) => {
                  const avail = inv.totalStock - inv.reservedStock - inv.soldStock;
                  return (
                    <div
                      key={inv.id}
                      className={`ticket-tier-card ${selectedTier === inv.tier ? 'selected' : ''} ${avail <= 0 ? 'sold-out' : ''}`}
                      onClick={() => avail > 0 && setSelectedTier(inv.tier)}
                    >
                      <div className="tier-name">{inv.tier}</div>
                      <div className="tier-price">${Number(inv.price).toFixed(2)}</div>
                      <div className={`tier-stock ${avail <= 0 ? 'out' : avail < 10 ? 'low' : 'ok'}`}>
                        {avail <= 0 ? 'Sold Out' : `${avail} available`}
                      </div>
                      <div className="tier-stats">
                        <span>Total: {inv.totalStock}</span>
                        <span>Sold: {inv.soldStock}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Booking Sidebar */}
        <div className="booking-sidebar">
          <div className="booking-box">
            <h2>Book Tickets</h2>

            {bookingSuccess ? (
              <div className="booking-success">
                <div className="success-icon">✅</div>
                <h3>Booking Confirmed!</h3>
                <p>Booking ID: <span className="mono">#{bookingSuccess.id.slice(0, 8)}</span></p>
                <p>Status: <span className={`badge badge-green`}>{bookingSuccess.status}</span></p>
                <p className="total-amount">Total: <strong>${Number(bookingSuccess.totalAmount).toFixed(2)}</strong></p>
                <button className="btn-primary btn-full" onClick={() => navigate('/bookings')}>
                  View My Bookings
                </button>
              </div>
            ) : (
              <form onSubmit={handleBook} className="booking-form">
                {inventory.length === 0 ? (
                  <p className="no-tickets-msg">No tickets available for this event.</p>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="tier-select">Ticket Tier</label>
                      <select
                        id="tier-select"
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(e.target.value)}
                      >
                        {inventory.map((inv) => {
                          const avail = inv.totalStock - inv.reservedStock - inv.soldStock;
                          return (
                            <option key={inv.id} value={inv.tier} disabled={avail <= 0}>
                              {inv.tier} — ${Number(inv.price).toFixed(2)} {avail <= 0 ? '(Sold Out)' : `(${avail} left)`}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="quantity-input">Quantity</label>
                      <input
                        id="quantity-input"
                        type="number"
                        min="1"
                        max={available}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>

                    {selectedInventory && (
                      <div className="price-summary">
                        <div className="price-row">
                          <span>Price per ticket</span>
                          <span>${Number(selectedInventory.price).toFixed(2)}</span>
                        </div>
                        <div className="price-row">
                          <span>Quantity</span>
                          <span>× {quantity}</span>
                        </div>
                        <div className="price-row total">
                          <span>Total</span>
                          <span>${(Number(selectedInventory.price) * Number(quantity)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {bookingError && (
                      <div className="form-error">{bookingError}</div>
                    )}

                    {!user ? (
                      <div>
                        <p className="login-prompt">Please log in to book tickets.</p>
                        <button
                          type="button"
                          className="btn-primary btn-full"
                          onClick={() => navigate('/login')}
                        >
                          Login to Book
                        </button>
                      </div>
                    ) : (
                      <button
                        id="book-now-btn"
                        type="submit"
                        className="btn-primary btn-full"
                        disabled={bookingLoading || available <= 0}
                      >
                        {bookingLoading ? <span className="btn-spinner" /> : 'Book Now'}
                      </button>
                    )}
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
