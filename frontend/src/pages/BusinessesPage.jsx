import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Building2, 
  MapPin, 
  Bot, 
  Activity, 
  Check, 
  X, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Sliders, 
  ShieldCheck 
} from 'lucide-react';
import { apiFetch } from '../api';

export default function BusinessesPage({ onOpenOnboarding }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [editingBiz, setEditingBiz] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [bannerNotice, setBannerNotice] = useState('');

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

  const handleOpenEdit = (biz) => {
    setEditingBiz({
      ...biz,
      type: biz.type || biz.business_type || 'Service and Appointment Booking',
      status: biz.status || 'active',
      language: biz.language || 'en',
    });
    setActiveTab('profile');
    setSaveError('');
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault();
    if (!editingBiz) return;
    setSaving(true);
    setSaveError('');

    try {
      const payload = {
        name: editingBiz.name?.trim(),
        type: editingBiz.type,
        business_type: editingBiz.type,
        status: editingBiz.status,
        industry: editingBiz.industry?.trim(),
        country: editingBiz.country?.trim(),
        timezone: editingBiz.timezone,
        phone: editingBiz.phone?.trim(),
        email: editingBiz.email?.trim(),
        website: editingBiz.website?.trim(),
        address: editingBiz.address?.trim(),
        description: editingBiz.description?.trim(),
        agent_name: editingBiz.agent_name?.trim(),
        fish_agent_id: editingBiz.fish_agent_id?.trim() || editingBiz.agent_id?.trim(),
        agent_id: editingBiz.fish_agent_id?.trim() || editingBiz.agent_id?.trim(),
        voice: editingBiz.voice?.trim(),
        voice_id: editingBiz.voice_id?.trim(),
        language: editingBiz.language,
        llm: editingBiz.llm?.trim(),
        prompt_version: editingBiz.prompt_version?.trim() || 'v1.0',
      };

      const updated = await apiFetch(`/admin/businesses/${editingBiz.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      // Update local state immediately
      setBusinesses((prev) =>
        prev.map((b) => (b.id === editingBiz.id ? { ...b, ...payload, ...(updated || {}) } : b))
      );
      if (selectedBiz && selectedBiz.id === editingBiz.id) {
        setSelectedBiz((prev) => ({ ...prev, ...payload, ...(updated || {}) }));
      }

      setEditingBiz(null);
      setBannerNotice(`Business '${payload.name}' updated successfully.`);
      setTimeout(() => setBannerNotice(''), 5000);

      // Notify other pages (dashboard, calls, usage)
      window.dispatchEvent(new Event('scadova:updated'));
    } catch (err) {
      setSaveError(err.message || 'Failed to update business');
    } finally {
      setSaving(false);
    }
  };

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

        {bannerNotice && (
          <div className="notice success" style={{ marginTop: 14 }}>
            {bannerNotice}
          </div>
        )}

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
                  <th style={{ minWidth: 200 }}>Actions</th>
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
                      <span className={`badge ${biz.status === 'inactive' ? 'badge-red' : 'badge-green'}`}>
                        {biz.status || 'active'}
                      </span>
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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedBiz(biz)}
                          title="View telemetry and details"
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ background: '#f1f5f9', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #cbd5e1' }}
                          onClick={() => handleOpenEdit(biz)}
                          title="Edit all fields of this business"
                        >
                          <Edit3 size={13} color="#2563eb" />
                          <span>Edit</span>
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onOpenOnboarding && onOpenOnboarding({ mode: 'agent', businessId: biz.id })}
                          title="Configure voice agent for this business"
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
                  <div><strong>Website:</strong> {selectedBiz.website ? <a href={selectedBiz.website} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{selectedBiz.website}</a> : 'N/A'}</div>
                  <div><strong>Address:</strong> {selectedBiz.address || 'N/A'}</div>
                  <div><strong>Timezone:</strong> {selectedBiz.timezone}</div>
                  {selectedBiz.description && <div><strong>Description:</strong> {selectedBiz.description}</div>}
                </div>
              </div>

              <div className="card" style={{ background: '#f8fafc' }}>
                <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Voice Agent & Runtime</h5>
                <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Assigned Agent:</strong> {selectedBiz.agent_name}</div>
                  <div><strong>Agent ID:</strong> <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{selectedBiz.agent_id || selectedBiz.fish_agent_id}</span></div>
                  <div><strong>Language:</strong> {selectedBiz.language?.toUpperCase()}</div>
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
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="btn btn-yellow"
                onClick={() => {
                  const target = selectedBiz;
                  setSelectedBiz(null);
                  handleOpenEdit(target);
                }}
              >
                <Edit3 size={14} style={{ marginRight: 6 }} />
                Edit Business
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedBiz(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* BEST-IN-CLASS EXECUTIVE EDIT BUSINESS MODAL */}
      {editingBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" role="dialog" aria-modal="true">
            {/* MODAL HEADER */}
            <div className="modal-header" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 42, 
                  height: 42, 
                  borderRadius: 10, 
                  background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Edit Business
                    </h3>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>
                      ID #{editingBiz.id}
                    </span>
                    <span className={`badge ${editingBiz.status === 'inactive' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 11 }}>
                      {editingBiz.status === 'active' ? 'Active' : editingBiz.status}
                    </span>
                  </div>
                  <p className="card-subtitle" style={{ margin: '2px 0 0 0', fontSize: 12 }}>
                    Update enterprise profile, contact credentials, and AI voice telephony runtime.
                  </p>
                </div>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setEditingBiz(null)} 
                disabled={saving}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* TAB NAVIGATION BAR */}
            <div className="edit-tabs-bar">
              <button
                type="button"
                className={`edit-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Building2 size={15} />
                <span>Enterprise Profile</span>
              </button>

              <button
                type="button"
                className={`edit-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
                onClick={() => setActiveTab('contact')}
              >
                <MapPin size={15} />
                <span>Contact & Location</span>
              </button>

              <button
                type="button"
                className={`edit-tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
                onClick={() => setActiveTab('voice')}
              >
                <Bot size={15} />
                <span>Voice Agent & AI</span>
              </button>

              <button
                type="button"
                className={`edit-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                <Activity size={15} />
                <span>Telemetry Overview</span>
              </button>
            </div>

            {/* MODAL FORM BODY */}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {saveError && (
                  <div className="notice error" style={{ margin: 0 }}>
                    {saveError}
                  </div>
                )}

                {/* TAB 1: ENTERPRISE PROFILE */}
                {activeTab === 'profile' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Building2 size={16} color="#2563eb" />
                        Enterprise Profile & Classification
                      </h4>
                      <span className="badge badge-gray">General Info</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <div className="edit-field-group">
                        <label>
                          <span>Business Name <span style={{ color: '#ef4444' }}>*</span></span>
                        </label>
                        <input
                          type="text"
                          required
                          className="form-control"
                          value={editingBiz.name || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, name: e.target.value })}
                          placeholder="e.g. Scadova Medical Clinic"
                        />
                        <small>Public registered enterprise or company name.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Business Type <span style={{ color: '#ef4444' }}>*</span></span>
                        </label>
                        <select
                          className="form-select"
                          value={editingBiz.type || 'Service and Appointment Booking'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, type: e.target.value })}
                        >
                          <option value="Service and Appointment Booking">Service and Appointment Booking</option>
                          <option value="Restaurant">Restaurant</option>
                          <option value="Loan Agency">Loan Agency</option>
                          <option value="Clinic">Clinic</option>
                          <option value="Custom">Custom Enterprise</option>
                        </select>
                        <small>Determines voice agent workflows, tools & department routing.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Operating Status</span>
                        </label>
                        <select
                          className="form-select"
                          value={editingBiz.status || 'active'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, status: e.target.value })}
                        >
                          <option value="active">Active (Operational & Routing Calls)</option>
                          <option value="inactive">Inactive (Paused)</option>
                          <option value="draft">Draft (Onboarding)</option>
                        </select>
                        <small>Inactive businesses will reject incoming telephony calls.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Industry Domain</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.industry || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, industry: e.target.value })}
                          placeholder="e.g. Healthcare & Consultation"
                        />
                        <small>Sector specialization for voice prompt tailoring.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Country</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.country || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, country: e.target.value })}
                          placeholder="e.g. United States, India, United Kingdom"
                        />
                        <small>Jurisdiction & currency localization.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Operating Timezone</span>
                        </label>
                        <select
                          className="form-select"
                          value={editingBiz.timezone || 'America/New_York'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, timezone: e.target.value })}
                        >
                          <option value="America/New_York">America/New_York (Eastern Time - US)</option>
                          <option value="America/Chicago">America/Chicago (Central Time - US)</option>
                          <option value="America/Denver">America/Denver (Mountain Time - US)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time - US)</option>
                          <option value="Asia/Kolkata">Asia/Kolkata (Indian Standard Time)</option>
                          <option value="Europe/London">Europe/London (GMT / BST)</option>
                          <option value="UTC">UTC (Coordinated Universal Time)</option>
                        </select>
                        <small>All appointments and booking slots calculate against this timezone.</small>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: CONTACT & LOCATION */}
                {activeTab === 'contact' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <MapPin size={16} color="#2563eb" />
                        Contact Credentials & Physical Location
                      </h4>
                      <span className="badge badge-gray">Reachability</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <div className="edit-field-group">
                        <label>
                          <span>Phone Number</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.phone || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, phone: e.target.value })}
                          placeholder="e.g. +1 205-549-3374"
                        />
                        <small>Primary phone line displayed to clients and callers.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Email Address</span>
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          value={editingBiz.email || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, email: e.target.value })}
                          placeholder="contact@business.com"
                        />
                        <small>Receipts, booking alerts, and administrative notifications.</small>
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Official Website URL</span>
                        </label>
                        <input
                          type="url"
                          className="form-control"
                          value={editingBiz.website || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                        <small>Used by the agent as a reference link when callers request online portals.</small>
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Headquarters / Physical Street Address</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.address || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, address: e.target.value })}
                          placeholder="Suite, Street Address, City, State, ZIP"
                        />
                        <small>Quoted directly by the AI agent when customers ask for location or directions.</small>
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Business Summary & Scope of Services</span>
                        </label>
                        <textarea
                          rows={3}
                          className="form-textarea"
                          style={{ resize: 'vertical' }}
                          value={editingBiz.description || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, description: e.target.value })}
                          placeholder="Comprehensive description of business capabilities, specialties, and customer service guidelines..."
                        />
                        <small>Injected into system prompts to enrich conversational intelligence.</small>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: VOICE AGENT & AI */}
                {activeTab === 'voice' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Bot size={16} color="#2563eb" />
                        Voice Agent & AI Telephony Runtime
                      </h4>
                      <span className="badge badge-blue">AI Routing</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <div className="edit-field-group">
                        <label>
                          <span>Assigned Agent Persona Name</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.agent_name || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, agent_name: e.target.value })}
                          placeholder="e.g. Scadova Specialist AI"
                        />
                        <small>Spoken identity introduced by the voice assistant during calls.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Fish Audio / Telephony Agent ID</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}
                          value={editingBiz.fish_agent_id || editingBiz.agent_id || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, fish_agent_id: e.target.value, agent_id: e.target.value })}
                          placeholder="agent_xxxxxxxx"
                        />
                        <small>Remote telephony provider link. Can be synced from Usage & Credits.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Primary Spoken Language</span>
                        </label>
                        <select
                          className="form-select"
                          value={editingBiz.language || 'en'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, language: e.target.value })}
                        >
                          <option value="en">English (US / Global)</option>
                          <option value="te">Telugu (India)</option>
                          <option value="hi">Hindi (India)</option>
                          <option value="es">Spanish (International)</option>
                          <option value="fr">French (International)</option>
                          <option value="de">German (International)</option>
                        </select>
                        <small>Base ASR and speech synthesis language model.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Voice Model Profile</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.voice || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, voice: e.target.value })}
                          placeholder="e.g. Marcus - Conversational English"
                        />
                        <small>Acoustic timbre, accent, and cadence profile.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>LLM Provider & Engine</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.llm || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, llm: e.target.value })}
                          placeholder="e.g. Scadova Runtime / scadova-routing-v1"
                        />
                        <small>Inference engine powering real-time conversation turns.</small>
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Prompt Version Identifier</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.prompt_version || 'v1.0'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, prompt_version: e.target.value })}
                          placeholder="v1.0"
                        />
                        <small>Prompt version tag tracked in API telemetry and logs.</small>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: TELEMETRY */}
                {activeTab === 'telemetry' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Activity size={16} color="#2563eb" />
                        Live Telemetry & Usage Snapshot
                      </h4>
                      <span className="badge badge-green">Live Metrics</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                      <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Recorded Calls</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{editingBiz.calls || 0}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Total incoming & outbound</div>
                      </div>

                      <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Talk Time</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>{editingBiz.minutes || '0.0'}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Cumulative minutes</div>
                      </div>

                      <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Appointments</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', margin: '4px 0' }}>{editingBiz.appointments || 0}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Confirmed bookings</div>
                      </div>

                      <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Expense</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>${Number(editingBiz.cost || 0).toFixed(2)}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Voice, LLM & telephony</div>
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                      <strong>Last Synchronized:</strong> {editingBiz.last_synced_at ? new Date(editingBiz.last_synced_at).toLocaleString() : 'Live'}
                      <br />
                      <strong>Database Key:</strong> <code style={{ color: '#2563eb' }}>{editingBiz.business_key}</code>
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  All updates save directly to Supabase in real-time.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingBiz(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {saving ? (
                      <>
                        <span className="spin">⟳</span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
