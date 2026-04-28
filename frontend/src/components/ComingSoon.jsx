export default function ComingSoon({ service, icon, description }) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-orb orb1" />
      <div className="coming-soon-orb orb2" />

      <div className="coming-soon-content">
        <div className="coming-soon-icon">{icon || '🚀'}</div>
        <div className="coming-soon-badge">Coming Soon</div>
        <h1 className="coming-soon-title">{service}</h1>
        <p className="coming-soon-desc">
          {description || `The ${service} is currently being deployed by the backend team. It will be available shortly.`}
        </p>

        <div className="coming-soon-features">
          <div className="feature-item">
            <span className="feature-dot" />
            <span>Backend integration in progress</span>
          </div>
          <div className="feature-item">
            <span className="feature-dot" />
            <span>Expected availability: Soon™</span>
          </div>
          <div className="feature-item">
            <span className="feature-dot" />
            <span>Service endpoint reserved</span>
          </div>
        </div>

        <div className="coming-soon-status">
          <div className="status-dot pulse" />
          <span>Deployment in progress…</span>
        </div>
      </div>
    </div>
  );
}
