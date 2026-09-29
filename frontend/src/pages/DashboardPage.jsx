import { useEffect, useState } from 'react';
import { 
  Building2, 
  Bot, 
  PhoneCall, 
  Clock, 
  Coins, 
  TrendingUp, 
  RefreshCw, 
  Plus, 
  Eye, 
  ArrowUpRight, 
  Play, 
  Pause, 
  Volume2, 
  Save, 
  RotateCcw, 
  Check, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Calendar,
  Lock,
  Copy,
  Receipt,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { apiFetch } from '../api';
import ClientOnboardingModal from '../components/ClientOnboardingModal';

// Voices Directory for Sarvam
const SARVAM_VOICES = [
  { id: 'rupa', name: 'Rupa', lang: 'hi-IN', desc: 'Warm & Professional Hindi / Indian English (Female)' },
  { id: 'arvind', name: 'Arvind', lang: 'en-IN', desc: 'Clear & Authoritative Indian English / Hindi (Male)' },
  { id: 'priya', name: 'Priya', lang: 'ta-IN', desc: 'Expressive Tamil & Indian English (Female)' },
  { id: 'ravi', name: 'Ravi', lang: 'te-IN', desc: 'Professional Telugu & Indian English (Male)' },
  { id: 'amit', name: 'Amit', lang: 'hi-IN', desc: 'Energetic & Conversational Hindi (Male)' },
  { id: 'meera', name: 'Meera', lang: 'mr-IN', desc: 'Polite & Patient Marathi / Hindi (Female)' }
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [currency, setCurrency] = useState('INR'); // 'INR' or 'USD'
  const [currencyRate, setCurrencyRate] = useState(86.50);

  // Selected view: 'admin' (overview) or a specific business_id (e.g. 12 or 1)
  const [selectedBusinessId, setSelectedBusinessId] = useState('admin');
  const [clientPreview, setClientPreview] = useState(null);
  const [clientLoading, setClientLoading] = useState(false);

  // Client Tab: 'agent', 'calls', 'analysis', 'billing'
  const [clientTab, setClientTab] = useState('agent');

  // Editable Agent Config State for Client
  const [editablePrompt, setEditablePrompt] = useState('');
  const [editableVoice, setEditableVoice] = useState('');
  const [editableTools, setEditableTools] = useState([]);
  const [savingAgent, setSavingAgent] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  // Audio Playback Mock
  const [playingCallId, setPlayingCallId] = useState(null);

  // Onboarding Modal
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [dashRes, setRes] = useState();
      const metrics = await apiFetch('/admin/dashboard-metrics');
      if (metrics) {
        setData(metrics);
        if (metrics.currency_rate) setCurrencyRate(metrics.currency_rate);
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadClientPreview = async (bizId) => {
    setClientLoading(true);
    try {
      const res = await apiFetch(`/admin/businesses/${bizId}/preview`);
      if (res) {
        setClientPreview(res);
        setEditablePrompt(res.business?.system_prompt || res.agent?.system_prompt || '');
        setEditableVoice(res.business?.voice || res.agent?.voice || 'rupa');
        setEditableTools(res.business?.attached_tools || res.agent?.tools || []);
      }
    } catch (e) {
      console.error('Client preview error:', e);
    } finally {
      setClientLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleViewClient = (e) => {
      if (e.detail?.businessId) {
        setSelectedBusinessId(String(e.detail.businessId));
        loadClientPreview(e.detail.businessId);
      }
    };
    window.addEventListener('scadova:view_client', handleViewClient);
    return () => window.removeEventListener('scadova:view_client', handleViewClient);
  }, []);

  useEffect(() => {
    if (selectedBusinessId !== 'admin') {
      loadClientPreview(selectedBusinessId);
    } else {
      setClientPreview(null);
    }
  }, [selectedBusinessId]);

  const handleSaveAgentConfig = async () => {
    if (!selectedBusinessId || selectedBusinessId === 'admin') return;
    setSavingAgent(true);
    setSaveNotice('');
    try {
      const updated = await apiFetch(`/admin/businesses/${selectedBusinessId}/agent-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: editablePrompt,
          voice: editableVoice,
          attached_tools: editableTools
        })
      });
      setClientPreview(updated);
      setSaveNotice('Agent prompt & tools updated successfully!');
      setTimeout(() => setSaveNotice(''), 3000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingAgent(false);
    }
  };

  const handleResetSettings = async () => {
    if (!selectedBusinessId || selectedBusinessId === 'admin') return;
    if (!confirm('Reset this agent prompt and tools to baseline template?')) return;
    try {
      const reset = await apiFetch(`/admin/businesses/${selectedBusinessId}/reset-settings`, { method: 'POST' });
      setClientPreview(reset);
      setEditablePrompt(reset.business?.system_prompt || '');
      setEditableTools(reset.business?.attached_tools || []);
      alert('Settings reset to default baseline.');
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  // Format Currency
  const formatMoney = (inrVal) => {
    const num = Number(inrVal || 0);
    if (currency === 'INR') {
      return `₹${num.toLocaleString('en-IN')}`;
    }
    const usd = num / currencyRate;
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const kpis = data?.kpis || {};
  const businesses = data?.businesses || [];
  const phones = data?.phone_numbers || [];
  const agents = data?.agents_catalog || [];
  const trend = data?.usage_trend || [];

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ======================================================== */}
      {/* TOP HEADER CONTROLS: SELECTOR, CURRENCY TOGGLE, ONBOARD */}
      {/* ======================================================== */}
      <div className="card" style={{ padding: '16px 20px', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: View & Client Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              View Scope:
            </span>
            <select
              className="form-select"
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1.5px solid #2563eb',
                background: '#eff6ff',
                color: '#1e40af',
                cursor: 'pointer'
              }}
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
            >
              <option value="admin">🇮🇳 All Indian Businesses (Admin Overview)</option>
              <optgroup label="Registered Client Portals">
                {businesses.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} ({b.type || b.industry || 'Client'})
                  </option>
                ))}
              </optgroup>
            </select>

            {selectedBusinessId !== 'admin' && (
              <span className="badge badge-green" style={{ fontSize: 12 }}>
                Client Portal Preview Mode
              </span>
            )}
          </div>

          {/* Right: Currency Toggle & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Currency Pill */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 8,
              border: '1px solid #cbd5e1'
            }}>
              <button
                type="button"
                onClick={() => setCurrency('INR')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                  background: currency === 'INR' ? '#2563eb' : 'transparent',
                  color: currency === 'INR' ? '#ffffff' : '#64748b'
                }}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: 'none',
                  background: currency === 'USD' ? '#2563eb' : 'transparent',
                  color: currency === 'USD' ? '#ffffff' : '#64748b'
                }}
              >
                $ USD (1 = ₹{currencyRate})
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadData}
              disabled={refreshing}
              title="Refresh Data"
              style={{ padding: '8px 12px' }}
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOnboardingOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 800,
                background: '#10b981',
                borderColor: '#10b981'
              }}
            >
              <Plus size={16} /> Onboard New Client
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. ADMIN OVERVIEW MODE */}
      {/* ======================================================== */}
      {selectedBusinessId === 'admin' && (
        <>
          {/* KPI CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <article className="metric-card">
              <div className="metric-label">
                <span>Indian Businesses</span>
                <Building2 size={20} color="#2563eb" />
              </div>
              <strong style={{ fontSize: 26 }}>{kpis.total_indian_businesses || 0}</strong>
              <small>Across NBFC, Clinics & Retail</small>
            </article>

            <article className="metric-card">
              <div className="metric-label">
                <span>Total Call Minutes</span>
                <Clock size={20} color="#10b981" />
              </div>
              <strong style={{ fontSize: 26 }}>{(kpis.total_minutes || 0).toLocaleString()} min</strong>
              <small>Sarvam AI neural synthesis</small>
            </article>

            <article className="metric-card">
              <div className="metric-label">
                <span>Platform Revenue</span>
                <Coins size={20} color="#f59e0b" />
              </div>
              <strong style={{ fontSize: 26 }}>{formatMoney(kpis.total_revenue_inr)}</strong>
              <small>Plans + Setup fees collected</small>
            </article>

            <article className="metric-card">
              <div className="metric-label">
                <span>Sarvam Phone Numbers</span>
                <PhoneCall size={20} color="#6366f1" />
              </div>
              <strong style={{ fontSize: 26 }}>{kpis.available_phone_numbers} Avail / {kpis.total_phone_numbers} Total</strong>
              <small>Indian National DIDs</small>
            </article>

            <article className="metric-card">
              <div className="metric-label">
                <span>Sarvam Agents Deployed</span>
                <Bot size={20} color="#8b5cf6" />
              </div>
              <strong style={{ fontSize: 26 }}>{kpis.active_sarvam_agents} Active / {kpis.total_sarvam_agents} Catalog</strong>
              <small>Hindi, Telugu, Tamil & English</small>
            </article>

            <article className="metric-card">
              <div className="metric-label">
                <span>Call Success / Latency</span>
                <TrendingUp size={20} color="#06b6d4" />
              </div>
              <strong style={{ fontSize: 26 }}>{kpis.conversion_rate_pct}% · {kpis.average_latency_ms}ms</strong>
              <small>End-to-end voice turnaround</small>
            </article>
          </div>

          {/* TELEPHONY & AGENT ALLOCATION HUBS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            {/* Phone Numbers by Sarvam Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Available Phone Numbers by Sarvam
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0 }}>
                    Virtual national DIDs and telephony lines for campaign dispatch.
                  </p>
                </div>
                <span className="badge badge-blue">{phones.filter(p => p.status === 'available').length} Available</span>
              </div>

              <div className="table-container" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phone Line</th>
                      <th>Region Circle</th>
                      <th>Status</th>
                      <th>Allocated To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phones.map((pn) => (
                      <tr key={pn.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{pn.number}</strong>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{pn.type}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{pn.region}</td>
                        <td>
                          <span className={`badge ${pn.status === 'available' ? 'badge-green' : 'badge-yellow'}`}>
                            {pn.status === 'available' ? 'Available' : 'Allocated'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>
                          {pn.business_name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Allocating Agents from Sarvam Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Allocating Agents from Sarvam
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0 }}>
                    Neural agents available for instant enterprise connection.
                  </p>
                </div>
                <span className="badge badge-green">{agents.length} Models Ready</span>
              </div>

              <div className="table-container" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sarvam Agent</th>
                      <th>Language / Voice</th>
                      <th>Domain</th>
                      <th>Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((ag) => (
                      <tr key={ag.agent_id}>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{ag.name}</strong>
                          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                            v{ag.version} · {ag.agent_id.slice(0, 14)}...
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">{ag.voice_label || ag.language}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>{ag.industry_label || ag.industry}</td>
                        <td>
                          {ag.business_name ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                              ✓ Linked: {ag.business_name}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Unallocated (Available)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CHARTS ROW: 14-DAY USAGE TREND & INDUSTRY BREAKDOWN */}
          <div className="chart-grid">
            {/* SVG Usage Chart */}
            <article className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Voice Minutes Trend (Last 14 Days)
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0 }}>
                    Daily conversation minutes across all Indian tenant calls.
                  </p>
                </div>
                <span className="badge badge-blue">
                  {trend.reduce((acc, t) => acc + (t.minutes || 0), 0).toFixed(0)} Total Mins
                </span>
              </div>

              <div style={{ padding: '16px 0' }}>
                <svg viewBox="0 0 700 180" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  {[0, 1, 2, 3].map(i => (
                    <line key={i} x1="40" y1={30 + i * 35} x2="670" y2={30 + i * 35} stroke="#f1f5f9" strokeWidth="1" />
                  ))}
                  {/* Polygon & Polyline */}
                  <polygon
                    points={`40,140 ${trend.map((t, idx) => `${50 + idx * 46},${140 - Math.min(100, (t.minutes || 10) * 1.8)}`).join(' ')} 650,140`}
                    fill="url(#chartGradient)"
                  />
                  <polyline
                    points={trend.map((t, idx) => `${50 + idx * 46},${140 - Math.min(100, (t.minutes || 10) * 1.8)}`).join(' ')}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Points */}
                  {trend.map((t, idx) => (
                    <circle
                      key={idx}
                      cx={50 + idx * 46}
                      cy={140 - Math.min(100, (t.minutes || 10) * 1.8)}
                      r="4"
                      fill="#2563eb"
                    />
                  ))}
                  {/* Labels */}
                  {trend.map((t, idx) => (
                    <text key={idx} x={50 + idx * 46} y={160} fontSize="10" textAnchor="middle" fill="#64748b">
                      {t.date}
                    </text>
                  ))}
                </svg>
              </div>
            </article>

            {/* Industry Breakdown Card */}
            <article className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Enterprise Industry Breakdown
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0 }}>
                    Tenant distribution across Indian market verticals.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                {[
                  { name: 'Non-Banking Financial Services (NBFC & Loans)', count: 2, pct: '40%', color: '#2563eb' },
                  { name: 'Healthcare & Specialized Clinics', count: 1, pct: '20%', color: '#10b981' },
                  { name: 'Fine Dining & Hospitality', count: 1, pct: '20%', color: '#f59e0b' },
                  { name: 'Automotive & Pre-Owned Car Dealerships', count: 1, pct: '20%', color: '#8b5cf6' }
                ].map(ind => (
                  <div key={ind.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: '#0f172a' }}>{ind.name}</span>
                      <span style={{ color: '#64748b' }}>{ind.count} ({ind.pct})</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: ind.pct, height: '100%', background: ind.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          {/* ALL BUSINESSES DIRECTORY TABLE */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Indian Businesses Master Directory
                </h3>
                <p className="card-subtitle" style={{ margin: 0 }}>
                  Select any business to inspect their dedicated Client Dashboard, prompts, recordings, and billing.
                </p>
              </div>
              <span className="badge badge-blue">{businesses.length} Total</span>
            </div>

            <div className="table-container" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Industry</th>
                    <th>Location</th>
                    <th>Allocated Agent</th>
                    <th>Call Minutes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: 14 }}>{b.name}</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Spoken Name: <em>"{b.spoken_name || b.name}"</em>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue">{b.type || b.industry || 'Enterprise'}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{b.address || b.city || 'India'}</td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {b.agent_name || 'Sarvam AI Voice'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Voice: {b.voice || 'Rupa'}</div>
                      </td>
                      <td>
                        <strong>{b.minutes || 0} min</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{b.calls || 0} calls</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            fontSize: 12,
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#2563eb',
                            borderColor: '#bfdbfe'
                          }}
                          onClick={() => {
                            setSelectedBusinessId(String(b.id));
                          }}
                        >
                          <Eye size={14} /> Preview Client Dashboard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* 2. CLIENT DASHBOARD PREVIEW MODE */}
      {/* ======================================================== */}
      {selectedBusinessId !== 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {clientLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
              Loading Client Dashboard Preview...
            </div>
          ) : clientPreview ? (
            <>
              {/* CLIENT HEADER BANNER */}
              <div className="card" style={{
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
                        Client Portal View
                      </span>
                      <span className="badge badge-green" style={{ background: '#10b981', color: '#ffffff' }}>
                        Active Client
                      </span>
                      <span className="badge badge-blue">
                        {clientPreview.business?.type || clientPreview.business?.industry}
                      </span>
                    </div>

                    <h1 style={{ fontSize: 26, fontWeight: 900, margin: '8px 0 4px 0' }}>
                      {clientPreview.business?.name}
                    </h1>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: 13 }}>
                      AI Spoken Pronunciation: <strong>"{clientPreview.business?.spoken_name || clientPreview.business?.name}"</strong> · {clientPreview.business?.address}
                    </p>
                  </div>

                  {/* Client Credentials & Status Box */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 10,
                    padding: '10px 16px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Client User ID</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{clientPreview.credentials?.user_id}</div>
                    </div>
                    <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.2)', paddingLeft: 16 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Linked DID</div>
                      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace' }}>
                        {clientPreview.phone_number?.number || '+91 80 4718 9001'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-KPI Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                  marginTop: 20,
                  borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                  paddingTop: 16
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Total Calls</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{clientPreview.stats?.total_calls || 0}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Minutes Used</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{clientPreview.stats?.total_minutes || 0} min</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Available Balance</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>
                      {clientPreview.credits?.remaining_balance || 500} Credits
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Plan / Quota</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>
                      {clientPreview.invoice?.plan_name || 'Growth Pro'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>CSAT Rating</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{clientPreview.stats?.csat_score || '4.8 / 5'}</div>
                  </div>
                </div>
              </div>

              {/* CLIENT TABS */}
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                {[
                  { id: 'agent', label: '🤖 Linked Agent & Prompt' },
                  { id: 'calls', label: '📞 Calls, Transcripts & Audio' },
                  { id: 'analysis', label: '📊 Call Analysis & Sentiment' },
                  { id: 'billing', label: '💳 Plan, Credentials & Invoices' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setClientTab(t.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      border: 'none',
                      background: clientTab === t.id ? '#2563eb' : 'transparent',
                      color: clientTab === t.id ? '#ffffff' : '#64748b'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: AGENT & PROMPT EDITING */}
              {clientTab === 'agent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Live Agent System Prompt (Editable)
                        </h3>
                        <p className="card-subtitle" style={{ margin: 0 }}>
                          Define the conversational identity, verification rules, and tone used by the Sarvam neural voice agent.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleResetSettings}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          <RotateCcw size={14} /> Reset to Baseline
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={savingAgent}
                          onClick={handleSaveAgentConfig}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          {savingAgent ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} Save Agent Settings
                        </button>
                      </div>
                    </div>

                    {saveNotice && (
                      <div style={{ marginTop: 10, padding: '8px 14px', background: '#ecfdf5', color: '#065f46', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        ✓ {saveNotice}
                      </div>
                    )}

                    <div style={{ marginTop: 14 }}>
                      <textarea
                        rows={10}
                        style={{
                          width: '100%',
                          padding: 14,
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontFamily: 'monospace',
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: '#0f172a'
                        }}
                        value={editablePrompt}
                        onChange={(e) => setEditablePrompt(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* VOICE SELECTOR & ATTACHED TOOLS */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    {/* Voice Model Card */}
                    <div className="card">
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                        Change Agent Voice Persona
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {SARVAM_VOICES.map((v) => (
                          <div
                            key={v.id}
                            onClick={() => setEditableVoice(v.id)}
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              border: editableVoice === v.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              background: editableVoice === v.id ? '#eff6ff' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{v.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{v.desc}</div>
                            </div>
                            <span className="badge badge-blue">{v.lang}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attached Backend Tools */}
                    <div className="card">
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                        Connected Functional Tools
                      </h4>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px 0' }}>
                        Tools available for the AI agent to execute live during phone conversations.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          'check_loan_eligibility',
                          'create_loan_application',
                          'save_employment_profile',
                          'schedule_callback',
                          'get_business_hours',
                          'get_services',
                          'create_appointment',
                          'search_appointment'
                        ].map((tool) => {
                          const isAttached = editableTools.includes(tool);
                          return (
                            <button
                              key={tool}
                              type="button"
                              onClick={() => {
                                if (isAttached) {
                                  setEditableTools(editableTools.filter(t => t !== tool));
                                } else {
                                  setEditableTools([...editableTools, tool]);
                                }
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: isAttached ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                background: isAttached ? '#eff6ff' : '#f8fafc',
                                color: isAttached ? '#1e40af' : '#475569'
                              }}
                            >
                              {isAttached ? '✓ ' : '+ '}{tool}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CALLS, TRANSCRIPTS & AUDIO */}
              {clientTab === 'calls' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Recent Customer Telephony Calls & Audio Recordings
                      </h3>
                      <p className="card-subtitle" style={{ margin: 0 }}>
                        Listen to call audio, inspect full conversational transcripts, and review customer responses.
                      </p>
                    </div>
                    <span className="badge badge-blue">{clientPreview.recent_calls?.length || 0} Recorded</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
                    {(clientPreview.recent_calls || []).map((call) => (
                      <div key={call.id} style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ fontSize: 14, color: '#0f172a' }}>{call.caller_name || 'Caller'}</strong>
                              <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#64748b' }}>{call.caller}</span>
                              <span className={`badge ${call.outcome?.includes('STARTED') || call.outcome === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}`}>
                                {call.outcome}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              Duration: {call.duration_seconds}s · Latency: {call.latency_ms || 310}ms · Sentiment: {call.sentiment || 'Positive'}
                            </div>
                          </div>

                          {/* Play Audio Button */}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setPlayingCallId(playingCallId === call.id ? null : call.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              color: playingCallId === call.id ? '#10b981' : '#2563eb'
                            }}
                          >
                            {playingCallId === call.id ? <Pause size={14} /> : <Play size={14} />}
                            {playingCallId === call.id ? 'Playing Audio…' : 'Play Recording'}
                          </button>
                        </div>

                        {/* Interactive Audio Wave Mock */}
                        {playingCallId === call.id && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            background: '#1e293b',
                            borderRadius: 8,
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                          }}>
                            <Volume2 size={18} color="#38bdf8" />
                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: '65%', height: '100%', background: '#38bdf8' }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: 'monospace' }}>01:14 / 03:04</span>
                          </div>
                        )}

                        {/* Transcript Bubble Viewer */}
                        {call.transcript && (
                          <div style={{
                            marginTop: 12,
                            padding: 12,
                            borderRadius: 8,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: '#334155',
                            whiteSpace: 'pre-line'
                          }}>
                            {call.transcript}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: ANALYSIS */}
              {clientTab === 'analysis' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  <div className="card">
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                      Customer Sentiment Distribution
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Positive / Interested', pct: 72, color: '#10b981' },
                        { label: 'Neutral / Callback Requested', pct: 21, color: '#2563eb' },
                        { label: 'Dropped / No Response', pct: 7, color: '#f59e0b' }
                      ].map(s => (
                        <div key={s.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                            <span>{s.label}</span>
                            <span>{s.pct}%</span>
                          </div>
                          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, marginTop: 4 }}>
                            <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                      Agent Conversion Efficiency
                    </h4>
                    <p style={{ fontSize: 13, color: '#64748b' }}>
                      The AI agent completed <strong>68.4%</strong> of initiated applications to verification stage without human agent intervention.
                    </p>
                    <div style={{ marginTop: 16, background: '#eff6ff', padding: 14, borderRadius: 8, border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1e40af' }}>Top Customer Objections Resolved:</div>
                      <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, fontSize: 12, color: '#1e3a8a' }}>
                        <li>CIBIL score inquiry & loan eligibility clarification</li>
                        <li>Pre-payment penalty waiver confirmation</li>
                        <li>Driving in traffic $\rightarrow$ Scheduled exact callback</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BILLING & CREDENTIALS */}
              {clientTab === 'billing' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {/* Credentials Box */}
                  <div className="card">
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                      Client Portal Credentials
                    </h4>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
                      Provide these credentials to the client administrator to log in directly.
                    </p>

                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Username / User ID</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                          {clientPreview.credentials?.user_id}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Password</span>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
                          {clientPreview.credentials?.password_hash || '••••••••'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Box */}
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Invoice & Plan Details
                        </h4>
                        <p className="card-subtitle" style={{ margin: 0 }}>
                          Invoice {clientPreview.invoice?.invoice_id || 'INV-2026-001'}
                        </p>
                      </div>
                      <span className="badge badge-green">PAID</span>
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Plan Tier:</span>
                        <strong>{clientPreview.invoice?.plan_name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Monthly Allocation:</span>
                        <strong>{clientPreview.invoice?.allocated_minutes} Minutes</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Setup Fee Paid:</span>
                        <strong style={{ color: '#10b981' }}>
                          ₹{Number(clientPreview.invoice?.setup_fee_amount || 0).toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                        <span>Total Invoiced:</span>
                        <strong style={{ fontSize: 16 }}>
                          {formatMoney(clientPreview.invoice?.total_invoiced_inr)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">No business selected.</div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* CONVERSATIONAL QUESTION-FLOW ONBOARDING MODAL */}
      {/* ======================================================== */}
      <ClientOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        currencyRate={currencyRate}
        currency={currency}
        onClientOnboarded={(newClient) => {
          loadData();
          if (newClient?.business?.id) {
            setSelectedBusinessId(String(newClient.business.id));
          }
        }}
      />
    </div>
  );
}
