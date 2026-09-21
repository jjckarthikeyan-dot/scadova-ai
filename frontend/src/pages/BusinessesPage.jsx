import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
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
  AlertTriangle, 
  Eye, 
  Sliders, 
  Calendar, 
  Users, 
  FileText 
} from 'lucide-react';
import { apiFetch } from '../api';

export default function BusinessesPage({ onOpenOnboarding }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBiz, setSelectedBiz] = useState(null); // Business Profile modal
  const [editingBiz, setEditingBiz] = useState(null);   // Edit Form modal
  const [deletingBiz, setDeletingBiz] = useState(null); // Delete confirmation modal
  const [editTab, setEditTab] = useState('profile');
  const [profileTab, setProfileTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
    setEditTab('profile');
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

      window.dispatchEvent(new Event('scadova:updated'));
    } catch (err) {
      setSaveError(err.message || 'Failed to update business');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!deletingBiz) return;
    setDeleting(true);
    setDeleteError('');

    try {
      await apiFetch(`/admin/businesses/${deletingBiz.id}`, {
        method: 'DELETE',
      });

      setBusinesses((prev) => prev.filter((b) => b.id !== deletingBiz.id));
      if (selectedBiz && selectedBiz.id === deletingBiz.id) setSelectedBiz(null);
      if (editingBiz && editingBiz.id === deletingBiz.id) setEditingBiz(null);

      const deletedName = deletingBiz.name;
      setDeletingBiz(null);
      setBannerNotice(`Business '${deletedName}' and all related data were permanently deleted.`);
      setTimeout(() => setBannerNotice(''), 5000);

      window.dispatchEvent(new Event('scadova:updated'));
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete business');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = businesses.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.type?.toLowerCase().includes(search.toLowerCase()) ||
    b.country?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search)
  );

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Businesses Management</h2>
            <p className="card-subtitle">
              Configured enterprise entities, department routing, and live voice operations.
            </p>
          </div>
          <button className="btn btn-yellow" onClick={onOpenOnboarding}>
            <Plus size={16} />
            <span>+ Add New Business</span>
          </button>
        </div>

        {bannerNotice && (
          <div className="notice success" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} color="#16a34a" />
            <span>{bannerNotice}</span>
          </div>
        )}

        <div className="search-filter-bar" style={{ marginTop: 16 }}>
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by business name, type, country, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="badge badge-gray">{filtered.length} businesses</span>
        </div>
      </div>

      {/* CLEAN, FOCUSED BUSINESSES TABLE (NO CLUTTER) */}
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
                  <th style={{ minWidth: 220 }}>Business</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Phone / Contact</th>
                  <th>Calls & Minutes</th>
                  <th>Last Sync</th>
                  <th style={{ textAlign: 'right', minWidth: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((biz) => (
                  <tr key={biz.id}>
                    {/* 1. BUSINESS NAME + COUNTRY & TIMEZONE */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0
                        }}>
                          {biz.name ? biz.name.charAt(0).toUpperCase() : 'B'}
                        </div>
                        <div>
                          <div 
                            style={{ fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}
                            onClick={() => setSelectedBiz(biz)}
                            title="Click to view full Business Profile"
                          >
                            {biz.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {biz.country || 'USA'} • {biz.timezone || 'UTC'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. CATEGORY / TYPE */}
                    <td>
                      <span className={`badge ${
                        biz.type?.toLowerCase().includes('restaurant') ? 'badge-yellow' :
                        biz.type?.toLowerCase().includes('loan') || biz.type?.toLowerCase().includes('finance') ? 'badge-blue' : 'badge-green'
                      }`}>
                        {biz.type || 'Service and Appointment Booking'}
                      </span>
                    </td>

                    {/* 3. OPERATING STATUS */}
                    <td>
                      <span className={`badge ${biz.status === 'inactive' ? 'badge-red' : 'badge-green'}`}>
                        {biz.status === 'active' ? 'Active' : (biz.status || 'Active')}
                      </span>
                    </td>

                    {/* 4. PHONE / CONTACT */}
                    <td>
                      <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                        {biz.phone || <span style={{ color: '#94a3b8' }}>No phone set</span>}
                      </div>
                      {biz.email && (
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {biz.email}
                        </div>
                      )}
                    </td>

                    {/* 5. CALLS & TALK TIME */}
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {biz.calls || 0} calls
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {biz.minutes || '0.0'} min • ${Number(biz.cost || 0).toFixed(2)}
                      </div>
                    </td>

                    {/* 6. LAST SYNC */}
                    <td style={{ fontSize: 11, color: '#64748b' }}>
                      {biz.last_synced_at ? new Date(biz.last_synced_at).toLocaleDateString() : 'Live'}
                    </td>

                    {/* 7. ACTIONS (PROFILE, EDIT, DELETE) */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedBiz(biz)}
                          title="Open complete Business Profile with all voice agent, appointments, and telemetry details"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={13} />
                          <span>Profile</span>
                        </button>
                        
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ background: '#f8fafc', color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #cbd5e1' }}
                          onClick={() => handleOpenEdit(biz)}
                          title="Edit this business"
                        >
                          <Edit3 size={13} color="#2563eb" />
                          <span>Edit</span>
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeletingBiz(biz)}
                          title="Delete business and all related records"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
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

      {/* ============================================================ */}
      {/* 1. COMPREHENSIVE BUSINESS PROFILE MODAL                       */}
      {/* (Holds Industry, Voice Model, Agent, LLM, Appointments, Leads) */}
      {/* ============================================================ */}
      {selectedBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" role="dialog" aria-modal="true" style={{ maxWidth: 780 }}>
            {/* PROFILE HEADER */}
            <div className="modal-header" style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                }}>
                  {selectedBiz.name ? selectedBiz.name.charAt(0).toUpperCase() : 'B'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                      {selectedBiz.name}
                    </h3>
                    <span className="badge badge-blue">ID #{selectedBiz.id}</span>
                    <span className={`badge ${selectedBiz.status === 'inactive' ? 'badge-red' : 'badge-green'}`}>
                      {selectedBiz.status === 'active' ? 'Active' : (selectedBiz.status || 'Active')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {selectedBiz.type} • {selectedBiz.country} • Key: <code style={{ color: '#2563eb' }}>{selectedBiz.business_key}</code>
                  </div>
                </div>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setSelectedBiz(null)}
                aria-label="Close profile"
              >
                <X size={20} />
              </button>
            </div>

            {/* PROFILE TAB BAR */}
            <div className="edit-tabs-bar">
              <button
                type="button"
                className={`edit-tab-btn ${profileTab === 'overview' ? 'active' : ''}`}
                onClick={() => setProfileTab('overview')}
              >
                <Building2 size={15} />
                <span>Enterprise Overview & Industry</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${profileTab === 'agent' ? 'active' : ''}`}
                onClick={() => setProfileTab('agent')}
              >
                <Bot size={15} />
                <span>Assigned Agent, Voice & LLM</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${profileTab === 'operations' ? 'active' : ''}`}
                onClick={() => setProfileTab('operations')}
              >
                <Calendar size={15} />
                <span>Appointments, Leads & Metrics</span>
              </button>
            </div>

            {/* PROFILE BODY */}
            <div className="modal-body" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* TAB 1: OVERVIEW & INDUSTRY */}
              {profileTab === 'overview' && (
                <>
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Building2 size={16} color="#2563eb" />
                        Enterprise Profile & Industry
                      </h4>
                      <span className="badge badge-gray">Profile</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Industry Domain</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.industry || 'General Industry'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Business Type</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.type}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Country</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.country || 'USA'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Operating Timezone</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.timezone || 'UTC'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <MapPin size={16} color="#2563eb" />
                        Contact Credentials & Address
                      </h4>
                      <span className="badge badge-gray">Location</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Phone Number</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.phone || 'N/A'}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Email Address</strong>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedBiz.email || 'N/A'}</span>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Website URL</strong>
                        {selectedBiz.website ? (
                          <a href={selectedBiz.website} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                            {selectedBiz.website}
                          </a>
                        ) : 'N/A'}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Physical Address</strong>
                        <span style={{ color: '#0f172a' }}>{selectedBiz.address || 'N/A'}</span>
                      </div>
                      {selectedBiz.description && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block' }}>Description & Scope</strong>
                          <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 12.5, lineHeight: 1.5 }}>
                            {selectedBiz.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: ASSIGNED AGENT, VOICE MODEL & LLM */}
              {profileTab === 'agent' && (
                <div className="edit-section-card">
                  <div className="edit-section-header">
                    <h4>
                      <Bot size={16} color="#2563eb" />
                      Assigned Voice Agent, Telephony & LLM Engine
                    </h4>
                    <span className="badge badge-blue">AI Routing</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                    <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Assigned Agent Name
                      </strong>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                        {selectedBiz.agent_name || 'No agent assigned'}
                      </span>
                    </div>

                    <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Agent ID / Fish Audio ID
                      </strong>
                      <code style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>
                        {selectedBiz.agent_id || selectedBiz.fish_agent_id || 'Not configured'}
                      </code>
                    </div>

                    <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Voice Model Profile
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.voice || 'Serena - Executive English'}
                      </span>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Language: {selectedBiz.language?.toUpperCase() || 'EN'}
                      </div>
                    </div>

                    <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        LLM Engine / Provider
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.llm || 'Scadova Runtime / scadova-routing-v1'}
                      </span>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Prompt Version: {selectedBiz.prompt_version || 'v1.0'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: APPOINTMENTS, LEADS & METRICS */}
              {profileTab === 'operations' && (
                <div className="edit-section-card">
                  <div className="edit-section-header">
                    <h4>
                      <Activity size={16} color="#2563eb" />
                      Appointments, Leads & Telemetry Performance
                    </h4>
                    <span className="badge badge-green">Operations</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                    <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Appointments</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', margin: '4px 0' }}>{selectedBiz.appointments || 0}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Confirmed bookings</div>
                    </div>

                    <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Leads Captured</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>{selectedBiz.leads || 0}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Active prospects</div>
                    </div>

                    <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Calls</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{selectedBiz.calls || 0}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Inbound & outbound</div>
                    </div>

                    <div style={{ padding: 14, background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Cost</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: '4px 0' }}>${Number(selectedBiz.cost || 0).toFixed(2)}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Talk & AI expense</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE FOOTER */}
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const target = selectedBiz;
                  setSelectedBiz(null);
                  setDeletingBiz(target);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} />
                <span>Delete Business</span>
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const target = selectedBiz;
                    setSelectedBiz(null);
                    handleOpenEdit(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Edit3 size={14} />
                  <span>Edit Business</span>
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedBiz(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. EDIT BUSINESS FORM MODAL                                  */}
      {/* ============================================================ */}
      {editingBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" role="dialog" aria-modal="true">
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
                  <Edit3 size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Edit: {editingBiz.name}
                    </h3>
                    <span className="badge badge-blue">ID #{editingBiz.id}</span>
                  </div>
                  <p className="card-subtitle" style={{ margin: '2px 0 0 0', fontSize: 12 }}>
                    Update enterprise details, assigned voice agent, and AI settings.
                  </p>
                </div>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setEditingBiz(null)} 
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="edit-tabs-bar">
              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'profile' ? 'active' : ''}`}
                onClick={() => setEditTab('profile')}
              >
                <Building2 size={15} />
                <span>Enterprise Profile</span>
              </button>

              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'contact' ? 'active' : ''}`}
                onClick={() => setEditTab('contact')}
              >
                <MapPin size={15} />
                <span>Contact & Location</span>
              </button>

              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'voice' ? 'active' : ''}`}
                onClick={() => setEditTab('voice')}
              >
                <Bot size={15} />
                <span>Voice Agent & Telephony</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {saveError && (
                  <div className="notice error" style={{ margin: 0 }}>
                    {saveError}
                  </div>
                )}

                {/* EDIT TAB 1: PROFILE */}
                {editTab === 'profile' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Building2 size={16} color="#2563eb" />
                        Enterprise Profile & Industry
                      </h4>
                      <span className="badge badge-gray">Required Fields</span>
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
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Business Category / Type <span style={{ color: '#ef4444' }}>*</span></span>
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
                          <option value="active">Active (Operational & Routing)</option>
                          <option value="inactive">Inactive (Paused)</option>
                          <option value="draft">Draft (Onboarding)</option>
                        </select>
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
                          placeholder="e.g. Fine Dining, Healthcare, NBFC Finance"
                        />
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
                          placeholder="e.g. United States, India"
                        />
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
                          <option value="America/New_York">America/New_York (Eastern)</option>
                          <option value="America/Chicago">America/Chicago (Central)</option>
                          <option value="America/Denver">America/Denver (Mountain)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* EDIT TAB 2: CONTACT */}
                {editTab === 'contact' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <MapPin size={16} color="#2563eb" />
                        Contact Credentials & Address
                      </h4>
                      <span className="badge badge-gray">Contact</span>
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
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Website URL</span>
                        </label>
                        <input
                          type="url"
                          className="form-control"
                          value={editingBiz.website || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, website: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Headquarters Address</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.address || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, address: e.target.value })}
                          placeholder="Suite, Street Address, City, State, ZIP"
                        />
                      </div>

                      <div className="edit-field-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                          <span>Business Summary & Scope</span>
                        </label>
                        <textarea
                          rows={3}
                          className="form-textarea"
                          style={{ resize: 'vertical' }}
                          value={editingBiz.description || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, description: e.target.value })}
                          placeholder="Brief description of enterprise offerings, policies, and guidelines..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* EDIT TAB 3: VOICE AGENT & AI */}
                {editTab === 'voice' && (
                  <div className="edit-section-card">
                    <div className="edit-section-header">
                      <h4>
                        <Bot size={16} color="#2563eb" />
                        Voice Agent, Telephony & LLM Runtime
                      </h4>
                      <span className="badge badge-blue">AI Telephony</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <div className="edit-field-group">
                        <label>
                          <span>Assigned Agent Name</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.agent_name || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, agent_name: e.target.value })}
                          placeholder="e.g. Scadova Specialist AI"
                        />
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Telephony / Fish Audio Agent ID</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}
                          value={editingBiz.fish_agent_id || editingBiz.agent_id || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, fish_agent_id: e.target.value, agent_id: e.target.value })}
                          placeholder="agent_xxxxxxxx"
                        />
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
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>LLM Engine / Provider</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.llm || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, llm: e.target.value })}
                          placeholder="e.g. Scadova Runtime / scadova-routing-v1"
                        />
                      </div>

                      <div className="edit-field-group">
                        <label>
                          <span>Prompt Version</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={editingBiz.prompt_version || 'v1.0'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, prompt_version: e.target.value })}
                          placeholder="v1.0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* EDIT FOOTER */}
              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  Changes synchronize across database and voice runtime immediately.
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
                    style={{ minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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

      {/* ============================================================ */}
      {/* 3. DELETE CONFIRMATION MODAL                                  */}
      {/* ============================================================ */}
      {deletingBiz && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  background: '#fee2e2', 
                  color: '#ef4444', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#991b1b', margin: 0 }}>
                    Delete Business
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0, fontSize: 12 }}>
                    Permanent cascade deletion
                  </p>
                </div>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setDeletingBiz(null)}
                disabled={deleting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {deleteError && (
                <div className="notice error" style={{ marginBottom: 14 }}>
                  {deleteError}
                </div>
              )}

              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to permanently delete <strong>{deletingBiz.name}</strong>?
              </p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
                This will permanently delete this business and all related records from Supabase, including:
              </p>
              <ul style={{ fontSize: 12, color: '#dc2626', margin: '8px 0 0 18px', padding: 0 }}>
                <li>Associated voice agents & telephony mappings</li>
                <li>All customer appointments & bookings</li>
                <li>Catalogue services & operating hours</li>
                <li>Call logs, recordings & telemetry records</li>
              </ul>
            </div>

            <div className="modal-footer" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingBiz(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteBusiness}
                disabled={deleting}
                style={{ background: '#dc2626', color: '#ffffff', borderColor: '#dc2626', minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {deleting ? (
                  <>
                    <span className="spin">⟳</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
