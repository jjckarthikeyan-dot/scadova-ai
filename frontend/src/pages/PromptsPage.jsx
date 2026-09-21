import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function PromptsPage() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [comparePrompts, setComparePrompts] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadPrompts = () => {
    setLoading(true);
    apiFetch('/admin/prompt_versions')
      .then((data) => {
        if (Array.isArray(data)) setVersions(data);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handlePublish = async (id) => {
    try {
      await apiFetch(`/admin/prompt_versions/${id}/publish`, { method: 'POST' });
      setStatusMsg(`Prompt version published to live voice runtime!`);
      loadPrompts();
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (e) {
      alert('Publish error: ' + e.message);
    }
  };

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Prompt Version Management</h2>
            <p className="card-subtitle">
              Audit prompt iterations, review changed conversation rules, compare historical diffs, and restore versions.
            </p>
          </div>
        </div>

        {statusMsg && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', fontSize: 13, fontWeight: 600 }}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* PROMPT VERSIONS TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading prompt versions...
          </div>
        ) : versions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No prompt versions recorded yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Business ID</th>
                  <th>Changed Fields / Notes</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="badge badge-blue" style={{ fontWeight: 700 }}>
                        {v.version_label || `v1.${v.version_number || 0}`}
                      </span>
                    </td>
                    <td>Business #{v.business_id}</td>
                    <td style={{ maxWidth: 320 }}>
                      {typeof v.changed_fields === 'object' && v.changed_fields !== null
                        ? Object.entries(v.changed_fields).map(([k, val]) => `${k}: ${val}`).join(', ')
                        : 'Initial creation'}
                    </td>
                    <td>
                      <span className={`badge ${v.is_published ? 'badge-green' : 'badge-gray'}`}>
                        {v.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>{v.created_by || 'System'}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>
                      {v.created_at ? new Date(v.created_at).toLocaleString() : 'Just now'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedPrompt(v)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const prev = versions.find(item => item.id !== v.id) || v;
                            setComparePrompts({ current: v, previous: prev });
                          }}
                        >
                          Compare
                        </button>
                        {!v.is_published && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePublish(v.id)}
                          >
                            Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW PROMPT MODAL */}
      {selectedPrompt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div>
                <h3>Prompt Version {selectedPrompt.version_label || `v1.${selectedPrompt.version_number}`}</h3>
                <p className="card-subtitle">Business #{selectedPrompt.business_id} • Created by {selectedPrompt.created_by}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedPrompt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <pre style={{
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 16,
                borderRadius: 8,
                fontSize: 12.5,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                fontFamily: "'JetBrains Mono', monospace",
                maxHeight: 400,
                overflowY: 'auto'
              }}>
                {selectedPrompt.prompt_text}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedPrompt(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPARE PROMPTS MODAL */}
      {comparePrompts && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <div>
                <h3>Compare Prompt Versions</h3>
                <p className="card-subtitle">
                  Comparing {comparePrompts.current.version_label} against {comparePrompts.previous.version_label}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setComparePrompts(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>
                  Target: {comparePrompts.current.version_label}
                </h5>
                <pre style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: 14,
                  borderRadius: 8,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', monospace",
                  maxHeight: 380,
                  overflowY: 'auto'
                }}>
                  {comparePrompts.current.prompt_text}
                </pre>
              </div>

              <div>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>
                  Baseline: {comparePrompts.previous.version_label}
                </h5>
                <pre style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: 14,
                  borderRadius: 8,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'JetBrains Mono', monospace",
                  maxHeight: 380,
                  overflowY: 'auto'
                }}>
                  {comparePrompts.previous.prompt_text}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setComparePrompts(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
