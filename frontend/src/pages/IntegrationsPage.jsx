import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [configFields, setConfigFields] = useState({});
  const [actionStatus, setActionStatus] = useState('');

  const loadIntegrations = () => {
    setLoading(true);
    apiFetch('/admin/integrations')
      .then((data) => {
        if (Array.isArray(data)) setIntegrations(data);
      })
      .catch(() => setIntegrations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const handleOpenConfigure = (itg) => {
    setActiveModal(itg);
    setConfigFields({});
  };

  const handleSaveConfig = async () => {
    if (!activeModal) return;
    setActionStatus(`Saving configuration for ${activeModal.name}...`);
    try {
      await apiFetch(`/admin/integrations/${activeModal.name}/configure`, {
        method: 'POST',
        body: JSON.stringify({ config: configFields })
      });
      setActionStatus(`${activeModal.name} configured and connected!`);
      setActiveModal(null);
      loadIntegrations();
    } catch (e) {
      setActionStatus(`Error: ${e.message}`);
    }
    setTimeout(() => setActionStatus(''), 4000);
  };

  const handleDisconnect = async (name) => {
    try {
      await apiFetch(`/admin/integrations/${name}/disconnect`, { method: 'POST' });
      loadIntegrations();
    } catch (e) {
      alert('Disconnect error: ' + e.message);
    }
  };

  const handleTest = async (name) => {
    setActionStatus(`Testing connection to ${name}...`);
    try {
      const res = await apiFetch(`/admin/integrations/${name}/test`, { method: 'POST' });
      setActionStatus(`${name} is operational! Latency: ${res.latency_ms}ms`);
    } catch (e) {
      setActionStatus(`Connection test failed: ${e.message}`);
    }
    setTimeout(() => setActionStatus(''), 4000);
  };

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Platform Integrations</h2>
            <p className="card-subtitle">
              Manage telephony providers, Google Calendar, webhooks, and outbound notification channels.
            </p>
          </div>
        </div>

        {actionStatus && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, color: '#1d4ed8', fontSize: 13, fontWeight: 600 }}>
            {actionStatus}
          </div>
        )}
      </div>

      {/* INTEGRATION TILES GRID */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
          Loading integrations...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {integrations.map((itg) => (
            <div className="card" key={itg.name} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: itg.connected ? '#eff6ff' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22
                  }}>
                    {itg.name === 'Twilio' ? '📱' :
                     itg.name === 'Google Calendar' ? '📅' :
                     itg.name === 'Gmail' ? '✉️' :
                     itg.name === 'WhatsApp' ? '💬' :
                     itg.name === 'Webhook' ? '🔗' : '⚙️'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{itg.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{itg.type}</div>
                  </div>
                </div>

                <span className={`badge ${itg.connected ? 'badge-green' : 'badge-gray'}`}>
                  {itg.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                {itg.description}
              </p>

              {/* MASKED CONFIG DISPLAY */}
              <div style={{
                background: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                fontSize: 11.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ color: '#64748b' }}>Credentials:</span>
                <span style={{ fontWeight: 600, color: itg.connected ? '#10b981' : '#94a3b8' }}>
                  {itg.connected ? 'Configured' : 'Not Set'}
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Last Checked: {itg.last_checked_at ? new Date(itg.last_checked_at).toLocaleTimeString() : 'Never'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => handleOpenConfigure(itg)}
                >
                  Configure
                </button>

                {itg.connected ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleTest(itg.name)}
                    >
                      Test
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDisconnect(itg.name)}
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenConfigure(itg)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONFIGURE MODAL */}
      {activeModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Configure {activeModal.name}</h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
                Enter connection credentials. For security, keys are never displayed in raw text after saving.
              </p>

              {activeModal.name === 'Twilio' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Account SID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      onChange={(e) => setConfigFields({ ...configFields, account_sid: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Auth Token</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Secret Auth Token"
                      onChange={(e) => setConfigFields({ ...configFields, auth_token: e.target.value })}
                    />
                  </div>
                </>
              )}

              {activeModal.name === 'Google Calendar' && (
                <div className="form-group">
                  <label className="form-label">Google Calendar ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="primary or your-calendar@group.calendar.google.com"
                    onChange={(e) => setConfigFields({ calendar_id: e.target.value })}
                  />
                </div>
              )}

              {activeModal.name === 'WhatsApp' && (
                <div className="form-group">
                  <label className="form-label">WhatsApp Business Phone ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1092837465"
                    onChange={(e) => setConfigFields({ phone_id: e.target.value })}
                  />
                </div>
              )}

              {activeModal.name === 'Webhook' && (
                <div className="form-group">
                  <label className="form-label">Webhook Destination URL</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://your-crm.com/api/voice-events"
                    onChange={(e) => setConfigFields({ url: e.target.value })}
                  />
                </div>
              )}

              {['Gmail', 'Custom API'].includes(activeModal.name) && (
                <div className="form-group">
                  <label className="form-label">API Endpoint / Service Key</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter configuration secret"
                    onChange={(e) => setConfigFields({ key: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>Save & Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
