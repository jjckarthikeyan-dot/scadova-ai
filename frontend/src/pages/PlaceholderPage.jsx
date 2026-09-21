export default function PlaceholderPage({ title, icon, description }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p className="page-subtitle">{description}</p>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}
