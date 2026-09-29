import { useEffect, useState } from 'react';
import { 
  Settings, 
  Coins, 
  DollarSign, 
  Building2, 
  Phone, 
  Mail, 
  Sparkles, 
  Check, 
  RefreshCw, 
  Cpu, 
  CreditCard,
  ShieldCheck,
  Save,
  Globe
} from 'lucide-react';
import { apiFetch } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    usd_to_inr_rate: 86.50,
    default_currency: 'INR',
    sarvam_campaign_id: '019ff2ec-99e5-7975-a8ca-2f3b97b1a293',
    sarvam_app_id: 'MKN-Financi-3af4be5e-3450',
    company_name: 'Scadova AI Telephony India',
    support_email: 'operations@scadova.ai',
    support_phone: '+91 80 4718 9000',
    minute_rate_sarvam_inr: 1.25,
    sarvam_api_key_configured: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  // Currency Live Calculator helper
  const [calcUsd, setCalcUsd] = useState(100);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/settings');
      if (data) setSettings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    try {
      const updated = await apiFetch('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSettings(updated);
      setSavedNotice('Settings and live exchange rates updated successfully!');
      window.dispatchEvent(new CustomEvent('scadova:settings_updated', { detail: updated }));
      setTimeout(() => setSavedNotice(''), 3500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const rate = Number(settings.usd_to_inr_rate || 86.5);
  const calcInr = Math.round(calcUsd * rate);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* HEADER */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="eyebrow">PLATFORM CONFIGURATION</span>
              <span className="badge badge-blue">Live Telephony</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
              System & Telephony Settings
            </h2>
            <p className="card-subtitle">
              Manage live currency conversion ($ USD to ₹ INR), Sarvam AI credentials, and enterprise company profiles.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || loading}
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />} Save All Settings
          </button>
        </div>

        {savedNotice && (
          <div style={{ marginTop: 16, padding: '10px 16px', background: '#ecfdf5', color: '#065f46', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> {savedNotice}
          </div>
        )}
      </div>

      {/* CURRENCY & LIVE EXCHANGE RATE */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Coins size={22} color="#2563eb" />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Live Price & Currency Conversion ($ to ₹)
              </h3>
              <p className="card-subtitle" style={{ margin: 0 }}>
                Enables instantaneous currency switching across the Admin and Client Dashboards.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 16 }}>
          {/* Rate Input */}
          <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Live USD to INR Exchange Rate (1 USD = ₹ INR)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>$1.00 = ₹</span>
              <input
                type="number"
                step="0.05"
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#0f172a',
                  width: 130
                }}
                value={settings.usd_to_inr_rate}
                onChange={(e) => setSettings({ ...settings, usd_to_inr_rate: parseFloat(e.target.value) || 86.5 })}
              />
            </div>
            <small style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'block' }}>
              Used across all charts, revenue cards, and invoice conversions.
            </small>
          </div>

          {/* Default Currency Switch */}
          <div style={{ background: '#f8fafc', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Default Platform Currency
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'INR', label: '₹ INR (Indian Rupee)' },
                { id: 'USD', label: '$ USD (US Dollar)' }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, default_currency: c.id })}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: settings.default_currency === c.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: settings.default_currency === c.id ? '#eff6ff' : '#ffffff',
                    color: settings.default_currency === c.id ? '#2563eb' : '#475569'
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Quick Converter Preview */}
          <div style={{ background: '#eff6ff', padding: 18, borderRadius: 12, border: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Instant Converter Calculator
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input
                type="number"
                style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: 14, fontWeight: 700 }}
                value={calcUsd}
                onChange={(e) => setCalcUsd(Number(e.target.value))}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>USD</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>≈</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>₹{calcInr.toLocaleString('en-IN')} INR</span>
            </div>
            <small style={{ fontSize: 11, color: '#3b82f6', marginTop: 4, display: 'block' }}>
              Interactive preview verifying decimal calculation precision.
            </small>
          </div>
        </div>
      </div>

      {/* SARVAM AI TELEPHONY SETTINGS */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={22} color="#10b981" />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Sarvam AI Voice Infrastructure
              </h3>
              <p className="card-subtitle" style={{ margin: 0 }}>
                Outbound voice campaign, neural voice model API key, and per-minute cost configuration.
              </p>
            </div>
          </div>
          <span className={`badge ${settings.sarvam_api_key_configured ? 'badge-green' : 'badge-yellow'}`}>
            {settings.sarvam_api_key_configured ? 'Active & Connected' : 'API Key Missing'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Sarvam AI Application ID
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
              value={settings.sarvam_app_id}
              onChange={(e) => setSettings({ ...settings, sarvam_app_id: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Default Campaign Cohort ID
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
              value={settings.sarvam_campaign_id}
              onChange={(e) => setSettings({ ...settings, sarvam_campaign_id: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Telephony Base Rate (₹ INR / Minute)
            </label>
            <input
              type="number"
              step="0.05"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700 }}
              value={settings.minute_rate_sarvam_inr}
              onChange={(e) => setSettings({ ...settings, minute_rate_sarvam_inr: parseFloat(e.target.value) || 1.25 })}
            />
          </div>
        </div>
      </div>

      {/* COMPANY & OPERATIONAL PROFILE */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color="#6366f1" />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Platform Operational Profile
              </h3>
              <p className="card-subtitle" style={{ margin: 0 }}>
                Information appearing on client invoices, email notifications, and caller CLI caller ID.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Company / Agency Legal Name
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Support Email Address
            </label>
            <input
              type="email"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              value={settings.support_email}
              onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Support Phone (Indian DID)
            </label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              value={settings.support_phone}
              onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
