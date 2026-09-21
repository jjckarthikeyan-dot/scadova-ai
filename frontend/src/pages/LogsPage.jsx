import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState('ALL');

  useEffect(() => {
    apiFetch('/admin/logs')
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((l) =>
    filterLevel === 'ALL' || l.level?.toLowerCase() === filterLevel.toLowerCase()
  );

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>System & Runtime Event Logs</h2>
            <p className="card-subtitle">
              Audit trail of voice agent state changes, local runtime events, and router executions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((lvl) => (
              <button
                key={lvl}
                className={`btn btn-sm ${filterLevel === lvl ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LOGS TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading system logs...
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Level</th>
                  <th>Source Subsystem</th>
                  <th>Event Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`badge ${
                        l.level === 'error' ? 'badge-red' :
                        l.level === 'warning' ? 'badge-yellow' : 'badge-green'
                      }`}>
                        {l.level?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{l.source}</td>
                    <td style={{ color: '#0f172a' }}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
