import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  const date = new Date(event.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isPast = date < new Date();

  return (
    <Link to={`/events/${event.id}`} className="event-card">
      <div className="event-card-header">
        <div className="event-date-badge">
          <span className="event-day">{date.getDate()}</span>
          <span className="event-month">{date.toLocaleString('default', { month: 'short' })}</span>
        </div>
        <div className="event-status-badges">
          {event.isPublished ? (
            <span className="badge badge-green">Published</span>
          ) : (
            <span className="badge badge-yellow">Draft</span>
          )}
          {isPast && <span className="badge badge-gray">Past</span>}
        </div>
      </div>

      <div className="event-card-body">
        <h3 className="event-name">{event.name}</h3>
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        <div className="event-meta">
          <div className="event-meta-item">
            <span className="meta-icon">📍</span>
            <span>{event.venue}</span>
          </div>
          <div className="event-meta-item">
            <span className="meta-icon">🕐</span>
            <span>{formattedDate} · {formattedTime}</span>
          </div>
          <div className="event-meta-item">
            <span className="meta-icon">👤</span>
            <span>{event.organizerName}</span>
          </div>
          <div className="event-meta-item">
            <span className="meta-icon">🎟</span>
            <span>Capacity: {event.capacity}</span>
          </div>
        </div>
      </div>

      <div className="event-card-footer">
        <span className="view-details">View Details →</span>
      </div>
    </Link>
  );
}
