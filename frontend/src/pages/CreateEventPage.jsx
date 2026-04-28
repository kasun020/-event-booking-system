import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { ticketsApi } from '../api/tickets';
import { useAuth } from '../context/AuthContext';

export default function CreateEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    venue: '',
    capacity: '',
    isPublished: false,
  });

  const [tiers, setTiers] = useState([
    { tier: 'GENERAL', price: '', totalStock: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [createdEvent, setCreatedEvent] = useState(null);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleTierChange = (index, field, value) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const addTier = () => {
    const existing = tiers.map((t) => t.tier);
    const options = ['GENERAL', 'VIP'];
    const remaining = options.filter((o) => !existing.includes(o));
    if (remaining.length === 0) return;
    setTiers((prev) => [...prev, { tier: remaining[0], price: '', totalStock: '' }]);
  };

  const removeTier = (index) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const event = await eventsApi.create({
        ...form,
        capacity: Number(form.capacity),
        organizerName: user.name,
      });
      setCreatedEvent(event);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await Promise.all(
        tiers
          .filter((t) => t.price && t.totalStock)
          .map((t) =>
            ticketsApi.create({
              eventId: createdEvent.id,
              tier: t.tier,
              price: Number(t.price),
              totalStock: Number(t.totalStock),
            })
          )
      );
      navigate(`/events/${createdEvent.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Event</h1>
          <p className="page-subtitle">Fill in the details to create your event</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="steps-indicator">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          <span>Event Details</span>
        </div>
        <div className="step-line" />
        <div className={`step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-circle">2</div>
          <span>Ticket Tiers</span>
        </div>
      </div>

      {step === 1 && (
        <form onSubmit={handleEventSubmit} className="form-card">
          <div className="form-grid">
            <div className="form-group span-2">
              <label htmlFor="event-name">Event Name *</label>
              <input
                id="event-name"
                type="text"
                name="name"
                placeholder="My Awesome Event"
                value={form.name}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group span-2">
              <label htmlFor="event-desc">Description</label>
              <textarea
                id="event-desc"
                name="description"
                placeholder="Tell attendees about your event…"
                value={form.description}
                onChange={handleFormChange}
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="event-date">Date & Time *</label>
              <input
                id="event-date"
                type="datetime-local"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event-venue">Venue *</label>
              <input
                id="event-venue"
                type="text"
                name="venue"
                placeholder="Convention Center, City"
                value={form.venue}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event-capacity">Total Capacity *</label>
              <input
                id="event-capacity"
                type="number"
                name="capacity"
                placeholder="500"
                min="1"
                value={form.capacity}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event-published" className="checkbox-label">
                <input
                  id="event-published"
                  type="checkbox"
                  name="isPublished"
                  checked={form.isPublished}
                  onChange={handleFormChange}
                />
                <span>Publish immediately</span>
              </label>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button id="create-event-next" type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : 'Next: Add Tickets →'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleTicketsSubmit} className="form-card">
          <div className="success-banner">
            <span>✅</span>
            <div>
              <strong>{createdEvent?.name}</strong> created successfully!
              <div className="subtle">Now add ticket tiers (optional — you can skip)</div>
            </div>
          </div>

          <h3>Ticket Tiers</h3>
          <div className="tiers-list">
            {tiers.map((tier, index) => (
              <div key={index} className="tier-form-row">
                <div className="form-group">
                  <label>Tier</label>
                  <select
                    value={tier.tier}
                    onChange={(e) => handleTierChange(index, 'tier', e.target.value)}
                  >
                    <option value="GENERAL">GENERAL</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    placeholder="29.99"
                    min="0"
                    step="0.01"
                    value={tier.price}
                    onChange={(e) => handleTierChange(index, 'price', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Total Stock</label>
                  <input
                    type="number"
                    placeholder="100"
                    min="1"
                    value={tier.totalStock}
                    onChange={(e) => handleTierChange(index, 'totalStock', e.target.value)}
                  />
                </div>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={() => removeTier(index)}
                    title="Remove tier"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {tiers.length < 2 && (
            <button type="button" className="btn-ghost" onClick={addTier}>
              + Add Tier (VIP/General)
            </button>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate(`/events/${createdEvent.id}`)}
            >
              Skip
            </button>
            <button id="save-tickets-btn" type="submit" className="btn-primary" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : 'Save & View Event'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
