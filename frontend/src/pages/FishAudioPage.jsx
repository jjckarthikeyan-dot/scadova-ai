import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  FileText,
  Link2,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../api';

const emptyKnowledge = {
  profile: { description: '', hours: '', policies: '' },
  services: [],
  offers: [],
  documents: [],
  extra_markdown: '',
};

function Field({ label, value, onChange, placeholder, textarea }) {
  return (
    <label className="form-group">
      <span className="form-label">{label}</span>
      {textarea ? (
        <textarea className="form-textarea" rows={3} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="form-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export default function FishAudioPage() {
  const [status, setStatus] = useState(null);
  const [providers, setProviders] = useState([]);
  const [locals, setLocals] = useState([]);
  const [selected, setSelected] = useState('');
  const [knowledge, setKnowledge] = useState(null);
  const [details, setDetails] = useState(null);
  const [linkChoice, setLinkChoice] = useState({});
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async ({ keepSelection = true } = {}) => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      apiFetch('/admin/fish-audio/status'),
      apiFetch('/admin/fish-audio/agents'),
      apiFetch('/admin/agents'),
    ]);
    setStatus(results[0].status === 'fulfilled' ? results[0].value : { configured: null, connected: false, error: results[0].reason?.message });
    if (results[1].status === 'fulfilled') setProviders(results[1].value.agents || []);
    else setError(results[1].reason?.message || 'Could not load Fish Audio agents.');
    const localAgents = results[2].status === 'fulfilled' ? results[2].value : [];
    setLocals(localAgents);
    setSelected((current) => {
      if (keepSelection && current && localAgents.some((a) => (a.agent_id || a.id) === current)) return current;
      return localAgents[0] ? String(localAgents[0].agent_id || localAgents[0].id) : '';
    });
    setLoading(false);
  };

  useEffect(() => { load({ keepSelection: false }); }, []);

  const loadAgentData = async (agentId) => {
    if (!agentId) { setKnowledge(null); setDetails(null); return; }
    setError('');
    const [knowledgeRes, detailsRes] = await Promise.allSettled([
      apiFetch(`/admin/agents/${encodeURIComponent(agentId)}/knowledge`),
      apiFetch(`/admin/agents/${encodeURIComponent(agentId)}/fish-audio/details`),
    ]);
    setKnowledge(knowledgeRes.status === 'fulfilled' ? knowledgeRes.value.knowledge : { ...emptyKnowledge, agent_id: agentId });
    setDetails(detailsRes.status === 'fulfilled' ? detailsRes.value : null);
  };

  useEffect(() => { loadAgentData(selected); }, [selected]);

  const selectedAgent = locals.find((a) => String(a.agent_id || a.id) === String(selected));
  const linkedProvider = providers.find((p) => p.agent_id === details?.settings?.fish_provider_agent_id)
    || providers.find((p) => p.local_agent_id === (selectedAgent?.agent_id || selectedAgent?.id));

  const updateKnowledge = (path, value) => {
    setKnowledge((current) => {
      const next = { ...current };
      const [section, field] = path;
      if (field === undefined) next[section] = value;
      else next[section] = { ...(current[section] || {}), [field]: value };
      return next;
    });
  };
  const updateListItem = (section, index, field, value) => {
    setKnowledge((current) => {
      const items = [...(current[section] || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...current, [section]: items };
    });
  };
  const addListItem = (section, template) => {
    setKnowledge((current) => ({ ...current, [section]: [...(current[section] || []), template] }));
  };
  const removeListItem = (section, index) => {
    setKnowledge((current) => ({ ...current, [section]: (current[section] || []).filter((_, i) => i !== index) }));
  };

  const run = async (key, fn, message) => {
    setBusy(key); setError(''); setNotice('');
    try {
      const result = await fn();
      if (message) setNotice(typeof message === 'function' ? message(result) : message);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const saveKnowledge = () => run('save', async () => {
    const body = {
      profile: knowledge?.profile || {},
      services: knowledge?.services || [],
      offers: knowledge?.offers || [],
      documents: knowledge?.documents || [],
      extra_markdown: knowledge?.extra_markdown || '',
    };
    const result = await apiFetch(`/admin/agents/${encodeURIComponent(selected)}/knowledge`, { method: 'PUT', body: JSON.stringify(body) });
    setKnowledge(result.knowledge);
    return result;
  }, 'Knowledge draft saved on the dashboard.');

  const pushKnowledge = () => run('push', async () => {
    const result = await apiFetch(`/admin/agents/${encodeURIComponent(selected)}/knowledge/push`, {
      method: 'POST',
      body: JSON.stringify({
        publish,
        profile: knowledge?.profile || {},
        services: knowledge?.services || [],
        offers: knowledge?.offers || [],
        documents: knowledge?.documents || [],
        extra_markdown: knowledge?.extra_markdown || '',
      }),
    });
    await loadAgentData(selected);
    return result;
  }, (r) => `Knowledge ${r.published_version ? `pushed and published as version ${r.published_version}` : 'pushed to Fish Audio'} (source ${r.provider_source_id}).`);

  const verifyProvider = () => run('verify', async () => {
    const result = await apiFetch(`/admin/agents/${encodeURIComponent(selected)}/knowledge/provider`);
    setNotice(result.linked
      ? `Fish Audio confirms source ${result.source_id} is attached to agent ${result.provider_agent_id}.`
      : 'No knowledge source is attached on Fish Audio yet. Push one first.');
    return result;
  });

  const syncSessions = () => run('sync', async () => {
    const result = await apiFetch(`/admin/agents/${encodeURIComponent(selected)}/fish-audio/sync`, { method: 'POST' });
    await loadAgentData(selected);
    return result;
  }, (r) => `${r.imported} new Fish Audio session(s) imported into tracking.`);

  const linkProvider = (providerAgentId) => {
    const suggested = suggestion(providers.find((p) => p.agent_id === providerAgentId));
    const localId = linkChoice[providerAgentId] || suggested?.agent_id;
    if (!localId) return;
    run(`link-${providerAgentId}`, async () => {
      await apiFetch(`/admin/agents/${encodeURIComponent(localId)}/fish-audio`, {
        method: 'PUT',
        body: JSON.stringify({ fish_agent_id: providerAgentId }),
      });
      await load();
      setSelected(localId);
      return true;
    }, 'Fish Audio agent linked. You can now manage its knowledge below.');
  };

  const suggestion = (provider) => {
    const name = (provider.name || '').toLowerCase().trim();
    if (!name) return '';
    return locals.find((a) => {
      const agentName = (a.name || '').toLowerCase();
      const bizName = (a.business_name || '').toLowerCase();
      return agentName === name || bizName === name || agentName.includes(name) || name.includes(agentName) || bizName.includes(name.split(' ')[0]);
    });
  };

  const providerStats = useMemo(() => ({
    total: providers.length,
    linked: providers.filter((p) => p.local_agent_id).length,
  }), [providers]);

  const sessions = details?.recent_sessions || [];
  const config = details?.config || {};
  const kbIds = config?.knowledge_base?.knowledge_source_ids || [];

  return (
    <section>
      <div className="section-header">
        <h2>Fish Audio control</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" title="Check Fish Audio connection" onClick={() => apiFetch('/admin/fish-audio/status').then(setStatus).catch((e) => setError(e.message))} disabled={busy === 'status'}>
            <Plug size={17} />
            Check connection
          </button>
          <button className="btn btn-secondary" title="Refresh" onClick={() => load()} disabled={loading}>
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {status && !status.configured && (
        <p className="notice">Fish Audio is not configured. Add <strong>FISH_API_KEY</strong> to the backend environment and restart the backend to enable agent discovery, knowledge sync, and tracking.</p>
      )}
      {status?.error && <p className="notice error">{`Connection check failed: ${status.error}`}</p>}
      {status?.connected && (
        <p className="notice">{`Connected to Fish Audio · provider account credit: ${status.provider_credit}`}</p>
      )}
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && (
        <div className="card" role="alert" style={{ borderColor: '#fecaca', color: '#991b1b', marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="stats-grid usage-stats" style={{ marginBottom: 18 }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}><Plug size={23} /></div>
          <div className="stat-info">
            <div className="stat-value">{providerStats.total}</div>
            <div className="stat-label">Fish Audio agents</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#ecfdf5', color: '#059669' }}><Link2 size={23} /></div>
          <div className="stat-info">
            <div className="stat-value">{providerStats.linked}</div>
            <div className="stat-label">Matched to businesses</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#fffbeb', color: '#d97706' }}><FileText size={23} /></div>
          <div className="stat-info">
            <div className="stat-value">{locals.length}</div>
            <div className="stat-label">Dashboard agents</div>
          </div>
        </div>
      </div>

      {/* 1. PROVIDER AGENTS -> BUSINESS MATCHING */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Fish Audio agents</h3>
        <p className="card-subtitle">Every agent available in your Fish Audio workspace, matched to its local business by Agent ID.</p>
        {loading ? (
          <p>Loading Fish Audio agents…</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Agent ID</th>
                  <th>Status</th>
                  <th>Publish state</th>
                  <th>Matched business</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const suggested = suggestion(p);
                  const chosen = linkChoice[p.agent_id] || suggested?.agent_id || '';
                  return (
                    <tr key={p.agent_id}>
                      <td>
                        <strong>{p.name || 'Unnamed agent'}</strong>
                        <p>{p.description || '—'}</p>
                      </td>
                      <td><span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{p.agent_id}</span></td>
                      <td><span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span></td>
                      <td><span className={`badge ${p.publication_state === 'live' ? 'badge-blue' : 'badge-yellow'}`}>{p.publication_state}</span></td>
                      <td>
                        {p.matched_business ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={15} color="#059669" />
                            {p.matched_business}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                            <XCircle size={15} />
                            Unmatched
                          </span>
                        )}
                      </td>
                      <td>
                        {p.local_agent_id ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(String(p.local_agent_id))}>
                            Manage
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select
                              className="form-select"
                              value={chosen}
                              onChange={(e) => setLinkChoice((c) => ({ ...c, [p.agent_id]: e.target.value }))}
                            >
                              <option value="">Select agent…</option>
                              {locals.map((a) => (
                                <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
                                  {a.name}{a.business_name ? ` — ${a.business_name}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={!chosen || busy === `link-${p.agent_id}`}
                              onClick={() => linkProvider(p.agent_id)}
                            >
                              <Link2 size={14} />
                              Link
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!providers.length && !error && (
                  <tr><td colSpan={6}>No Fish Audio agents found in the workspace yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. KNOWLEDGE BASE MANAGEMENT */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3>Knowledge base</h3>
            <p className="card-subtitle">Edit the knowledge here — offers, services, and documents — then push it to Fish Audio. Publish to roll it into live calls immediately.</p>
          </div>
          <label className="form-group">
            <span className="form-label">Agent</span>
            <select className="form-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {locals.map((a) => (
                <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
                  {a.name}{a.business_name ? ` — ${a.business_name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!selectedAgent ? (
          <p>No local agents available yet. Create one from the Voice Agents page first.</p>
        ) : !selectedAgent.fish_agent_id && !linkedProvider ? (
          <p className="notice">This agent has no Fish Audio link yet — match it to a Fish Audio agent in the table above.</p>
        ) : (
          knowledge && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <span className={`badge ${linkedProvider ? 'badge-green' : 'badge-gray'}`}>
                  {linkedProvider ? `Linked: ${linkedProvider.name || linkedProvider.agent_id}` : 'Not linked'}
                </span>
                <span className={`badge ${knowledge.provider_source_id ? 'badge-blue' : 'badge-gray'}`}>
                  {knowledge.provider_source_id ? `Source: ${knowledge.provider_source_id}` : 'No provider source'}
                </span>
                {knowledge.last_pushed_at && (
                  <span className="badge badge-gray">Last push: {new Date(knowledge.last_pushed_at).toLocaleString()}</span>
                )}
                {knowledge.last_published_version != null && (
                  <span className="badge badge-blue">Published v{knowledge.last_published_version}</span>
                )}
              </div>

              <div className="usage-input-grid">
                <Field label="Business description" value={knowledge.profile?.description || ''} onChange={(v) => updateKnowledge(['profile', 'description'], v)} placeholder="What the business does, tone, specialties…" textarea />
                <Field label="Business hours" value={knowledge.profile?.hours || ''} onChange={(v) => updateKnowledge(['profile', 'hours'], v)} placeholder="Mon–Fri 9:00–18:00, Sat 10:00–16:00…" textarea />
                <Field label="Policies" value={knowledge.profile?.policies || ''} onChange={(v) => updateKnowledge(['profile', 'policies'], v)} placeholder="Cancellation policy, deposits, refund rules…" textarea />
              </div>

              <h4 style={{ margin: '14px 0 8px' }}>Services &amp; catalogue</h4>
              {(knowledge.services || []).map((item, index) => (
                <div className="usage-input-grid" key={index} style={{ alignItems: 'end' }}>
                  <Field label="Name" value={item.name || ''} onChange={(v) => updateListItem('services', index, 'name', v)} />
                  <Field label="Price" value={item.price || ''} onChange={(v) => updateListItem('services', index, 'price', v)} />
                  <Field label="Availability" value={item.availability || ''} onChange={(v) => updateListItem('services', index, 'availability', v)} />
                  <Field label="Description" value={item.description || ''} onChange={(v) => updateListItem('services', index, 'description', v)} />
                  <button className="btn btn-danger btn-sm" title="Remove service" onClick={() => removeListItem('services', index)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => addListItem('services', { name: '', description: '', price: '', availability: '' })}>
                <Plus size={14} />
                Add service
              </button>

              <h4 style={{ margin: '14px 0 8px' }}>This week's offers</h4>
              {(knowledge.offers || []).map((item, index) => (
                <div className="usage-input-grid" key={index} style={{ alignItems: 'end' }}>
                  <Field label="Offer title" value={item.title || ''} onChange={(v) => updateListItem('offers', index, 'title', v)} />
                  <Field label="Details" value={item.details || ''} onChange={(v) => updateListItem('offers', index, 'details', v)} />
                  <Field label="Valid until" value={item.valid_until || ''} onChange={(v) => updateListItem('offers', index, 'valid_until', v)} />
                  <button className="btn btn-danger btn-sm" title="Remove offer" onClick={() => removeListItem('offers', index)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => addListItem('offers', { title: '', details: '', valid_until: '' })}>
                <Plus size={14} />
                Add offer
              </button>

              <h4 style={{ margin: '14px 0 8px' }}>Documents (weekly docs, FAQs, procedures)</h4>
              {(knowledge.documents || []).map((item, index) => (
                <div key={index} style={{ border: '1px solid #e3e9f2', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                    <Field label="Document name" value={item.name || ''} onChange={(v) => updateListItem('documents', index, 'name', v)} />
                    <button className="btn btn-danger btn-sm" title="Remove document" onClick={() => removeListItem('documents', index)}><Trash2 size={14} /></button>
                  </div>
                  <Field label="Content (plain text / markdown)" value={item.content || ''} onChange={(v) => updateListItem('documents', index, 'content', v)} textarea />
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => addListItem('documents', { name: '', content: '' })}>
                <Plus size={14} />
                Add document
              </button>

              <h4 style={{ margin: '14px 0 8px' }}>Extra notes (markdown)</h4>
              <Field label="" value={knowledge.extra_markdown || ''} onChange={(v) => updateKnowledge(['extra_markdown'], v)} placeholder="Anything else the agent should know…" textarea />

              <div className="usage-action-row" style={{ marginTop: 16 }}>
                <button className="btn btn-secondary btn-sm" onClick={saveKnowledge} disabled={busy === 'save'}>
                  <Upload size={14} />
                  Save draft
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                  Publish to live calls
                </label>
                <button className="btn btn-yellow btn-sm" onClick={pushKnowledge} disabled={busy === 'push'}>
                  <Send size={14} />
                  {busy === 'push' ? 'Pushing…' : 'Push to Fish Audio'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={verifyProvider} disabled={busy === 'verify'}>
                  <CheckCircle2 size={14} />
                  Verify on provider
                </button>
              </div>
              {(knowledge.push_history || []).length > 0 && (
                <p className="cell-secondary" style={{ marginTop: 8, fontSize: 12 }}>
                  Recent pushes: {knowledge.push_history.slice(0, 5).map((h) => `${new Date(h.at).toLocaleString()}${h.version ? ` (v${h.version})` : ''}`).join(' · ')}
                </p>
              )}
            </>
          )
        )}
      </div>

      {/* 3. TRACKING & ANALYSIS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3>Tracking &amp; analysis</h3>
            <p className="card-subtitle">Live agent configuration from Fish Audio plus imported session analytics.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={syncSessions} disabled={!selected || busy === 'sync'}>
            <RefreshCw size={14} />
            {busy === 'sync' ? 'Syncing…' : 'Sync sessions'}
          </button>
        </div>

        {!linkedProvider ? (
          <p className="notice">Link this agent to a Fish Audio agent to see configuration, sessions, and call analysis.</p>
        ) : (
          <>
            <div className="usage-input-grid" style={{ margin: '12px 0' }}>
              <div className="form-group"><span className="form-label">Provider agent</span><p style={{ margin: 0 }}>{linkedProvider.name || '—'}</p></div>
              <div className="form-group"><span className="form-label">Agent ID</span><p style={{ margin: 0, fontFamily: 'monospace' }}>{linkedProvider.agent_id}</p></div>
              <div className="form-group"><span className="form-label">Publish state</span><p style={{ margin: 0 }}>{linkedProvider.publication_state || '—'}</p></div>
              <div className="form-group"><span className="form-label">Knowledge attached</span><p style={{ margin: 0 }}>{config?.knowledge_base?.enabled ? `${kbIds.length} source(s)` : 'Disabled'}</p></div>
            </div>
            {config?.prompt?.system_prompt && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: '#2563eb' }}>Current Fish Audio system prompt (draft)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 8 }}>{config.prompt.system_prompt}</pre>
              </details>
            )}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Direction</th>
                    <th>Caller</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.session_id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.session_id}</td>
                      <td>{s.started_at || s.created_at ? new Date(s.started_at || s.created_at).toLocaleString() : '—'}</td>
                      <td>{s.duration_seconds != null ? `${Math.round(s.duration_seconds / 6) / 10} min` : '—'}</td>
                      <td><span className={`badge ${s.status === 'completed' ? 'badge-green' : 'badge-red'}`}>{s.status}</span></td>
                      <td>{s.direction || '—'}</td>
                      <td>{s.caller_number || '—'}</td>
                    </tr>
                  ))}
                  {!sessions.length && (
                    <tr><td colSpan={6}>No sessions on Fish Audio for this agent yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 10 }}>
              <BadgeDollarSign size={14} style={{ verticalAlign: '-2px' }} />{' '}
              Credit balances and minute-by-minute analysis live on the <a href="/usage">Usage &amp; Credits</a> page.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
