import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [search, setSearch] = useState('');

  const loadCalls = () => {
    setLoading(true);
    apiFetch('/admin/call_logs')
      .then((data) => {
        if (Array.isArray(data)) setCalls(data);
      })
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalls();
  }, []);

  const filtered = calls.filter((c) =>
    c.caller?.toLowerCase().includes(search.toLowerCase()) ||
    c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.outcome?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Voice Calls & Audio Telemetry</h2>
            <p className="card-subtitle">
              Granular call logs, historical configuration snapshots, audio recordings, transcripts, and unit economics.
            </p>
          </div>
          <span className="badge badge-blue">{filtered.length} calls logged</span>
        </div>

        <div className="search-filter-bar" style={{ marginTop: 16 }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by caller, business, agent, or outcome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* CALLS TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading call logs...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No calls recorded.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Agent</th>
                  <th>Direction</th>
                  <th>Caller</th>
                  <th>Duration</th>
                  <th>Minutes</th>
                  <th>Outcome</th>
                  <th>Voice Model</th>
                  <th>LLM Engine</th>
                  <th>Prompt</th>
                  <th>Total Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((call) => (
                  <tr key={call.id}>
                    <td style={{ fontWeight: 600 }}>{call.business_name}</td>
                    <td>{call.agent_name}</td>
                    <td>
                      <span className={`badge ${call.direction === 'inbound' ? 'badge-blue' : 'badge-gray'}`}>
                        {call.direction}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{call.caller}</td>
                    <td>{call.duration_seconds}s</td>
                    <td style={{ fontWeight: 600 }}>{call.billable_minutes}m</td>
                    <td>
                      <span className="badge badge-green">{call.outcome}</span>
                    </td>
                    <td>{call.voice_name || 'Serena'}</td>
                    <td style={{ fontSize: 11, color: '#475569' }}>{call.llm_model || 'scadova-routing-v1'}</td>
                    <td>
                      <span className="badge badge-yellow">{call.prompt_version || 'v1.0'}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      ${Number(call.total_cost || 0).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT CALL MODAL (SNAPSHOT + TRANSCRIPT + RECORDING) */}
      {selectedCall && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div>
                <h3>Call Inspection: {selectedCall.caller}</h3>
                <p className="card-subtitle">
                  {selectedCall.business_name} • {selectedCall.start_time ? new Date(selectedCall.start_time).toLocaleString() : 'Just now'}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedCall(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* HISTORICAL SNAPSHOT */}
              <div className="card" style={{ background: '#f8fafc' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📸</span>
                  <span>Agent Configuration Snapshot at Call Time</span>
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, fontSize: 12 }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Voice ID:</span><br />
                    <strong>{selectedCall.config_snapshot?.voice_id || selectedCall.voice_id || 'scadova_voice_en_neutral'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>LLM Model:</span><br />
                    <strong>{selectedCall.config_snapshot?.llm_model || selectedCall.llm_model || 'scadova-routing-v1'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Prompt Version:</span><br />
                    <strong className="badge badge-yellow">{selectedCall.config_snapshot?.prompt_version || selectedCall.prompt_version || 'v1.0'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Agent ID:</span><br />
                    <strong style={{ fontFamily: 'monospace', color: '#2563eb' }}>{selectedCall.agent_id || selectedCall.fish_agent_id || 'agent_01'}</strong>
                  </div>
                </div>
              </div>

              {/* COST BREAKDOWN */}
              <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Cost Breakdown (USD)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Voice Runtime</div>
                    <div style={{ fontWeight: 700 }}>${Number(selectedCall.voice_cost || 0.08).toFixed(3)}</div>
                  </div>
                  <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>LLM Tokens</div>
                    <div style={{ fontWeight: 700 }}>${Number(selectedCall.llm_cost || 0.02).toFixed(3)}</div>
                  </div>
                  <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Telephony Trunk</div>
                    <div style={{ fontWeight: 700 }}>${Number(selectedCall.telephony_cost || 0.06).toFixed(3)}</div>
                  </div>
                  <div style={{ padding: 8, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: 11, color: '#1d4ed8' }}>Total Billable</div>
                    <div style={{ fontWeight: 800, color: '#1d4ed8' }}>${Number(selectedCall.total_cost || 0.16).toFixed(3)}</div>
                  </div>
                </div>
              </div>

              {/* TRANSCRIPT */}
              <div>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Conversation Transcript</h5>
                <pre style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', monospace",
                  maxHeight: 220,
                  overflowY: 'auto'
                }}>
                  {selectedCall.transcript || 'Transcript processing...'}
                </pre>
              </div>

              {/* SUMMARY */}
              <div style={{ fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong>Disposition Summary:</strong> {selectedCall.summary || 'Call handled successfully.'}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCall(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
