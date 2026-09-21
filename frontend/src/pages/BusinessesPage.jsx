import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '../api';

export default function BusinessesPage({ onOpenOnboarding }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBiz, setSelectedBiz] = useState(null);

  const loadBusinesses = () => {
    setLoading(true);
    apiFetch('/admin/businesses')
      .then((data) => {
        if (Array.isArray(data)) setBusinesses(data);
      })
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  const filtered = businesses.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.type?.toLowerCase().includes(search.toLowerCase()) ||
    b.industry?.toLowerCase().includes(search.toLowerCase()) ||
    b.country?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Businesses Management</h2>
            <p className="card-subtitle">
              Configured enterprise entities, voice agent runtime mapping, and department routing.
            </p>
          </div>
          <button className="btn btn-yellow" onClick={onOpenOnboarding}>
            <Plus size={16} />
            <span>+ Add New Business</span>
          </button>
        </div>

        <div className="search-filter-bar" style={{ marginTop: 16 }}>
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by business name, type, industry, or country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="badge badge-gray">{filtered.length} businesses</span>
        </div>
      </div>

      {/* BUSINESSES TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading businesses...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No matching businesses found.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Type</th>
                  <th>Industry</th>
                  <th>Country</th>
                  <th>Timezone</th>
                  <th>Status</th>
                  <th>Assigned Agent</th>
                  <th>Agent ID</th>
                  <th>Lang</th>
                  <th>Voice Model</th>
                  <th>LLM</th>
                  <th>Prompt Ver.</th>
                  <th>Calls</th>
                  <th>Minutes</th>
                  <th>Appointments</th>
                  <th>Leads</th>
                  <th>Cost</th>
                  <th>Last Sync</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((biz) => (
                  <tr key={biz.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {biz.name}
                    </td>
                    <td>
                      <span className={`badge ${
                        biz.type?.toLowerCase().includes('restaurant') ? 'badge-yellow' :
                        biz.type?.toLowerCase().includes('loan') || biz.type?.toLowerCase().includes('finance') ? 'badge-blue' : 'badge-green'
                      }`}>
                        {biz.type || 'Service and Appointment Booking'}
                      </span>
                    </td>
                    <td style={{ color: '#475569' }}>{biz.industry || 'General'}</td>
                    <td>{biz.country || 'USA'}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{biz.timezone || 'UTC'}</td>
                    <td>
                      <span className="badge badge-green">{biz.status || 'active'}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{biz.agent_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb' }}>
                      {biz.agent_id || biz.fish_agent_id ? (biz.agent_id || biz.fish_agent_id).substring(0, 14) + '...' : '—'}
                    </td>
                    <td>
                      <span className="badge badge-gray">{biz.language?.toUpperCase() || 'EN'}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{biz.voice || 'Serena'}</td>
                    <td style={{ fontSize: 11, color: '#475569' }}>{biz.llm || 'Scadova Runtime'}</td>
                    <td>
                      <span className="badge badge-blue">{biz.prompt_version || 'v1.0'}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{biz.calls || 0}</td>
                    <td>{biz.minutes || '0.0'}</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{biz.appointments || 0}</td>
                    <td style={{ fontWeight: 600, color: '#f59e0b' }}>{biz.leads || 0}</td>
                    <td style={{ fontWeight: 600 }}>${Number(biz.cost || 0).toFixed(2)}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>
                      {biz.last_synced_at ? new Date(biz.last_synced_at).toLocaleDateString() : 'Just now'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedBiz(biz)}
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenOnboarding && onOpenOnboarding({ mode: 'agent', businessId: biz.id })}
                          title="Create a local voice agent for this business"
                        >
                          + Voice Agent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BUSINESS DETAILS MODAL */}
      {selectedBiz && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3>{selectedBiz.name}</h3>
                <p className="card-subtitle">{selectedBiz.type} • {selectedBiz.country}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedBiz(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ background: '#f8fafc' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Contact & Location</h5>
                <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Phone:</strong> {selectedBiz.phone || 'N/A'}</div>
                  <div><strong>Email:</strong> {selectedBiz.email || 'N/A'}</div>
                  <div><strong>Website:</strong> {selectedBiz.website || 'N/A'}</div>
                  <div><strong>Address:</strong> {selectedBiz.address || 'N/A'}</div>
                  <div><strong>Timezone:</strong> {selectedBiz.timezone}</div>
                </div>
              </div>

              <div className="card" style={{ background: '#f8fafc' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Voice Agent & Runtime</h5>
                <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Assigned Agent:</strong> {selectedBiz.agent_name}</div>
                  <div><strong>Agent ID:</strong> <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{selectedBiz.agent_id || selectedBiz.fish_agent_id}</span></div>
                  <div><strong>Voice Model:</strong> {selectedBiz.voice}</div>
                  <div><strong>LLM Engine:</strong> {selectedBiz.llm}</div>
                  <div><strong>Prompt Version:</strong> {selectedBiz.prompt_version}</div>
                </div>
              </div>

              <div className="card" style={{ background: '#f8fafc' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Operational Telemetry</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Calls</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedBiz.calls || 0}</div>
                  </div>
                  <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Minutes</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedBiz.minutes || 0}</div>
                  </div>
                  <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Bookings</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{selectedBiz.appointments || 0}</div>
                  </div>
                  <div style={{ padding: 8, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Total Cost</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>${Number(selectedBiz.cost || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedBiz(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
