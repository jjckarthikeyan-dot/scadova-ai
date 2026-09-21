import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeDollarSign,
  Gauge,
  LayoutGrid,
  ListFilter,
  PhoneCall,
  Plus,
  RefreshCw,
  Save,
  Table2,
  Timer,
} from 'lucide-react';
import { apiFetch } from '../api';

const money = (value) => Number(value || 0).toFixed(2);
const mins = (value) => Number(value || 0).toFixed(2);
const clamp = (value) => Math.max(0, Math.min(100, Number(value || 0)));

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? 'active' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch-track">
        <span className="toggle-switch-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function ProgressBar({ value, status }) {
  return (
    <div className="usage-progress" aria-label={`${money(value)} percent used`}>
      <span
        className={`usage-progress-fill ${status === 'depleted' ? 'danger' : status === 'low' ? 'warning' : ''}`}
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  );
}

export default function UsagePage() {
  const [tracking, setTracking] = useState({ totals: {}, agents: [], ledger: [] });
  const [loading, setLoading] = useState(true);
  const [savingAgent, setSavingAgent] = useState('');
  const [error, setError] = useState('');
  const [forms, setForms] = useState({});
  const [viewMode, setViewMode] = useState('cards');
  const [fishStatus, setFishStatus] = useState(null);
  const [notice, setNotice] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [denseTable, setDenseTable] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    return apiFetch('/admin/agent-usage')
      .then((data) => {
        setTracking(data || { totals: {}, agents: [], ledger: [] });
        const nextForms = {};
        (data?.agents || []).forEach((agent) => {
          nextForms[agent.agent_id] = {
            credit_limit: agent.credit_limit ?? 0,
            credits_per_minute: agent.credits_per_minute ?? 1,
            low_balance_threshold: agent.low_balance_threshold ?? 25,
            top_up: '',
            minutes: '',
            fish_agent_id: agent.fish_provider_agent_id || '',
          };
        });
        setForms(nextForms);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  const checkFish = async () => {
    setError('');
    try { setFishStatus(await apiFetch('/admin/fish-audio/status')); }
    catch(e) { setError(e.message); }
  };
  async function providerAction(agent, action) {
    setSavingAgent(agent.agent_id); setError(''); setNotice('');
    try {
      const base = `/admin/agents/${encodeURIComponent(agent.agent_id)}`;
      const result = await apiFetch(base + (action === 'link' ? '/fish-audio' : action === 'sync' ? '/fish-audio/sync' : '/minutes'), {
        method: action === 'link' ? 'PUT' : 'POST',
        body: action === 'link' ? JSON.stringify({fish_agent_id: forms[agent.agent_id]?.fish_agent_id}) : action === 'minutes' ? JSON.stringify({minutes: Number(forms[agent.agent_id]?.minutes)}) : undefined,
      });
      setNotice(action === 'sync' ? `${result.imported} new Fish Audio sessions imported.` : action === 'link' ? 'Fish Audio agent linked.' : 'Minutes added to the local allocation.');
      await load();
    } catch(e) { setError(e.message); } finally { setSavingAgent(''); }
  }

  const totals = tracking.totals || {};
  const agents = tracking.agents || [];
  const visibleAgents = useMemo(
    () => agents.filter((agent) => !lowOnly || agent.balance_status !== 'ok'),
    [agents, lowOnly],
  );

  const selectedPressure = useMemo(() => {
    if (!agents.length) return 0;
    return Math.max(...agents.map((agent) => Number(agent.usage_percent || 0)));
  }, [agents]);

  const updateForm = (agentId, key, value) => {
    setForms((current) => ({
      ...current,
      [agentId]: {
        ...(current[agentId] || {}),
        [key]: value,
      },
    }));
  };

  const saveLimit = async (agent) => {
    const form = forms[agent.agent_id] || {};
    setSavingAgent(agent.agent_id);
    setError('');
    try {
      await apiFetch(`/admin/agents/${encodeURIComponent(agent.agent_id)}/credit-limit`, {
        method: 'PUT',
        body: JSON.stringify({
          credit_limit: Number(form.credit_limit || 0),
          credits_per_minute: Number(form.credits_per_minute || 0),
          low_balance_threshold: Number(form.low_balance_threshold || 0),
        }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingAgent('');
    }
  };

  const addCredits = async (agent) => {
    const amount = Number(forms[agent.agent_id]?.top_up || 0);
    if (!amount || amount <= 0) return;
    setSavingAgent(agent.agent_id);
    setError('');
    try {
      await apiFetch(`/admin/agents/${encodeURIComponent(agent.agent_id)}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount, note: 'Admin console credit top-up' }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingAgent('');
    }
  };

  const renderAgentActions = (agent) => {
    const form = forms[agent.agent_id] || {};
    const disabled = savingAgent === agent.agent_id;
    return (
      <div className="usage-action-panel">
        <div className="provider-controls">
          <label className="form-group"><span className="form-label">Fish Audio agent ID</span><input className="form-input" placeholder="Paste provider agent ID" value={form.fish_agent_id || ''} onChange={e=>updateForm(agent.agent_id,'fish_agent_id',e.target.value)}/></label>
          <div className="usage-action-row"><button className="btn btn-secondary btn-sm" disabled={disabled || !form.fish_agent_id} onClick={()=>providerAction(agent,'link')}>Verify & link</button><button className="btn btn-secondary btn-sm" disabled={disabled || !agent.fish_provider_agent_id} onClick={()=>providerAction(agent,'sync')}>Sync sessions</button></div>
          <small className="cell-secondary">{agent.last_provider_sync ? `Last sync: ${new Date(agent.last_provider_sync).toLocaleString()}` : 'No provider sync yet'}</small>
        </div>
        <div className="usage-input-grid">
          <label className="form-group">
            <span className="form-label">Balance limit (credits)</span>
            <input className="form-input" type="number" min="0" value={form.credit_limit ?? ''} onChange={(e) => updateForm(agent.agent_id, 'credit_limit', e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Credits / minute</span>
            <input className="form-input" type="number" min="0" step="0.01" value={form.credits_per_minute ?? ''} onChange={(e) => updateForm(agent.agent_id, 'credits_per_minute', e.target.value)} />
          </label>
          <label className="form-group">
            <span className="form-label">Low balance alert</span>
            <input className="form-input" type="number" min="0" value={form.low_balance_threshold ?? ''} onChange={(e) => updateForm(agent.agent_id, 'low_balance_threshold', e.target.value)} />
          </label>
        </div>
        <div className="usage-action-row">
          <label className="form-group"><span className="form-label">Add minutes</span><input className="form-input" type="number" min="0.01" step="0.01" value={form.minutes || ''} onChange={e=>updateForm(agent.agent_id,'minutes',e.target.value)}/></label>
          <button className="btn btn-secondary btn-sm" disabled={disabled || !(Number(form.minutes)>0)} onClick={()=>providerAction(agent,'minutes')}>Top up minutes</button>
          <small>{money(Number(form.minutes || 0)*Number(agent.credits_per_minute))} credits at saved rate</small>
        </div>
        <div className="usage-action-row">
          <button className="btn btn-secondary btn-sm" onClick={() => saveLimit(agent)} disabled={disabled}>
            <Save size={14} />
            Save
          </button>
          <input className="form-input usage-topup-input" type="number" min="0" step="1" placeholder="Add credits" value={form.top_up ?? ''} onChange={(e) => updateForm(agent.agent_id, 'top_up', e.target.value)} />
          <button className="btn btn-yellow btn-sm" title="Add credits" onClick={() => addCredits(agent)} disabled={disabled}>
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="usage-page">
      <div className="usage-hero">
        <div>
          <span className="usage-kicker">Agent Operations</span>
          <h2>Usage, balance, and call analysis</h2>
          <p>
            Track every agent by Agent ID, convert call duration into billable minutes,
            and control credits with live limits and low-balance thresholds.
          </p>
        </div>
        <button className="btn btn-secondary" title="Refresh usage" onClick={load} disabled={loading}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="card fish-connection"><div><h3>Fish Audio connection</h3><p className="card-subtitle">{fishStatus?.connected ? `Connected · provider account credit: ${fishStatus.provider_credit}` : fishStatus && !fishStatus.configured ? 'Add FISH_API_KEY to the backend environment, then restart the backend.' : 'Verify your server connection, then link an agent below.'}</p></div><button className="btn btn-secondary" onClick={checkFish}>Check connection</button></div>
      <p className="notice">Minute top-ups allocate Scadova credits; they do not purchase Fish Audio credits. Balance limits control local allocations. Calls started directly in Fish Audio are not stopped by these limits.</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && (
        <div className="card" role="alert" style={{ borderColor: '#fecaca', color: '#991b1b', marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="stats-grid usage-stats">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <PhoneCall size={23} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totals.calls || 0}</div>
            <div className="stat-label">Tracked calls</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Timer size={23} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{mins(totals.billable_minutes)}</div>
            <div className="stat-label">Billable minutes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#fffbeb', color: '#d97706' }}>
            <BadgeDollarSign size={23} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{money(totals.remaining_balance)}</div>
            <div className="stat-label">Remaining credits</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Gauge size={23} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{money(selectedPressure)}%</div>
            <div className="stat-label">Highest limit usage</div>
          </div>
        </div>
      </div>

      <div className="card usage-control-card">
        <div className="usage-toolbar">
          <div>
            <div className="card-title">Agent tracking controls</div>
            <p className="card-subtitle">Switch between card and table formats, then update limits directly inline.</p>
          </div>
          <div className="usage-controls">
            <div className="segmented-control" aria-label="View mode">
              <button type="button" aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>
                <LayoutGrid size={15} />
                Cards
              </button>
              <button type="button" aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}>
                <Table2 size={15} />
                Table
              </button>
            </div>
            <ToggleSwitch checked={lowOnly} onChange={setLowOnly} label="Low only" />
            <ToggleSwitch checked={denseTable} onChange={setDenseTable} label="Dense rows" />
          </div>
        </div>

        {loading ? (
          <p className="usage-empty">Loading usage...</p>
        ) : viewMode === 'cards' ? (
          <div className="agent-card-grid">
            {visibleAgents.map((agent) => (
              <article className="agent-usage-card" key={agent.agent_id}>
                <div className="agent-card-top">
                  <div>
                    <strong>{agent.agent_name}</strong>
                    <p>{agent.agent_id}</p>
                  </div>
                  <span className={`badge ${agent.balance_status === 'depleted' ? 'badge-red' : agent.balance_status === 'low' ? 'badge-yellow' : 'badge-green'}`}>
                    {agent.balance_status}
                  </span>
                </div>
                <div className="agent-card-business">{agent.business_name}</div>
                <ProgressBar value={agent.usage_percent} status={agent.balance_status} />
                <div className="agent-card-metrics">
                  <div>
                    <span>Used</span>
                    <strong>{money(agent.credits_used)}</strong>
                  </div>
                  <div>
                    <span>Balance</span>
                    <strong>{money(agent.remaining_balance)}</strong>
                  </div>
                  <div>
                    <span>Minutes</span>
                    <strong>{mins(agent.billable_minutes)}</strong>
                  </div>
                </div>
                <div className="agent-analysis-box">
                  <div>
                    <Activity size={15} />
                    <strong>{agent.latest_analysis?.outcome || 'No calls yet'}</strong>
                  </div>
                  <p>{agent.latest_analysis?.summary || 'Waiting for the first tracked call.'}</p>
                </div>
                {renderAgentActions(agent)}
              </article>
            ))}
            {!visibleAgents.length && <p className="usage-empty">No agents match the current filters.</p>}
          </div>
        ) : (
          <div className={`table-container usage-table ${denseTable ? 'dense' : ''}`}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Analysis</th>
                  <th>Usage</th>
                  <th>Credit Health</th>
                  <th>Settings & Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((agent) => (
                  <tr key={agent.agent_id}>
                    <td>
                      <strong>{agent.agent_name}</strong>
                      <p className="usage-muted">{agent.agent_id}</p>
                      <span className="badge badge-gray">{agent.business_name}</span>
                    </td>
                    <td>
                      <div className="usage-analysis-line">
                        <Activity size={15} />
                        <strong>{agent.latest_analysis?.outcome || 'No calls yet'}</strong>
                      </div>
                      <p className="usage-muted usage-analysis-copy">
                        {agent.latest_analysis?.summary || 'Waiting for the first tracked call.'}
                      </p>
                    </td>
                    <td>
                      <strong>{agent.calls}</strong> calls
                      <p className="usage-muted">
                        {mins(agent.actual_minutes)} actual / {mins(agent.billable_minutes)} billable min
                      </p>
                    </td>
                    <td>
                      <div className="usage-credit-cell">
                        <span className={`badge ${agent.balance_status === 'depleted' ? 'badge-red' : agent.balance_status === 'low' ? 'badge-yellow' : 'badge-green'}`}>
                          {agent.balance_status}
                        </span>
                        <ProgressBar value={agent.usage_percent} status={agent.balance_status} />
                        <p>{money(agent.remaining_balance)} left of {money(agent.credits_added)}</p>
                      </div>
                    </td>
                    <td>{renderAgentActions(agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleAgents.length && <p className="usage-empty">No agents match the current filters.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
