import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);

  const loadLeads = () => {
    setLoading(true);
    apiFetch('/admin/leads')
      .then((data) => {
        if (Array.isArray(data)) setLeads(data);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered = leads.filter((l) =>
    l.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.customer_phone?.toLowerCase().includes(search.toLowerCase()) ||
    l.product_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Qualified Inquiries & Leads</h2>
            <p className="card-subtitle">
              Prospective customers and borrowers qualified via voice agent conversational discovery.
            </p>
          </div>
          <span className="badge badge-yellow">{filtered.length} active leads</span>
        </div>

        <div className="search-filter-bar" style={{ marginTop: 16 }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search leads by customer name, phone, product, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* LEADS TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading leads...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No leads recorded yet.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Business Entity</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Product / Interest</th>
                  <th>Amount</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{l.customer_name}</td>
                    <td>{l.business_name}</td>
                    <td>{l.customer_phone}</td>
                    <td>{l.customer_email || '—'}</td>
                    <td>
                      <span className="badge badge-blue">{l.product_type || 'Consultation'}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {l.requested_amount ? `₹${Number(l.requested_amount).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td>{l.city || '—'}</td>
                    <td>
                      <span className={`badge ${
                        l.status === 'QUALIFIED' ? 'badge-green' : 'badge-yellow'
                      }`}>
                        {l.status || 'NEW'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{l.source || 'voice_agent'}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLead(l)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEAD DETAILS MODAL */}
      {selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <h3>Lead Details: {selectedLead.customer_name}</h3>
                <p className="card-subtitle">{selectedLead.product_type} • {selectedLead.business_name}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedLead(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ background: '#f8fafc' }}>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div><strong>Phone:</strong> {selectedLead.customer_phone}</div>
                  <div><strong>Email:</strong> {selectedLead.customer_email || 'N/A'}</div>
                  <div><strong>City:</strong> {selectedLead.city || 'N/A'}</div>
                  <div><strong>Requested Amount:</strong> {selectedLead.requested_amount ? `₹${Number(selectedLead.requested_amount).toLocaleString('en-IN')}` : 'N/A'}</div>
                  <div><strong>Qualification Notes:</strong> {selectedLead.notes || 'Captured via voice interaction.'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
