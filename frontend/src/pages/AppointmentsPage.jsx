import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal actions
  const [rescheduleApt, setRescheduleApt] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [cancelApt, setCancelApt] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const [newAptModal, setNewAptModal] = useState(false);
  const [newAptData, setNewAptData] = useState({
    business_id: 'bawarchi-birmingham',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    appointment_date: '2026-09-20',
    appointment_time: '14:00',
    service_name: 'Consultation Appointment',
    notes: ''
  });

  const loadAppointments = () => {
    setLoading(true);
    apiFetch('/admin/appointments')
      .then((data) => {
        if (Array.isArray(data)) setAppointments(data);
      })
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleReschedule = async () => {
    if (!rescheduleApt || !newDate || !newTime) return;
    try {
      await apiFetch('/api/appointment-booking/appointments/reschedule', {
        method: 'PUT',
        body: JSON.stringify({
          business_id: rescheduleApt.business_name?.toLowerCase().includes('bawarchi') ? 'bawarchi-birmingham' : 'mkn-finance-india',
          appointment_id: rescheduleApt.appointment_id,
          new_date: newDate,
          new_time: newTime,
          reason: rescheduleReason
        })
      });
      setRescheduleApt(null);
      loadAppointments();
    } catch (e) {
      alert('Reschedule error: ' + e.message);
    }
  };

  const handleCancel = async () => {
    if (!cancelApt) return;
    try {
      await apiFetch('/api/appointment-booking/appointments/cancel', {
        method: 'PUT',
        body: JSON.stringify({
          business_id: cancelApt.business_name?.toLowerCase().includes('bawarchi') ? 'bawarchi-birmingham' : 'mkn-finance-india',
          appointment_id: cancelApt.appointment_id,
          reason: cancelReason
        })
      });
      setCancelApt(null);
      loadAppointments();
    } catch (e) {
      alert('Cancel error: ' + e.message);
    }
  };

  const handleCreateAppointment = async () => {
    if (!newAptData.customer_name || !newAptData.customer_phone) {
      alert('Please provide Customer Name and Phone.');
      return;
    }
    try {
      await apiFetch('/api/appointment-booking/appointments', {
        method: 'POST',
        body: JSON.stringify(newAptData)
      });
      setNewAptModal(false);
      loadAppointments();
    } catch (e) {
      alert('Booking error: ' + e.message);
    }
  };

  const filtered = appointments.filter((a) => {
    const matchesSearch =
      a.appointment_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.customer_phone?.toLowerCase().includes(search.toLowerCase()) ||
      a.service_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.business_name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Appointment Bookings</h2>
            <p className="card-subtitle">
              Live appointments scheduled across businesses via voice agents and the Service Booking Router.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setNewAptModal(true)}>
            <span>📅</span>
            <span>+ Book Appointment</span>
          </button>
        </div>

        <div className="search-filter-bar" style={{ marginTop: 16 }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by ID, customer name, phone, or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* APPOINTMENTS TABLE */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading appointments...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No matching appointments found.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Appointment ID</th>
                  <th>Business</th>
                  <th>Customer Name</th>
                  <th>Phone Number</th>
                  <th>Service Offering</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt) => (
                  <tr key={apt.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                      {apt.appointment_id}
                    </td>
                    <td>{apt.business_name}</td>
                    <td style={{ fontWeight: 600 }}>{apt.customer_name}</td>
                    <td>{apt.customer_phone}</td>
                    <td>{apt.service_name}</td>
                    <td style={{ fontWeight: 600 }}>
                      {apt.appointment_date} @ {apt.appointment_time}
                    </td>
                    <td>{apt.duration_minutes || 45} mins</td>
                    <td>
                      <span className={`badge ${
                        apt.status === 'CONFIRMED' ? 'badge-green' :
                        apt.status === 'RESCHEDULED' ? 'badge-yellow' : 'badge-red'
                      }`}>
                        {apt.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{apt.source || 'voice_agent'}</span>
                    </td>
                    <td>
                      {apt.status !== 'CANCELLED' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setRescheduleApt(apt);
                              setNewDate(apt.appointment_date);
                              setNewTime(apt.appointment_time);
                            }}
                          >
                            Reschedule
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setCancelApt(apt)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESCHEDULE MODAL */}
      {rescheduleApt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Reschedule Appointment {rescheduleApt.appointment_id}</h3>
              <button className="modal-close-btn" onClick={() => setRescheduleApt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Time Slot</label>
                <input
                  type="time"
                  className="form-input"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Rescheduling</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Customer requested later time"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRescheduleApt(null)}>Close</button>
              <button className="btn btn-primary" onClick={handleReschedule}>Confirm Reschedule</button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelApt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Cancel Appointment {cancelApt.appointment_id}</h3>
              <button className="modal-close-btn" onClick={() => setCancelApt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
                Are you sure you want to cancel the booking for <strong>{cancelApt.customer_name}</strong> on {cancelApt.appointment_date} at {cancelApt.appointment_time}?
              </p>
              <div className="form-group">
                <label className="form-label">Cancellation Reason</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Customer change of schedule"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelApt(null)}>Close</button>
              <button className="btn btn-danger" onClick={handleCancel}>Confirm Cancellation</button>
            </div>
          </div>
        </div>
      )}

      {/* BOOK NEW APPOINTMENT MODAL */}
      {newAptModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Book New Appointment</h3>
              <button className="modal-close-btn" onClick={() => setNewAptModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Full Name"
                  value={newAptData.customer_name}
                  onChange={(e) => setNewAptData({ ...newAptData, customer_name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="205-555-0199"
                    value={newAptData.customer_phone}
                    onChange={(e) => setNewAptData({ ...newAptData, customer_phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="customer@example.com"
                    value={newAptData.customer_email}
                    onChange={(e) => setNewAptData({ ...newAptData, customer_email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newAptData.appointment_date}
                    onChange={(e) => setNewAptData({ ...newAptData, appointment_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot</label>
                  <input
                    type="time"
                    className="form-input"
                    value={newAptData.appointment_time}
                    onChange={(e) => setNewAptData({ ...newAptData, appointment_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Service Offering</label>
                <input
                  type="text"
                  className="form-input"
                  value={newAptData.service_name}
                  onChange={(e) => setNewAptData({ ...newAptData, service_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Special requests or instructions"
                  value={newAptData.notes}
                  onChange={(e) => setNewAptData({ ...newAptData, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewAptModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={handleCreateAppointment}>Create Appointment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
