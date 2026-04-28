export default function BookingCard({ booking }) {
  const date = new Date(booking.createdAt);
  const formatted = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusColors = {
    PENDING: 'badge-yellow',
    PAID: 'badge-blue',
    CONFIRMED: 'badge-green',
    CANCELLED: 'badge-gray',
    FAILED: 'badge-red',
  };

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div>
          <div className="booking-id">#{booking.id.slice(0, 8)}…</div>
          <div className="booking-date">{formatted}</div>
        </div>
        <span className={`badge ${statusColors[booking.status] || 'badge-gray'}`}>
          {booking.status}
        </span>
      </div>

      <div className="booking-card-body">
        <div className="booking-detail">
          <span className="detail-label">Tier</span>
          <span className="detail-value tier-badge">{booking.tier}</span>
        </div>
        <div className="booking-detail">
          <span className="detail-label">Quantity</span>
          <span className="detail-value">{booking.quantity}</span>
        </div>
        <div className="booking-detail">
          <span className="detail-label">Total</span>
          <span className="detail-value amount">${Number(booking.totalAmount).toFixed(2)}</span>
        </div>
        {booking.paymentRef && (
          <div className="booking-detail">
            <span className="detail-label">Payment Ref</span>
            <span className="detail-value mono">{booking.paymentRef}</span>
          </div>
        )}
      </div>
    </div>
  );
}
