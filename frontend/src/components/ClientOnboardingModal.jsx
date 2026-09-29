import { useState, useEffect } from 'react';
import { 
  Building2, 
  HelpCircle, 
  Sparkles, 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  Phone, 
  ShieldCheck, 
  Coins, 
  FileText, 
  Receipt, 
  X,
  CreditCard,
  Bot,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { apiFetch } from '../api';

const INDUSTRIES = [
  { id: 'loan_agency', label: 'Banking, NBFC & Loans', icon: '💳', desc: 'Personal loans, business credit, vehicle financing & verification' },
  { id: 'healthcare', label: 'Healthcare & Specialized Clinics', icon: '🩺', desc: 'Doctor consultations, appointment booking, patient intake' },
  { id: 'real_estate', label: 'Real Estate & Property Developers', icon: '🏢', desc: 'Site visit scheduling, project inquiries, buyer qualification' },
  { id: 'automotive', label: 'Automotive & Dealerships', icon: '🚗', desc: 'Test drive booking, pre-owned car valuation, service scheduling' },
  { id: 'retail', label: 'Retail, D2C & Hospitality', icon: '🛍️', desc: 'Restaurant reservations, order status, omnichannel support' },
  { id: 'services', label: 'Professional & Business Services', icon: '🛠️', desc: 'Legal consults, corporate advisory, lead triage' }
];

const PLANS = [
  { id: 'starter', name: 'Starter Voice Plan', fee: 4999, mins: 500, desc: 'Ideal for single branch or pilot telephony rollout' },
  { id: 'growth', name: 'Growth Pro Tier', fee: 12999, mins: 1500, desc: 'High concurrency, 1,500 monthly minutes & priority Sarvam routing', popular: true },
  { id: 'enterprise', name: 'Enterprise Custom Tier', fee: 29999, mins: 5000, desc: '5,000+ minutes, dedicated DID lines, multi-agent queues & SLA' }
];

export default function ClientOnboardingModal({ isOpen, onClose, onClientOnboarded, currencyRate = 86.5, currency = 'INR' }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availablePhones, setAvailablePhones] = useState([]);
  const [sarvamAgents, setSarvamAgents] = useState([]);
  const [resultData, setResultData] = useState(null);

  // Form State
  const [form, setForm] = useState({
    business_name: '',
    spoken_name: '',
    industry: 'loan_agency',
    phone: '',
    email: '',
    city: 'Hyderabad',
    state: 'Telangana',
    address: '',
    user_id: '',
    password: '',
    plan_tier: 'growth',
    setup_fee_paid: true,
    setup_fee_amount: 9999,
    allocated_minutes: 1500,
    sarvam_agent_id: 'MKN-Financi-3af4be5e-3450',
    voice_id: 'rupa',
    language: 'hi-IN',
    phone_number_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setResultData(null);
      // Fetch phone numbers & Sarvam agents
      Promise.allSettled([
        apiFetch('/admin/sarvam/phone-numbers'),
        apiFetch('/admin/sarvam/agents')
      ]).then(([pRes, aRes]) => {
        if (pRes.status === 'fulfilled' && Array.isArray(pRes.value)) {
          setAvailablePhones(pRes.value);
          const firstAvail = pRes.value.find(p => p.status === 'available');
          if (firstAvail) {
            setForm(prev => ({ ...prev, phone_number_id: firstAvail.id }));
          }
        }
        if (aRes.status === 'fulfilled' && Array.isArray(aRes.value)) {
          setSarvamAgents(aRes.value);
          if (aRes.value.length > 0) {
            setForm(prev => ({ ...prev, sarvam_agent_id: aRes.value[0].agent_id }));
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const generateCredentials = () => {
    const cleanName = (form.business_name || 'client').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const randNum = Math.floor(100 + Math.random() * 900);
    const newUserId = `${cleanName}_admin`;
    const newPassword = `${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}@${randNum}!`;
    setForm(prev => ({ ...prev, user_id: newUserId, password: newPassword }));
  };

  const selectedPlan = PLANS.find(p => p.id === form.plan_tier) || PLANS[1];
  const sarvamCostEst = Math.round(form.allocated_minutes * 1.25);
  const totalInvoiced = Number(selectedPlan.fee) + (form.setup_fee_paid ? Number(form.setup_fee_amount || 0) : 0);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        monthly_fee: selectedPlan.fee
      };
      const res = await apiFetch('/admin/onboard-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setResultData(res);
      setStep(5);
      if (onClientOnboarded) onClientOnboarded(res);
    } catch (err) {
      alert(`Onboarding failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = () => {
    const credText = `Scadova AI Client Portal Access\nBusiness: ${form.business_name}\nUser ID: ${resultData?.credentials?.user_id || form.user_id}\nPassword: ${resultData?.credentials?.password || form.password}\nPortal: ${window.location.origin}`;
    navigator.clipboard.writeText(credText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="onboarding-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 720,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8fafc, #ffffff)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: '#2563eb', textTransform: 'uppercase' }}>
                Interactive Onboarding Questionnaire
              </span>
              <span className="badge badge-blue">Indian Enterprise</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
              {step === 5 ? '🎉 Client Successfully Onboarded!' : `Step ${step} of 4: Gathering Client Specifications`}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 6, borderRadius: 8 }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* PROGRESS INDICATOR */}
        {step < 5 && (
          <div style={{ padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
            {[
              { num: 1, title: 'Identity & Industry' },
              { num: 2, title: 'Credentials' },
              { num: 3, title: 'Plan & Invoicing' },
              { num: 4, title: 'Sarvam Allocation' }
            ].map((s) => (
              <div key={s.num} style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 8,
                background: step === s.num ? '#ffffff' : 'transparent',
                border: step === s.num ? '1px solid #cbd5e1' : '1px solid transparent',
                boxShadow: step === s.num ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}>
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: step > s.num ? '#10b981' : (step === s.num ? '#2563eb' : '#e2e8f0'),
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {step > s.num ? <Check size={13} /> : s.num}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: step >= s.num ? '#0f172a' : '#94a3b8' }}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* BODY CONTENT */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: BUSINESS IDENTITY & INDUSTRY */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  Question 1: What is the legal registered name of the business entity?
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  placeholder="e.g. MKN Financial Services Pvt Ltd / Apollo Healthcare"
                  value={form.business_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      business_name: val,
                      spoken_name: prev.spoken_name ? prev.spoken_name : val
                    }));
                  }}
                  autoFocus
                />
              </div>

              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Question 2: How should our AI voice agent pronounce the business name to callers? (Spoken Name)
                </label>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px 0' }}>
                  Natural spoken sound to prevent robotic legal suffixes (e.g. say "MKN Finance" instead of "MKN Financial Services Private Limited").
                </p>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  placeholder="e.g. MKN Finance"
                  value={form.spoken_name}
                  onChange={(e) => setForm({ ...form, spoken_name: e.target.value })}
                />
              </div>

              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Question 3: Which industry domain does this business operate in?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {INDUSTRIES.map((ind) => (
                    <div
                      key={ind.id}
                      onClick={() => setForm({ ...form, industry: ind.id })}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        border: form.industry === ind.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: form.industry === ind.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{ind.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{ind.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ind.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="question-card" style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    Official Contact Phone
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    placeholder="+91 98490 12345"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="question-card" style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    City & State
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                    placeholder="Hyderabad, Telangana"
                    value={`${form.city}, ${form.state}`}
                    onChange={(e) => {
                      const parts = e.target.value.split(',');
                      setForm({ ...form, city: (parts[0] || '').trim(), state: (parts[1] || 'Telangana').trim() });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CREDENTIALS */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                color: '#ffffff',
                padding: 20,
                borderRadius: 14,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
                    Client Portal Access Generator
                  </span>
                  <button
                    type="button"
                    onClick={generateCredentials}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Sparkles size={14} /> Auto-Generate
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 16px 0' }}>
                  Each registered client receives administrative credentials to access their dedicated live Client Dashboard.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                      Portal User ID / Login Username
                    </label>
                    <input
                      type="text"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 600
                      }}
                      placeholder="e.g. mkn_ops"
                      value={form.user_id}
                      onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                      Portal Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 12px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#ffffff',
                          fontSize: 14,
                          fontWeight: 600
                        }}
                        placeholder="Secure Password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Question 4: Client Administrator Notification Email
                </label>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px 0' }}>
                  Daily CSV exports, call recording links, and billing invoices will be dispatched here.
                </p>
                <input
                  type="email"
                  className="form-input"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                  placeholder="admin@mknfinance.in"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* STEP 3: PLAN, INVOICING & CREDITS */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Question 5: Which subscription plan tier is being assigned?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {PLANS.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setForm({ ...form, plan_tier: p.id, allocated_minutes: p.mins })}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: form.plan_tier === p.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: form.plan_tier === p.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                    >
                      {p.popular && (
                        <span style={{
                          position: 'absolute',
                          top: -9,
                          right: 12,
                          background: '#2563eb',
                          color: '#ffffff',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 20,
                          textTransform: 'uppercase'
                        }}>
                          Recommended
                        </span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb', margin: '4px 0' }}>
                        ₹{p.fee.toLocaleString('en-IN')}<small style={{ fontSize: 11, color: '#64748b' }}>/mo</small>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>{p.mins} Monthly Minutes</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SETUP FEE QUESTION */}
              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      Question 6: Was a one-time onboarding / setup fee paid?
                    </label>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                      One-time charge for Sarvam fine-tuning, voice persona training, and telephony DID provisioning.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, setup_fee_paid: true })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        background: form.setup_fee_paid ? '#10b981' : '#e2e8f0',
                        color: form.setup_fee_paid ? '#ffffff' : '#475569',
                        border: 'none'
                      }}
                    >
                      Yes, Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, setup_fee_paid: false })}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        background: !form.setup_fee_paid ? '#ef4444' : '#e2e8f0',
                        color: !form.setup_fee_paid ? '#ffffff' : '#475569',
                        border: 'none'
                      }}
                    >
                      Waived / No
                    </button>
                  </div>
                </div>

                {form.setup_fee_paid && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                      Setup Fee Amount (₹ INR):
                    </label>
                    <input
                      type="number"
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, width: 140 }}
                      value={form.setup_fee_amount}
                      onChange={(e) => setForm({ ...form, setup_fee_amount: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {/* AUTO CREDIT CALCULATION & INVOICE PREVIEW */}
              <div style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Receipt size={18} color="#2563eb" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                    Auto-Calculated Credits & Invoice Summary
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  <div style={{ background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Allocated Minutes</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{form.allocated_minutes} min</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Credits Granted (1/min)</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{form.allocated_minutes} Credits</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Sarvam Base Cost Est.</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>₹{sarvamCostEst.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Total Invoiced Amount (GST Excl.):</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>₹{totalInvoiced.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SARVAM AGENT & PHONE NUMBER ALLOCATION */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Question 7: Link with Sarvam AI Voice Agent
                </label>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px 0' }}>
                  Select which active Sarvam neural voice agent should be allocated to handle customer calls for this client.
                </p>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600 }}
                  value={form.sarvam_agent_id}
                  onChange={(e) => {
                    const agId = e.target.value;
                    const ag = sarvamAgents.find(a => a.agent_id === agId);
                    setForm({
                      ...form,
                      sarvam_agent_id: agId,
                      voice_id: ag?.voice || form.voice_id,
                      language: ag?.language || form.language
                    });
                  }}
                >
                  {sarvamAgents.map(ag => (
                    <option key={ag.agent_id} value={ag.agent_id}>
                      {ag.name} ({ag.voice_label}) — v{ag.version}
                    </option>
                  ))}
                </select>
              </div>

              <div className="question-card" style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Question 8: Allocate Available Sarvam Telephony DID Number
                </label>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px 0' }}>
                  Dedicated national CLI / SIP DID for automated outbound campaigns and inbound customer responses.
                </p>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600 }}
                  value={form.phone_number_id}
                  onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                >
                  <option value="">No dedicated DID (Shared outbound queue)</option>
                  {availablePhones.map(pn => (
                    <option key={pn.id} value={pn.id}>
                      {pn.number} — {pn.region} ({pn.type}) [{pn.status === 'available' ? 'AVAILABLE' : `IN USE by ${pn.business_name || 'Agent'}`}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                gap: 12
              }}>
                <Bot size={28} color="#2563eb" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1e40af' }}>
                    Ready to Deploy AI Voice Persona for {form.spoken_name || form.business_name || 'Client'}
                  </div>
                  <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
                    Submitting will finalize the client account, issue invoice INV-{new Date().getFullYear()}-003, credit {form.allocated_minutes} minutes, and activate the Client Dashboard.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: ONBOARDED SUCCESS CARD */}
          {step === 5 && resultData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                padding: 24,
                borderRadius: 16,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <CheckCircle2 size={24} />
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Account & Telephony Initialized</span>
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 16px 0' }}>
                  {form.business_name}
                </h2>

                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#a7f3d0' }}>Client User ID</span>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{resultData.credentials?.user_id}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#a7f3d0' }}>Password</span>
                    <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace' }}>{resultData.credentials?.password}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#a7f3d0' }}>Linked Sarvam Agent</span>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{resultData.allocated_agent_id}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#a7f3d0' }}>Assigned DID Line</span>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{resultData.assigned_phone_number || 'Shared Queue'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button
                    onClick={copyCreds}
                    style={{
                      background: '#ffffff',
                      color: '#047857',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Credentials Copied!' : 'Copy Credentials'}
                  </button>
                </div>
              </div>

              {/* INVOICE CARD */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Invoice {resultData.invoice?.invoice_id}</span>
                  <span className="badge badge-green">PAID</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {resultData.invoice?.plan_name} + Setup Fee · Total Invoiced: <strong>₹{resultData.invoice?.total_invoiced_inr?.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#ffffff'
        }}>
          {step < 5 ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={step === 1 || loading}
                onClick={() => setStep(step - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (step === 1 && !form.business_name.trim()) {
                      alert('Please specify the legal business name.');
                      return;
                    }
                    if (step === 1 && !form.user_id) {
                      generateCredentials();
                    }
                    setStep(step + 1);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={handleSubmit}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981' }}
                >
                  {loading ? 'Onboarding Client…' : 'Complete & Launch Client Portal'} <Sparkles size={16} />
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  if (resultData?.business?.id) {
                    window.dispatchEvent(new CustomEvent('scadova:view_client', { detail: { businessId: resultData.business.id } }));
                  }
                }}
              >
                View Client Dashboard Preview <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
