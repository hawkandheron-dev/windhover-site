import './WelcomeDialog.css';

export function WelcomeDialog({ onStartTour, onDismiss, title = 'Welcome to the Church History Timeline' }) {
  return (
    <div className="welcome-overlay" onClick={onDismiss}>
      <div className="welcome-dialog" onClick={e => e.stopPropagation()}>
        <h2 className="welcome-title">{title}</h2>
        <p className="welcome-text">
          This interactive timeline maps the overlapping lifespans of key figures
          in church history — revealing how the faith was passed from generation
          to generation through personal, living connections.
        </p>
        <p className="welcome-text">
          Would you like a brief guided tour?
        </p>
        <div className="welcome-actions">
          <button className="welcome-btn welcome-btn-primary" onClick={onStartTour}>
            Take the Tour
          </button>
          <button className="welcome-btn welcome-btn-secondary" onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
