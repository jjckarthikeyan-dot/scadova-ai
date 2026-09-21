import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  BadgeDollarSign,
  AudioLines,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { apiFetch } from "../api";

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtDuration = (s) =>
  s != null ? `${Math.round(s / 6) / 10} min` : "—";

export default function AgentsPage({ onOpenOnboarding }) {
  const [agents, setAgents] = useState([]);
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [panels, setPanels] = useState({});
  const [syncing, setSyncing] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    Promise.allSettled([apiFetch("/admin/agents"), apiFetch("/admin/fish-audio/agents")])
      .then(([agentsRes, providersRes]) => {
        if (agentsRes.status === "fulfilled") setAgents(agentsRes.value);
        else setError(agentsRes.reason?.message || "");
        if (providersRes.status === "fulfilled") {
          const map = {};
          (providersRes.value.agents || []).forEach((p) => { map[p.agent_id] = p; });
          setProviders(map);
        }
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadPanel = (id) => {
    setPanels((p) => ({ ...p, [id]: { ...(p[id] || {}), loading: true, error: "" } }));
    Promise.allSettled([
      apiFetch(`/admin/agents/${encodeURIComponent(id)}/fish-audio/details`),
      apiFetch(`/admin/agents/${encodeURIComponent(id)}/knowledge`),
    ]).then(([detailsRes, knowledgeRes]) => {
      setPanels((p) => ({
        ...p,
        [id]: {
          loading: false,
          error: detailsRes.status === "rejected" ? detailsRes.reason?.message || "" : "",
          details: detailsRes.status === "fulfilled" ? detailsRes.value : null,
          knowledge: knowledgeRes.status === "fulfilled" ? knowledgeRes.value.knowledge : null,
        },
      }));
    });
  };

  const toggle = (agent) => {
    const id = String(agent.agent_id || agent.id);
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    loadPanel(id);
  };

  const syncSessions = async (agent) => {
    const id = String(agent.agent_id || agent.id);
    setSyncing(id);
    try {
      const result = await apiFetch(`/admin/agents/${encodeURIComponent(id)}/fish-audio/sync`, { method: "POST" });
      loadPanel(id);
      setPanels((p) => ({ ...p, [id]: { ...(p[id] || {}), notice: `${result.imported} session(s) imported.` } }));
    } catch (e) {
      setPanels((p) => ({ ...p, [id]: { ...(p[id] || {}), error: e.message } }));
    } finally {
      setSyncing("");
    }
  };

  const renderPanel = (agent) => {
    const id = String(agent.agent_id || agent.id);
    const info = panels[id] || {};
    const provider = agent.fish_provider_agent_id ? providers[agent.fish_provider_agent_id] : null;
    const config = info.details?.config || {};
    const kb = config.knowledge_base || {};
    const sessions = (info.details?.recent_sessions || []).slice(0, 5);

    return (
      <tr key={`${id}-panel`}>
        <td colSpan={7} style={{ background: "#f8fafc", padding: 0, borderBottom: "1px solid #e3e9f2" }}>
          <div style={{ padding: 16 }}>
            {info.loading && <p>Loading agent details…</p>}
            {!info.loading && info.notice && <p className="notice" role="status">{info.notice}</p>}
            {!info.loading && info.error && (
              <p role="alert" style={{ color: "#be123c", marginBottom: 10 }}>{info.error}</p>
            )}
            {!info.loading && !info.error && (
              <>
                <div className="usage-input-grid" style={{ marginBottom: 12 }}>
                  <div className="form-group"><span className="form-label">Agent ID</span><p style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>{id}</p></div>
                  <div className="form-group">
                    <span className="form-label">Fish Audio agent</span>
                    <p style={{ margin: 0 }}>
                      {provider ? (
                        <>
                          {provider.name || provider.agent_id}
                          <span className={`badge ${provider.publication_state === "live" ? "badge-green" : "badge-yellow"}`} style={{ marginLeft: 8 }}>
                            {provider.publication_state}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Not linked</span>
                      )}
                    </p>
                  </div>
                  <div className="form-group">
                    <span className="form-label">Knowledge base on Fish Audio</span>
                    <p style={{ margin: 0 }}>
                      {kb.enabled ? (
                        `${(kb.knowledge_source_ids || []).length} source(s) attached`
                      ) : agent.fish_provider_agent_id ? "Disabled" : "—"}
                    </p>
                  </div>
                  <div className="form-group">
                    <span className="form-label">Last knowledge push</span>
                    <p style={{ margin: 0 }}>
                      {info.knowledge?.last_pushed_at ? fmtDateTime(info.knowledge.last_pushed_at) : "Never"}
                      {info.knowledge?.last_published_version != null ? ` · published v${info.knowledge.last_published_version}` : ""}
                    </p>
                  </div>
                </div>

                <div className="usage-action-row" style={{ marginBottom: 12 }}>
                  <Link className="btn btn-secondary btn-sm" to="/fish-audio">
                    <AudioLines size={14} />
                    {agent.fish_provider_agent_id ? "Manage knowledge & config" : "Connect to Fish Audio"}
                  </Link>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={!agent.fish_provider_agent_id || syncing === id}
                    onClick={(e) => { e.stopPropagation(); syncSessions(agent); }}
                  >
                    <RefreshCw size={14} />
                    {syncing === id ? "Syncing…" : "Sync sessions"}
                  </button>
                  <Link className="btn btn-secondary btn-sm" to="/usage">
                    <BadgeDollarSign size={14} />
                    Credits & usage
                  </Link>
                  {agent.fish_provider_agent_id && (
                    <small className="cell-secondary">Provider ID: {agent.fish_provider_agent_id}</small>
                  )}
                </div>

                {agent.fish_provider_agent_id && (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Session</th>
                          <th>Started</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Caller</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.session_id}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.session_id}</td>
                            <td>{fmtDateTime(s.started_at || s.created_at)}</td>
                            <td>{fmtDuration(s.duration_seconds)}</td>
                            <td><span className={`badge ${s.status === "completed" ? "badge-green" : "badge-red"}`}>{s.status}</span></td>
                            <td>{s.caller_number || "—"}</td>
                          </tr>
                        ))}
                        {!sessions.length && (
                          <tr><td colSpan={5}>No sessions on Fish Audio yet. Use “Sync sessions” after calls happen.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <section>
      <div className="section-header">
        <h2>Voice agents</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            title="Refresh agents"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={17} />
          </button>
          <button className="btn btn-yellow" onClick={onOpenOnboarding}>
            <Plus size={17} />
            Create voice agent
          </button>
        </div>
      </div>
      {error && (
        <p role="alert">
          {error} <Link to="/integrations">Integrations</Link>
        </p>
      )}
      {loading ? (
        <p>Loading agents...</p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Business</th>
                <th>Fish Audio</th>
                <th>Tools</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const key = String(a.agent_id || a.id);
                const expanded = expandedId === key;
                return [
                  <tr
                    key={key}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggle(a)}
                    title="Show agent details, tracking and knowledge"
                  >
                    <td>
                      <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        {a.name}
                      </strong>
                      <p>{a.role || a.description}</p>
                      <p style={{ color: '#64748b', fontSize: 12 }}>{a.agent_id || a.id}</p>
                    </td>
                    <td>{a.status}</td>
                    <td>{a.business_name || '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {a.fish_provider_agent_id ? (
                        <Link
                          to="/fish-audio"
                          title="Open Fish Audio control"
                          style={{ fontFamily: 'monospace', fontSize: 12 }}
                        >
                          {providers[a.fish_provider_agent_id]?.name || a.fish_provider_agent_id}
                        </Link>
                      ) : (
                        <Link to="/fish-audio" title="Link a Fish Audio agent" style={{ fontSize: 12 }}>
                          Link →
                        </Link>
                      )}
                    </td>
                    <td>{(a.attached_tools || []).length}</td>
                    <td>
                      {a.last_synced || a.updated_at
                        ? new Date(a.last_synced || a.updated_at).toLocaleString()
                        : "-"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link className="btn btn-secondary btn-sm" to="/usage">
                          <BadgeDollarSign size={15} />
                          Credits
                        </Link>
                      </div>
                    </td>
                  </tr>,
                  expanded ? renderPanel(a) : null,
                ];
              })}
            </tbody>
          </table>
          {!agents.length && !error && (
            <p>No local agents are available yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
