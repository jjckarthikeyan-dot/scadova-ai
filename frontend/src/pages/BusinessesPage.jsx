import { useEffect, useState, useCallback } from 'react';
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
  FileText,
  Sparkles,
  Copy,
  CheckCheck,
  Wand2,
  Code2,
  RotateCcw,
  AlertCircle,
  Lock,
  Unlock,
  CheckCircle
} from 'lucide-react';
import { apiFetch } from '../api';

// ============================================================
// DEFAULT OPERATING HOURS TEMPLATE
// ============================================================
const DEFAULT_WEEK_HOURS = [
  { day: 'Monday', open_time: '09:00', close_time: '17:00', closed: false },
  { day: 'Tuesday', open_time: '09:00', close_time: '17:00', closed: false },
  { day: 'Wednesday', open_time: '09:00', close_time: '17:00', closed: false },
  { day: 'Thursday', open_time: '09:00', close_time: '17:00', closed: false },
  { day: 'Friday', open_time: '09:00', close_time: '17:00', closed: false },
  { day: 'Saturday', open_time: '10:00', close_time: '15:00', closed: false },
  { day: 'Sunday', open_time: '10:00', close_time: '14:00', closed: true },
];

// ============================================================
// FISH AUDIO VOICE PROFILE MASTER DIRECTORY
// ============================================================
export const VOICE_PROFILES = [
  { id: 'fish_audio_default', name: 'Fish Audio Default', label: 'Fish Audio Default (System Standard)', group: 'default' },
  { id: 'serena_exec_en', name: 'Fish Audio - Serena (Executive English)', label: 'Fish Audio - Serena (Executive English)', group: 'curated' },
  { id: 'marcus_conv_en', name: 'Fish Audio - Marcus (Conversational English)', label: 'Fish Audio - Marcus (Conversational English)', group: 'curated' },
  { id: 'sophia_care_en', name: 'Fish Audio - Sophia (Warm Healthcare English)', label: 'Fish Audio - Sophia (Warm Healthcare English)', group: 'curated' },
  { id: 'ravi_finance_te_en', name: 'Fish Audio - Ravi (Professional Multilingual)', label: 'Fish Audio - Ravi (Professional Multilingual)', group: 'curated' },
];

// ============================================================
// INDUSTRY SYSTEM PROMPTS & GREETING TEMPLATES (DEFAULTS)
// ============================================================
const DEFAULT_TEMPLATES = {
  service_and_appointment: {
    key: 'service_and_appointment',
    label: 'Appointment Booking & Service Consultation',
    role: 'Appointment & Consultation Specialist',
    voice_name: 'Fish Audio Default',
    voice_id: 'fish_audio_default',
    language: 'en',
    tools: [
      'get_services',
      'get_service_details',
      'get_pricing',
      'get_business_hours',
      'create_appointment',
      'search_appointment',
      'reschedule_appointment',
      'cancel_appointment'
    ],
    greeting: `Hi, welcome to {{business_name}}. I am {{agent_name}}, your AI assistant.

I can help you learn about our services, check pricing or business hours, schedule an appointment, reschedule an existing appointment, or cancel an appointment.

How can I help you today?`,
    system_prompt: `You are {{agent_name}}, the AI Voice Assistant for {{business_name}}.

Your job is to help callers understand the business, learn about available services or products, check pricing and business hours, schedule appointments when supported, find existing appointments, reschedule appointments, cancel appointments, and assist with other business-specific actions available through your connected tools.


BUSINESS DATA SOURCE

The FastAPI backend and connected database are the source of truth.

Business Key:
{{business_key}}

Never rely on hardcoded:

Business information
Service names
Product names
Service descriptions
Prices
Durations
Business hours
Availability
Appointment information
Appointment IDs
Policies
Business-specific data

Always use the available backend tools when current business information is required.

Never invent information that is not returned by the backend or explicitly provided in verified business configuration.


AGENT IDENTITY

Your name is:

{{agent_name}}

You represent:

{{business_name}}

Use the configured business name and agent name naturally during conversation.

Do not invent another agent name.

Do not expose internal business IDs, database IDs, API information, tool names, JSON, backend terminology, or internal configuration to callers.


GENERAL COMMUNICATION

Speak naturally in the configured language.

Use the configured locale and conversational style.

Be friendly, professional, concise, helpful, and conversational.

Do not sound robotic.

Ask only one question at a time.

Wait for the caller to answer before continuing.

Do not unnecessarily repeat the caller's name.

Do not repeatedly say:

Thank you
Perfect
Absolutely
Great

Use natural acknowledgements only when appropriate.

Keep responses short unless the caller asks for more detail.


AVAILABLE BUSINESS TOOLS

Use only the tools attached to this agent.

Possible tools may include:

get_services
get_service_details
get_pricing
get_business_hours

create_appointment
search_appointment
reschedule_appointment
cancel_appointment

Restaurant tools

Loan application tools

Reservation tools

Callback tools

Lead tools

Custom business tools

Do not attempt to call a tool that is not available to the current agent.


SERVICES AND PRODUCTS

When the caller asks what the business offers:

Use get_services or the equivalent business-specific tool.

Use only the services or products returned by the backend.

Never assume previously known service names are still current.

If the caller asks for details about a specific service:

Use get_service_details when available.

Explain the returned information naturally.

Keep the initial explanation brief.

Provide more detail only when requested.


PRICING

When the caller asks:

How much does it cost
What is the price
What are your fees
How much is this service
What does this cost

Use get_pricing or the appropriate business-specific pricing tool.

Never invent pricing.

Never use remembered pricing when a backend pricing tool is available.

If pricing is unavailable, say that confirmed pricing is not currently available and offer the appropriate next step.


BUSINESS HOURS

When the caller asks about:

Opening hours
Closing hours
Business hours
Whether the business is open
Weekend hours
Availability hours

Use get_business_hours when available.

Use only the returned business hours.

Never invent operating hours.


CUSTOMER NAME VERIFICATION

Name verification is mandatory whenever the customer's name is required for a transaction.

After collecting the full name:

Repeat the name.

Spell the first and last name letter by letter.

Ask whether the spelling is correct.

Do not continue until the caller confirms it.

If incorrect:

Collect the corrected spelling.

Repeat it.

Verify again.

Never infer the spelling of a customer's name from their email address.


PHONE NUMBER VERIFICATION

Phone verification is mandatory whenever the phone number is required.

After collecting the phone number:

Repeat every digit clearly.

Ask whether it is correct.

Do not continue until confirmed.

If incorrect:

Collect the number again.

Repeat every digit again.

Do not invent missing digits.

Do not change digits based on assumptions.


EMAIL VERIFICATION

Email verification is mandatory whenever an email address is required.

Interpret spoken email terms correctly.

at = @
at sign = @
at symbol = @
at rate = @
dot = .
period = .
underscore = _
dash = -
hyphen = -

After collecting the email:

Repeat the email address.

Spell the important portion before the at sign.

Confirm the domain.

Ask whether it is correct.

Do not continue until confirmed.

Never silently correct an email address.


NAME AND EMAIL CROSS CHECK

If the verified customer name and email appear to contain different spellings:

Do not automatically modify either value.

Ask the caller to confirm the difference.

If the caller confirms both:

Keep both exactly as confirmed.

If the caller corrects one:

Update only that field and verify it again.


APPOINTMENT BOOKING

If appointment booking is supported by the current agent and the caller wants to schedule an appointment:

Collect only the fields required by the connected appointment API.

Typical fields may include:

Service
Customer Name
Customer Phone
Customer Email
Appointment Date
Appointment Time

Additional conversational information may be collected only when required by the business configuration or API.

Do not invent missing required values.

Do not send unsupported fields to the backend.


DATE HANDLING

Understand natural date expressions such as:

Today
Tomorrow
Next Monday
Next Friday
September nineteenth

Before sending a date to the backend:

Convert it to the format required by the API.

For the standard appointment API, use:

YYYY-MM-DD

If the caller gives a relative or ambiguous date:

Confirm the actual calendar date verbally before submitting.


TIME HANDLING

Understand natural time expressions such as:

3 PM
9:30 AM
Noon
Midnight

Before sending the time to the backend:

Convert it to the format required by the API.

For the standard appointment API, use:

HH:MM in 24-hour format

Examples:

3 PM = 15:00
9:30 AM = 09:30
Noon = 12:00
Midnight = 00:00

Confirm ambiguous times before submitting.


FINAL TRANSACTION CONFIRMATION

Before performing any action that creates, modifies, reschedules, cancels, submits, or updates data:

Summarize the important information to the caller.

For appointment creation, typically confirm:

Service
Customer Name
Phone Number
Email
Appointment Date
Appointment Time

For other business types, confirm the corresponding important transaction details.

Read phone numbers clearly.

Read emails naturally.

Ask:

Is everything correct?

If anything is incorrect:

Update only that field.

If Name, Phone Number, or Email changes:

Perform the verification process for that field again.

Do not call the final action tool until the caller clearly confirms.


CREATE APPOINTMENT

When the caller confirms the appointment details:

Call create_appointment.

Use:

business_id = {{business_key}}

Send only the fields supported by the connected API.

Never generate an Appointment ID yourself.

Use only the appointment_id returned by the backend.

If the tool returns success:

Tell the caller that the appointment was successfully scheduled.

Provide the returned Appointment ID.

Tell the caller to keep the Appointment ID for future changes or cancellation.

If the tool fails:

Do not claim the appointment was created.


SEARCH APPOINTMENT

When the caller wants to:

Find an appointment
Check an appointment
Reschedule an appointment
Cancel an appointment

Ask for the Appointment ID first.

If the caller does not have it:

Use other supported search fields such as:

Phone Number
Email
Customer Name
Appointment Date

Verify Phone Number or Email before searching.

Call search_appointment.

Use:

business_id = {{business_key}}

Do not claim an appointment was found unless the backend confirms it.

If the backend returns:

success = true
and
found = true

then use the returned appointment information.

If multiple appointments are returned:

Help the caller identify the correct appointment before continuing.


RESCHEDULE APPOINTMENT

First find the appointment using search_appointment.

Read the current appointment details to the caller.

Ask for the new date.

Ask for the new time.

Convert the values to the backend-required format.

Read the new date and time back.

Ask for confirmation.

Only after confirmation call:

reschedule_appointment

Use:

business_id = {{business_key}}

Keep the same Appointment ID.

If success = true:

Tell the caller the appointment was successfully rescheduled.

If success = false:

Do not claim success.


CANCEL APPOINTMENT

First find the appointment using search_appointment.

Read the appointment details back to the caller.

Ask for explicit cancellation confirmation.

Example:

Just to confirm, would you like me to cancel this appointment?

Only after a clear yes call:

cancel_appointment

Use:

business_id = {{business_key}}

Keep the same Appointment ID.

If success = true:

Tell the caller the appointment has been cancelled.

If success = false:

Do not claim cancellation succeeded.


RESTAURANT BUSINESS BEHAVIOR

If the current business is a restaurant:

Use the restaurant-specific tools attached to the agent.

Possible supported actions may include:

Menu questions
Item details
Pricing
Business hours
Reservation availability
Create reservation
Modify reservation
Cancel reservation

Always use backend data.

Never invent menu items, pricing, availability, opening hours, or reservations.


LOAN AGENCY BUSINESS BEHAVIOR

If the current business is a loan agency:

Use the loan-specific tools attached to the agent.

Possible supported actions may include:

Loan product information
Eligibility information
Personal loan application
Business loan application
Used car loan application
Callback request
Application update
Call outcome

Only collect fields required by the applicable backend tool.

Never invent:

Interest rates
Eligibility rules
Loan approval
Approval probability
Loan amount availability
Required documentation

unless the backend or verified business configuration provides that information.


CUSTOM BUSINESS BEHAVIOR

If the current business uses custom tools:

Follow the descriptions and schemas of those tools.

Collect only the required information.

Confirm important information before submitting a transaction.

Do not invent unsupported actions.


QUESTIONS DURING A TRANSACTION

The caller may ask a service, pricing, hours, or business question while another flow is in progress.

Answer the question using the appropriate tool.

Then return to the exact point where the previous flow stopped.

Do not restart the conversation.

Do not ask again for information already collected and confirmed.


CORRECTIONS

If the caller corrects any information:

Update only that field.

Do not restart the entire flow.

If the corrected field is:

Name
Phone Number
Email

perform the verification process again.


INTERRUPTIONS

If the caller interrupts:

Stop speaking.

Listen.

Determine whether they are:

Answering the current question
Correcting information
Asking another question
Changing intent

Continue from the appropriate point.

Do not restart the greeting or entire conversation.


SILENCE HANDLING

If the caller becomes silent:

Allow reasonable time for a response.

First re-engagement:

Are you still there?

Second re-engagement:

I am here whenever you are ready.

If there is still no response:

It looks like we may have lost the connection. Please feel free to call us again. Have a great day.

Then end the conversation.


TOOL FAILURE

Never convert a failed tool action into a successful spoken response.

If a tool fails:

Do not invent data.

Do not invent prices.

Do not invent services.

Do not invent business hours.

Do not invent Appointment IDs.

Do not claim that a transaction succeeded.

Give a short natural explanation.

Offer another attempt when appropriate.


UNKNOWN INFORMATION

If requested information is not available from the backend or verified business configuration:

Do not guess.

Do not invent an answer.

Say that you do not currently have confirmed information about that specific question.

Offer the appropriate next step when possible.


SOURCE OF TRUTH PRIORITY

When information conflicts, use this priority:

1. Live backend tool response
2. Current verified business configuration
3. Current conversation information explicitly confirmed by the caller

Never use old remembered business information when newer backend information is available.


CLOSING

Before ending a normal conversation, ask:

Is there anything else I can help you with today?

If no:

Thank you for contacting {{business_name}}. Have a great day.

Do not continue speaking after the closing.`
  },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurant & Dining Hospitality',
    role: 'Dining Host & Reservation Specialist',
    voice_name: 'Fish Audio Default',
    voice_id: 'fish_audio_default',
    language: 'en',
    tools: [
      'get_menu',
      'get_item',
      'get_hours',
      'check_availability',
      'create_reservation',
      'modify_reservation',
      'cancel_reservation'
    ],
    greeting: `Hello, thank you for calling {{business_name}}! I am {{agent_name}}, your dining assistant.

I can help you explore our menu, check operating hours, check table availability, or book, modify, or cancel a table reservation.

How may I assist you today?`,
    system_prompt: `You are {{agent_name}}, the AI Host and Dining Assistant for {{business_name}}.

Your job is to assist guests with restaurant inquiries, food & beverage menus, daily specials, allergen/dietary options, operating hours, and booking, checking, modifying, or cancelling table reservations.


BUSINESS DATA SOURCE
The backend database and tools are the single source of truth.
Business Key: {{business_key}}

Never invent menu items, pricing, chef specials, kitchen hours, or table availability. Always call backend tools.


AGENT IDENTITY
Your name is {{agent_name}}.
You represent {{business_name}}.
Speak warmly, hospitably, and conversationally.
Never expose tool names, database IDs, or internal configuration to guests.


GENERAL COMMUNICATION
- Be hospitable, welcoming, and succinct.
- Ask one question at a time.
- Verify guest name spelling, party size, phone number, and reservation date & time before booking.
- Confirm any dietary or seating preferences.


AVAILABLE TOOLS
- get_menu
- get_item
- get_hours
- check_availability
- create_reservation
- modify_reservation
- cancel_reservation


CLOSING
Before ending, ask: "Is there anything else I can help you with regarding your dining experience?"
If no: "Thank you for contacting {{business_name}}. We look forward to serving you!"`
  },
  clinic: {
    key: 'clinic',
    label: 'Clinic & Healthcare Consultation',
    role: 'Patient Care & Clinical Coordinator',
    voice_name: 'Fish Audio Default',
    voice_id: 'fish_audio_default',
    language: 'en',
    tools: [
      'get_services',
      'get_service_details',
      'get_pricing',
      'get_business_hours',
      'create_appointment',
      'search_appointment',
      'reschedule_appointment',
      'cancel_appointment'
    ],
    greeting: `Hello, welcome to {{business_name}}. I am {{agent_name}}, your patient care coordinator.

I can assist you with scheduling a clinical consultation, checking doctor availability and clinic hours, inquiring about services, or managing an existing appointment.

How may I assist you today?`,
    system_prompt: `You are {{agent_name}}, the Patient Care and Clinical Consultation Assistant for {{business_name}}.

Your role is to help patients learn about clinic specialties, physician availability, consult fees, clinic hours, schedule consultation appointments, verify patient records, reschedule appointments, and handle cancellations.


BUSINESS DATA SOURCE
The backend database is the verified source of truth.
Business Key: {{business_key}}

Never invent medical advice, diagnoses, doctor schedules, or fees. Always direct emergency symptoms to 911 / emergency services immediately.


COMMUNICATION & VERIFICATION
- Be compassionate, polite, clear, and reassuring.
- Mandatory spelling verification for patient name.
- Mandatory digit-by-digit phone verification.
- Mandatory confirmation for appointment date, time, and doctor/specialty.


AVAILABLE TOOLS
- get_services
- get_service_details
- get_pricing
- get_business_hours
- create_appointment
- search_appointment
- reschedule_appointment
- cancel_appointment


CLOSING
"Thank you for contacting {{business_name}}. Wishing you good health and a wonderful day!"`
  },
  loan_finance: {
    key: 'loan_finance',
    label: 'Loan & Financial Services',
    role: 'Loan Officer & Financial Intake Specialist',
    voice_name: 'Fish Audio Default',
    voice_id: 'fish_audio_default',
    language: 'en',
    tools: [
      'get_loan_products',
      'get_loan_product_details',
      'create_loan_application',
      'update_personal_loan',
      'update_business_loan',
      'update_used_car_loan',
      'create_callback',
      'save_call_outcome'
    ],
    greeting: `Hello, welcome to {{business_name}}. I am {{agent_name}}, your AI credit and loan advisory officer.

I can help you explore our loan products, check eligibility requirements and estimated interest rates, submit a pre-qualification application, or request an executive callback.

How can I help you today?`,
    system_prompt: `You are {{agent_name}}, the AI Credit and Financial Services Officer for {{business_name}}.

Your job is to explain loan offerings (Personal, Business, Vehicle/Used Car loans), check eligibility guidelines, collect intake applications, calculate estimates, and schedule officer callbacks.


BUSINESS DATA SOURCE
Backend tools are the official source of truth.
Business Key: {{business_key}}

Never promise loan approvals or invent interest rates or sanction amounts. All approvals are subject to document verification and credit policy.


VERIFICATION & INTAKE RULES
- Name, phone, and email verification are mandatory.
- Collect accurate income, employment, and loan amount requirements.
- Summarize application details and confirm with the customer before submission.


AVAILABLE TOOLS
- get_loan_products
- get_loan_product_details
- create_loan_application
- update_personal_loan
- update_business_loan
- update_used_car_loan
- create_callback
- save_call_outcome


CLOSING
"Thank you for contacting {{business_name}}. Have a great day!"`
  }
};

function renderTemplateText(template, bizName, agentName, bizKey) {
  if (!template) return '';
  return template
    .replace(/\{\{business_name\}\}/g, bizName || '{{business_name}}')
    .replace(/\{\{agent_name\}\}/g, agentName || '{{agent_name}}')
    .replace(/\{\{business_key\}\}/g, bizKey || '{{business_key}}');
}

export default function BusinessesPage({ onOpenOnboarding }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [selectedBiz, setSelectedBiz] = useState(null); // Business Profile modal
  const [editingBiz, setEditingBiz] = useState(null);   // Edit Form modal
  const [deletingBiz, setDeletingBiz] = useState(null); // Delete confirmation modal
  const [addModalOpen, setAddModalOpen] = useState(false); // + Add Business modal
  
  // Tabs state
  const [editTab, setEditTab] = useState('profile');
  const [profileTab, setProfileTab] = useState('overview');
  const [addTab, setAddTab] = useState('business');
  
  // Loading & error state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [bannerNotice, setBannerNotice] = useState('');

  // Copy feedback state
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedGreeting, setCopiedGreeting] = useState(false);
  const [copiedProfilePrompt, setCopiedProfilePrompt] = useState(false);
  const [copiedProfileGreeting, setCopiedProfileGreeting] = useState(false);
  const [copiedEditPrompt, setCopiedEditPrompt] = useState(false);
  const [copiedEditGreeting, setCopiedEditGreeting] = useState(false);

  // Industry Templates from backend
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  const getBizTemplate = (biz) => {
    if (!biz) return templates.service_and_appointment || DEFAULT_TEMPLATES.service_and_appointment;
    const raw = (biz.industry || biz.type || 'service_and_appointment').toLowerCase();
    if (raw.includes('restaurant')) return templates.restaurant || DEFAULT_TEMPLATES.restaurant;
    if (raw.includes('clinic') || raw.includes('health')) return templates.clinic || DEFAULT_TEMPLATES.clinic;
    if (raw.includes('loan') || raw.includes('finance')) return templates.loan_finance || DEFAULT_TEMPLATES.loan_finance;
    return templates.service_and_appointment || DEFAULT_TEMPLATES.service_and_appointment;
  };

  // New Business state
  const [newBiz, setNewBiz] = useState({
    name: '',
    industry: 'service_and_appointment',
    type: 'Service and Appointment Booking',
    country: 'United States',
    timezone: 'America/New_York',
    phone: '',
    email: '',
    website: '',
    address: '',
    description: '',
    setup_agent_now: true,
    agent_name: '',
    voice_id: 'fish_audio_default',
    voice_name: 'Fish Audio Default',
    language: 'en',
    greeting: '',
    system_prompt: '',
    attached_tools: [],
    auto_create_agent: true
  });

  // Custom / Public Fish Audio Voice IDs
  const [newBizCustomVoice, setNewBizCustomVoice] = useState(false);
  const [newBizCustomVoiceId, setNewBizCustomVoiceId] = useState('');
  const [editBizCustomVoice, setEditBizCustomVoice] = useState(false);
  const [editBizCustomVoiceId, setEditBizCustomVoiceId] = useState('');

  // Services and Operating Hours state for Add Business modal
  const [newBizHours, setNewBizHours] = useState(DEFAULT_WEEK_HOURS);
  const [newBizNoHours, setNewBizNoHours] = useState(false);
  const [newBizServices, setNewBizServices] = useState([
    {
      id: 1,
      service_name: 'Consultation & Assessment',
      showPrice: true,
      price: '49',
      showDuration: true,
      duration_minutes: '30',
      showDescription: true,
      short_description: 'Initial intake and requirement consultation session.',
    }
  ]);
  const [newBizNoServices, setNewBizNoServices] = useState(false);

  // Services and Operating Hours state for Edit Business modal
  const [editBizHours, setEditBizHours] = useState(DEFAULT_WEEK_HOURS);
  const [editBizNoHours, setEditBizNoHours] = useState(false);
  const [editBizServices, setEditBizServices] = useState([]);
  const [editBizNoServices, setEditBizNoServices] = useState(false);

  // Hours update handlers
  const handleUpdateHour = (isEdit, dayName, field, value) => {
    const setter = isEdit ? setEditBizHours : setNewBizHours;
    setter((prev) =>
      prev.map((h) => (h.day === dayName ? { ...h, [field]: value } : h))
    );
  };

  const handleApplyPresetHours = (isEdit, presetType) => {
    const setter = isEdit ? setEditBizHours : setNewBizHours;
    if (presetType === 'weekdays') {
      setter([
        { day: 'Monday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Tuesday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Wednesday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Thursday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Friday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Saturday', open_time: '09:00', close_time: '17:00', closed: true },
        { day: 'Sunday', open_time: '09:00', close_time: '17:00', closed: true },
      ]);
    } else if (presetType === 'alldays') {
      setter([
        { day: 'Monday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Tuesday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Wednesday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Thursday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Friday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Saturday', open_time: '09:00', close_time: '18:00', closed: false },
        { day: 'Sunday', open_time: '09:00', close_time: '18:00', closed: false },
      ]);
    } else if (presetType === 'saturday') {
      setter([
        { day: 'Monday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Tuesday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Wednesday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Thursday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Friday', open_time: '09:00', close_time: '17:00', closed: false },
        { day: 'Saturday', open_time: '10:00', close_time: '15:00', closed: false },
        { day: 'Sunday', open_time: '10:00', close_time: '15:00', closed: true },
      ]);
    }
  };

  // Services update handlers
  const handleAddServiceItem = (isEdit) => {
    const setter = isEdit ? setEditBizServices : setNewBizServices;
    setter((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        service_name: '',
        showPrice: false,
        price: '',
        showDuration: false,
        duration_minutes: '',
        showDescription: false,
        short_description: '',
      }
    ]);
  };

  const handleUpdateServiceItem = (isEdit, id, field, value) => {
    const setter = isEdit ? setEditBizServices : setNewBizServices;
    setter((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleRemoveServiceItem = (isEdit, id) => {
    const setter = isEdit ? setEditBizServices : setNewBizServices;
    setter((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleServiceField = (isEdit, id, fieldName, enable) => {
    const setter = isEdit ? setEditBizServices : setNewBizServices;
    setter((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (fieldName === 'price') {
          return { ...s, showPrice: enable, price: enable ? s.price || '' : '' };
        }
        if (fieldName === 'duration') {
          return { ...s, showDuration: enable, duration_minutes: enable ? s.duration_minutes || '' : '' };
        }
        if (fieldName === 'description') {
          return { ...s, showDescription: enable, short_description: enable ? s.short_description || '' : '' };
        }
        return s;
      })
    );
  };

  const loadBusinesses = () => {
    setLoading(true);
    apiFetch('/admin/businesses')
      .then((data) => {
        if (Array.isArray(data)) setBusinesses(data);
      })
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  };

  const loadTemplates = () => {
    apiFetch('/admin/industry-templates')
      .then((res) => {
        if (res?.templates && Array.isArray(res.templates)) {
          const mapped = {};
          res.templates.forEach((t) => {
            mapped[t.key] = t;
          });
          setTemplates((prev) => ({ ...prev, ...mapped }));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadBusinesses();
    loadTemplates();
  }, []);

  // Initialize New Business Form
  const handleOpenAdd = useCallback(() => {
    const defaultTemplate = templates.service_and_appointment || DEFAULT_TEMPLATES.service_and_appointment;
    const defaultName = '';
    const defaultAgent = 'Appointment Specialist AI';
    const defaultKey = 'biz_appointment_01';

    setNewBiz({
      name: defaultName,
      industry: 'service_and_appointment',
      type: 'Service and Appointment Booking',
      country: 'United States',
      timezone: 'America/New_York',
      phone: '',
      email: '',
      website: '',
      address: '',
      description: '',
      setup_agent_now: true,
      agent_name: defaultAgent,
      voice_id: defaultTemplate.default_voice_id || defaultTemplate.voice_id || 'fish_audio_default',
      voice_name: defaultTemplate.default_voice_name || defaultTemplate.voice_name || 'Fish Audio Default',
      language: defaultTemplate.default_language || defaultTemplate.language || 'en',
      greeting: renderTemplateText(defaultTemplate.greeting, defaultName || '{{business_name}}', defaultAgent, defaultKey),
      system_prompt: renderTemplateText(defaultTemplate.system_prompt, defaultName || '{{business_name}}', defaultAgent, defaultKey),
      attached_tools: [...(defaultTemplate.tools || [])],
      auto_create_agent: true
    });
    setNewBizCustomVoice(false);
    setNewBizCustomVoiceId('');
    setNewBizHours(DEFAULT_WEEK_HOURS);
    setNewBizNoHours(false);
    setNewBizServices([
      {
        id: 1,
        service_name: 'Consultation & Assessment',
        showPrice: true,
        price: '49',
        showDuration: true,
        duration_minutes: '30',
        showDescription: true,
        short_description: 'Initial intake and requirement consultation session.',
      }
    ]);
    setNewBizNoServices(false);
    setAddTab('business');
    setCreateError('');
    setAddModalOpen(true);
  }, [templates]);

  // Listen for global open event from top Header Add Business button
  useEffect(() => {
    const onOpenAddEvent = () => handleOpenAdd();
    window.addEventListener('scadova:open-add-business', onOpenAddEvent);
    return () => window.removeEventListener('scadova:open-add-business', onOpenAddEvent);
  }, [handleOpenAdd]);

  // Handle changing industry in Add modal
  const handleIndustryChange = (newIndustryKey) => {
    const t = templates[newIndustryKey] || DEFAULT_TEMPLATES[newIndustryKey] || DEFAULT_TEMPLATES.service_and_appointment;
    const bizName = newBiz.name.trim() || '{{business_name}}';
    const agentName = newBiz.name.trim() ? `${newBiz.name.trim()} AI Assistant` : (t.default_agent_role || t.role || 'Voice Assistant');
    const bizKey = newBiz.name.trim() ? newBiz.name.trim().toLowerCase().replace(/\s+/g, '_') : '{{business_key}}';

    setNewBizCustomVoice(false);
    setNewBizCustomVoiceId('');
    setNewBiz((prev) => ({
      ...prev,
      industry: newIndustryKey,
      type: t.label,
      agent_name: agentName,
      voice_id: t.default_voice_id || t.voice_id || 'fish_audio_default',
      voice_name: t.default_voice_name || t.voice_name || 'Fish Audio Default',
      language: t.default_language || t.language || 'en',
      greeting: renderTemplateText(t.greeting, bizName, agentName, bizKey),
      system_prompt: renderTemplateText(t.system_prompt, bizName, agentName, bizKey),
      attached_tools: [...(t.tools || [])],
    }));
  };

  // Handle typing business name
  const handleBusinessNameChange = (nameVal) => {
    const t = templates[newBiz.industry] || DEFAULT_TEMPLATES[newBiz.industry] || DEFAULT_TEMPLATES.service_and_appointment;
    const bizName = nameVal.trim() || '{{business_name}}';
    const agentName = nameVal.trim() ? `${nameVal.trim()} AI Assistant` : (t.default_agent_role || t.role || 'Voice Assistant');
    const bizKey = nameVal.trim() ? nameVal.trim().toLowerCase().replace(/\s+/g, '_') : '{{business_key}}';

    setNewBiz((prev) => ({
      ...prev,
      name: nameVal,
      agent_name: agentName,
      greeting: renderTemplateText(t.greeting, bizName, agentName, bizKey),
      system_prompt: renderTemplateText(t.system_prompt, bizName, agentName, bizKey),
    }));
  };

  // Tool toggle & selection helpers for Add Business modal
  const handleToggleNewBizTool = (tool) => {
    setNewBiz((prev) => {
      const current = prev.attached_tools || [];
      const exists = current.includes(tool);
      return {
        ...prev,
        attached_tools: exists ? current.filter((t) => t !== tool) : [...current, tool],
      };
    });
  };

  const handleSelectAllNewBizTools = () => {
    const t = templates[newBiz.industry] || DEFAULT_TEMPLATES[newBiz.industry] || DEFAULT_TEMPLATES.service_and_appointment;
    setNewBiz((prev) => ({
      ...prev,
      attached_tools: [...(t.tools || [])],
    }));
  };

  const handleClearAllNewBizTools = () => {
    setNewBiz((prev) => ({
      ...prev,
      attached_tools: [],
    }));
  };

  const handleResetAddGreeting = () => {
    const t = templates[newBiz.industry] || DEFAULT_TEMPLATES[newBiz.industry] || DEFAULT_TEMPLATES.service_and_appointment;
    const bizName = newBiz.name.trim() || '{{business_name}}';
    const agentName = newBiz.agent_name?.trim() || `${bizName} AI Assistant`;
    const bizKey = bizName.toLowerCase().replace(/\s+/g, '_');
    setNewBiz((prev) => ({
      ...prev,
      greeting: renderTemplateText(t.greeting, bizName, agentName, bizKey),
    }));
  };

  const handleResetAddPrompt = () => {
    const t = templates[newBiz.industry] || DEFAULT_TEMPLATES[newBiz.industry] || DEFAULT_TEMPLATES.service_and_appointment;
    const bizName = newBiz.name.trim() || '{{business_name}}';
    const agentName = newBiz.agent_name?.trim() || `${bizName} AI Assistant`;
    const bizKey = bizName.toLowerCase().replace(/\s+/g, '_');
    setNewBiz((prev) => ({
      ...prev,
      system_prompt: renderTemplateText(t.system_prompt, bizName, agentName, bizKey),
    }));
  };

  // Tool toggle & selection helpers for Edit Business modal
  const handleToggleEditTool = (tool) => {
    setEditingBiz((prev) => {
      if (!prev) return prev;
      const current = prev.attached_tools || [];
      const exists = current.includes(tool);
      return {
        ...prev,
        attached_tools: exists ? current.filter((t) => t !== tool) : [...current, tool],
      };
    });
  };

  const handleSelectAllEditTools = () => {
    if (!editingBiz) return;
    const t = getBizTemplate(editingBiz);
    setEditingBiz((prev) => ({
      ...prev,
      attached_tools: [...(t.tools || [])],
    }));
  };

  const handleClearAllEditTools = () => {
    setEditingBiz((prev) => ({
      ...prev,
      attached_tools: [],
    }));
  };

  const handleResetEditGreeting = () => {
    if (!editingBiz) return;
    const t = getBizTemplate(editingBiz);
    const bName = editingBiz.name || '{{business_name}}';
    const aName = editingBiz.agent_name || `${bName} AI Assistant`;
    const bKey = editingBiz.business_key || bName.toLowerCase().replace(/\s+/g, '_');
    setEditingBiz((prev) => ({
      ...prev,
      first_message: renderTemplateText(t.greeting, bName, aName, bKey),
    }));
  };

  const handleResetEditPrompt = () => {
    if (!editingBiz) return;
    const t = getBizTemplate(editingBiz);
    const bName = editingBiz.name || '{{business_name}}';
    const aName = editingBiz.agent_name || `${bName} AI Assistant`;
    const bKey = editingBiz.business_key || bName.toLowerCase().replace(/\s+/g, '_');
    setEditingBiz((prev) => ({
      ...prev,
      system_prompt: renderTemplateText(t.system_prompt, bName, aName, bKey),
    }));
  };

  // Submit New Business
  const handleCreateBusiness = async (e) => {
    e?.preventDefault();
    if (!newBiz.name.trim()) {
      setCreateError('Please enter a business name.');
      setAddTab('business');
      return;
    }
    setCreating(true);
    setCreateError('');

    try {
      const isAgentNow = newBiz.setup_agent_now !== false;
      const payload = {
        name: newBiz.name.trim(),
        type: newBiz.type || 'Service and Appointment Booking',
        industry: newBiz.industry,
        country: newBiz.country?.trim() || 'United States',
        timezone: newBiz.timezone || 'America/New_York',
        phone: newBiz.phone?.trim() || '',
        email: newBiz.email?.trim() || '',
        website: newBiz.website?.trim() || '',
        address: newBiz.address?.trim() || '',
        description: newBiz.description?.trim() || '',
        auto_create_agent: isAgentNow,
      };

      if (!newBizNoHours && newBizHours && newBizHours.length > 0) {
        payload.hours_data = newBizHours.map((h) => ({
          day: h.day,
          open_time: h.closed ? null : h.open_time,
          close_time: h.closed ? null : h.close_time,
          closed: Boolean(h.closed),
        }));
      } else {
        payload.hours_data = [];
      }

      if (!newBizNoServices && newBizServices && newBizServices.length > 0) {
        payload.services_data = newBizServices
          .filter((s) => s.service_name && s.service_name.trim())
          .map((s) => ({
            service_name: s.service_name.trim(),
            price: s.showPrice && s.price ? parseFloat(s.price) : null,
            duration_minutes: s.showDuration && s.duration_minutes ? parseInt(s.duration_minutes, 10) : null,
            short_description: s.showDescription ? (s.short_description || '').trim() : '',
          }));
      } else {
        payload.services_data = [];
      }

      if (isAgentNow) {
        payload.agent_name = newBiz.agent_name?.trim() || `${newBiz.name.trim()} AI Assistant`;
        payload.voice_id = newBizCustomVoice && newBizCustomVoiceId.trim() ? newBizCustomVoiceId.trim() : (newBiz.voice_id || 'fish_audio_default');
        payload.voice_name = newBizCustomVoice && newBizCustomVoiceId.trim() ? `Public Voice (${newBizCustomVoiceId.trim()})` : (newBiz.voice_name || 'Fish Audio Default');
        payload.language = newBiz.language;
        payload.first_message = newBiz.greeting;
        payload.system_prompt = newBiz.system_prompt;
        payload.attached_tools = newBiz.attached_tools || [];
      }

      const created = await apiFetch('/admin/businesses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAddModalOpen(false);
      if (isAgentNow) {
        setBannerNotice(`Business "${created.name}" and Voice Agent "${payload.agent_name}" successfully created with Fish Audio prompts!`);
      } else {
        setBannerNotice(`Business "${created.name}" registered successfully. You can configure its AI Voice Agent anytime from Edit.`);
      }
      loadBusinesses();
      setTimeout(() => setBannerNotice(''), 6000);
      window.dispatchEvent(new Event('scadova:updated'));
    } catch (err) {
      setCreateError(err.message || 'Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (biz, initialTab = 'profile') => {
    const t = getBizTemplate(biz);
    const bName = biz.name || '{{business_name}}';
    const aName = biz.agent_name || (biz.name ? `${biz.name} AI Assistant` : (t.default_agent_role || 'Voice Assistant'));
    const bKey = biz.business_key || bName.toLowerCase().replace(/\s+/g, '_');
    const hasConfiguredAgent = Boolean(biz.has_agent || (biz.agent_name && (biz.fish_agent_id || biz.agent_id)));

    const isCustomVoice = biz.voice_id && !VOICE_PROFILES.some((v) => v.id === biz.voice_id) && biz.voice_id !== 'fish_audio_default';
    setEditBizCustomVoice(Boolean(isCustomVoice));
    setEditBizCustomVoiceId(isCustomVoice ? (biz.voice_id || '') : '');

    setEditingBiz({
      ...biz,
      type: biz.type || biz.business_type || t.label,
      status: biz.status || 'active',
      language: biz.language || t.language || 'en',
      agent_name: biz.agent_name || aName,
      fish_agent_id: biz.fish_agent_id || biz.agent_id || `agent_${bKey.replace(/[^a-z0-9_]/g, '').slice(0, 20)}`,
      agent_id: biz.fish_agent_id || biz.agent_id || `agent_${bKey.replace(/[^a-z0-9_]/g, '').slice(0, 20)}`,
      voice: biz.voice || t.voice_name || 'Fish Audio Default',
      voice_id: biz.voice_id || t.voice_id || 'fish_audio_default',
      prompt_version: biz.prompt_version || 'v1.0',
      first_message: biz.first_message || renderTemplateText(t.greeting, bName, aName, bKey),
      system_prompt: biz.system_prompt || renderTemplateText(t.system_prompt, bName, aName, bKey),
      attached_tools: (biz.attached_tools && biz.attached_tools.length > 0) ? biz.attached_tools : [...(t.tools || [])],
      has_agent: hasConfiguredAgent,
    });
    setEditTab(initialTab);
    setSaveError('');

    // Fetch live hours & services
    apiFetch(`/admin/businesses/${biz.id}`)
      .then((fullBiz) => {
        if (fullBiz?.hours && fullBiz.hours.length > 0) {
          const daysMap = {};
          fullBiz.hours.forEach((h) => {
            const d = (h.day || '').charAt(0).toUpperCase() + (h.day || '').slice(1).toLowerCase();
            daysMap[d] = h;
          });
          const mappedHours = DEFAULT_WEEK_HOURS.map((def) => {
            const match = daysMap[def.day];
            if (match) {
              return {
                day: def.day,
                open_time: match.open_time || def.open_time,
                close_time: match.close_time || def.close_time,
                closed: Boolean(match.closed),
              };
            }
            return def;
          });
          setEditBizHours(mappedHours);
          setEditBizNoHours(false);
        } else {
          setEditBizHours(DEFAULT_WEEK_HOURS);
          setEditBizNoHours(false);
        }

        if (fullBiz?.services && fullBiz.services.length > 0) {
          const mappedServices = fullBiz.services.map((s, idx) => ({
            id: s.id || idx + 1,
            service_name: s.service_name || s.name || '',
            showPrice: Boolean(s.price !== null && s.price !== undefined && s.price !== ''),
            price: s.price != null ? String(s.price) : '',
            showDuration: Boolean(s.duration_minutes !== null && s.duration_minutes !== undefined && s.duration_minutes !== ''),
            duration_minutes: s.duration_minutes != null ? String(s.duration_minutes) : '',
            showDescription: Boolean(s.short_description || s.detailed_description || s.description),
            short_description: s.short_description || s.detailed_description || s.description || '',
          }));
          setEditBizServices(mappedServices);
          setEditBizNoServices(false);
        } else {
          setEditBizServices([]);
          setEditBizNoServices(false);
        }
      })
      .catch(() => {
        setEditBizHours(DEFAULT_WEEK_HOURS);
        setEditBizServices([]);
      });
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
        voice: editBizCustomVoice && editBizCustomVoiceId.trim() ? `Public Voice (${editBizCustomVoiceId.trim()})` : (editingBiz.voice?.trim() || 'Fish Audio Default'),
        voice_id: editBizCustomVoice && editBizCustomVoiceId.trim() ? editBizCustomVoiceId.trim() : (editingBiz.voice_id?.trim() || 'fish_audio_default'),
        voice_name: editBizCustomVoice && editBizCustomVoiceId.trim() ? `Public Voice (${editBizCustomVoiceId.trim()})` : (editingBiz.voice?.trim() || 'Fish Audio Default'),
        language: editingBiz.language,
        llm: editingBiz.llm?.trim(),
        prompt_version: editingBiz.prompt_version?.trim() || 'v1.0',
        first_message: editingBiz.first_message?.trim(),
        system_prompt: editingBiz.system_prompt?.trim(),
        attached_tools: editingBiz.attached_tools || [],
      };

      if (!editBizNoHours && editBizHours && editBizHours.length > 0) {
        payload.hours_data = editBizHours.map((h) => ({
          day: h.day,
          open_time: h.closed ? null : h.open_time,
          close_time: h.closed ? null : h.close_time,
          closed: Boolean(h.closed),
        }));
      } else if (editBizNoHours) {
        payload.hours_data = [];
      }

      if (!editBizNoServices && editBizServices && editBizServices.length > 0) {
        payload.services_data = editBizServices
          .filter((s) => s.service_name && s.service_name.trim())
          .map((s) => ({
            service_name: s.service_name.trim(),
            price: s.showPrice && s.price ? parseFloat(s.price) : null,
            duration_minutes: s.showDuration && s.duration_minutes ? parseInt(s.duration_minutes, 10) : null,
            short_description: s.showDescription ? (s.short_description || '').trim() : '',
          }));
      } else if (editBizNoServices) {
        payload.services_data = [];
      }

      const updated = await apiFetch(`/admin/businesses/${editingBiz.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setBusinesses((prev) =>
        prev.map((b) => (b.id === editingBiz.id ? { ...b, ...payload, ...(updated || {}), has_agent: true } : b))
      );
      if (selectedBiz && selectedBiz.id === editingBiz.id) {
        setSelectedBiz((prev) => ({ ...prev, ...payload, ...(updated || {}), has_agent: true }));
      }

      setEditingBiz(null);
      setBannerNotice(`Business '${payload.name}' and Voice Agent configuration updated successfully.`);
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

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'prompt') {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else if (type === 'greeting') {
      setCopiedGreeting(true);
      setTimeout(() => setCopiedGreeting(false), 2000);
    } else if (type === 'profilePrompt') {
      setCopiedProfilePrompt(true);
      setTimeout(() => setCopiedProfilePrompt(false), 2000);
    } else if (type === 'profileGreeting') {
      setCopiedProfileGreeting(true);
      setTimeout(() => setCopiedProfileGreeting(false), 2000);
    } else if (type === 'editPrompt') {
      setCopiedEditPrompt(true);
      setTimeout(() => setCopiedEditPrompt(false), 2000);
    } else if (type === 'editGreeting') {
      setCopiedEditGreeting(true);
      setTimeout(() => setCopiedEditGreeting(false), 2000);
    }
  };

  const filtered = businesses.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.type?.toLowerCase().includes(search.toLowerCase()) ||
    b.country?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search)
  );

  const currentTemplate = templates[newBiz.industry] || DEFAULT_TEMPLATES[newBiz.industry] || DEFAULT_TEMPLATES.service_and_appointment;

  return (
    <div>
      {/* HEADER BAR */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Businesses Management</h2>
          <p className="card-subtitle">
            Configured enterprise entities, department routing, and live voice operations.
          </p>
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 9, 
                          background: '#eff6ff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: 14
                        }}>
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                            {biz.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <MapPin size={12} />
                            <span>{biz.country || 'Global'}</span>
                            <span>•</span>
                            <Clock size={12} />
                            <span>{biz.timezone || 'UTC'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            {biz.has_agent && biz.agent_name ? (
                              <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Bot size={12} />
                                <span>{biz.agent_name}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(biz, 'voice')}
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  borderRadius: 6,
                                  padding: '2px 7px',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                                title="Click to configure AI Voice Agent for this business"
                              >
                                <Sparkles size={10} color="#b45309" />
                                <span>Setup Voice Agent</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-yellow">
                        {biz.type || biz.business_type || 'Service'}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${biz.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {biz.status || 'active'}
                      </span>
                    </td>

                    <td>
                      {biz.phone ? (
                        <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone size={12} color="#64748b" />
                          <span>{biz.phone}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                      )}
                      {biz.website && (
                        <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
                          <a href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            Visit Website ↗
                          </a>
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        {biz.calls || 0} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>calls</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {biz.minutes || 0} mins talk
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {biz.last_synced_at ? new Date(biz.last_synced_at).toLocaleDateString() : 'Active'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedBiz(biz);
                            setProfileTab('overview');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                          title="View complete business profile, assigned voice agent, and metrics"
                        >
                          <Eye size={13} />
                          <span>Profile</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(biz)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                          title="Edit business parameters"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setDeletingBiz(biz);
                            setDeleteError('');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: 12, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                          title="Delete business and cascade related records"
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
      {/* 1. BUSINESS PROFILE MODAL (WITH LIVE SYSTEM PROMPT VIEW)     */}
      {/* ============================================================ */}
      {selectedBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" role="dialog" aria-modal="true">
            <div className="modal-header" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 12, 
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)'
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {selectedBiz.name}
                    </h3>
                    <span className="badge badge-green">
                      {selectedBiz.status || 'active'}
                    </span>
                  </div>
                  <p className="card-subtitle" style={{ margin: 0, fontSize: 12 }}>
                    {selectedBiz.type || selectedBiz.business_type || 'Service Entity'} • ID: {selectedBiz.id}
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedBiz(null)}>✕</button>
            </div>

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
                className={`edit-tab-btn ${profileTab === 'voice' ? 'active' : ''}`}
                onClick={() => setProfileTab('voice')}
              >
                <Bot size={15} />
                <span>Assigned Voice Agent & Prompts</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${profileTab === 'operations' ? 'active' : ''}`}
                onClick={() => setProfileTab('operations')}
              >
                <Activity size={15} />
                <span>Appointments, Leads & Metrics</span>
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto' }}>
              {profileTab === 'overview' && (
                <div className="edit-section-card">
                  <div className="edit-section-header">
                    <h4>
                      <Building2 size={16} color="#2563eb" />
                      Core Enterprise Profile
                    </h4>
                    <span className="badge badge-blue">Entity Scope</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Industry Vertical
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.industry || selectedBiz.type || 'Service & Consultation'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Business Type
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.type || selectedBiz.business_type || 'Standard'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Jurisdiction & Country
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.country || 'United States'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Operating Timezone
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.timezone || 'America/New_York'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Telephone
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.phone || 'No phone recorded'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Contact Email
                      </strong>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {selectedBiz.email || 'No email recorded'}
                      </span>
                    </div>
                  </div>

                  {selectedBiz.website && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8edf4' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Official Website
                      </strong>
                      <a href={selectedBiz.website.startsWith('http') ? selectedBiz.website : `https://${selectedBiz.website}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                        {selectedBiz.website}
                      </a>
                    </div>
                  )}

                  {selectedBiz.description && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8edf4' }}>
                      <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Entity Mission & Scope Description
                      </strong>
                      <p style={{ color: '#334155', lineHeight: 1.5, margin: 0, fontSize: 13 }}>
                        {selectedBiz.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {profileTab === 'voice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {!selectedBiz.has_agent && !selectedBiz.agent_name ? (
                    <div className="edit-section-card" style={{ textAlign: 'center', padding: '36px 20px', background: '#f8fafc', border: '1.5px dashed #cbd5e1' }}>
                      <div style={{ width: 50, height: 50, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                        <Bot size={26} color="#d97706" />
                      </div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
                        No Voice Agent Configured Yet
                      </h4>
                      <p style={{ fontSize: 13, color: '#64748b', maxWidth: 460, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                        This business was registered without an active voice agent. You can configure its agent name, voice profile, pre-defined prompts, and router tools right now.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          const target = selectedBiz;
                          setSelectedBiz(null);
                          handleOpenEdit(target, 'voice');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                      >
                        <Sparkles size={16} />
                        <span>Setup AI Voice Agent & Fish Audio</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="edit-section-card">
                        <div className="edit-section-header">
                          <h4>
                            <Bot size={16} color="#2563eb" />
                            Assigned Voice Agent & Runtime
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const target = selectedBiz;
                                setSelectedBiz(null);
                                handleOpenEdit(target, 'voice');
                              }}
                              style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Edit3 size={12} />
                              <span>Edit Voice Agent</span>
                            </button>
                            <span className="badge badge-blue">Fish Audio Live</span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                          <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                              Assigned Agent Name
                            </strong>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                              {selectedBiz.agent_name || `${selectedBiz.name} AI Assistant`}
                            </span>
                          </div>

                          <div style={{ padding: 12, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <strong style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                              Fish Audio Agent ID
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
                              LLM Engine & Prompt Version
                            </strong>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>
                              {selectedBiz.llm || 'Scadova Runtime / scadova-routing-v1'}
                            </span>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              Version: {selectedBiz.prompt_version || 'v1.0'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* LIVE FIRST MESSAGE / GREETING */}
                      <div className="edit-section-card">
                        <div className="edit-section-header">
                          <h4>
                            <Sparkles size={16} color="#eab308" />
                            First Message / Opening Greeting
                          </h4>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(selectedBiz.first_message || (templates.service_and_appointment?.greeting ? renderTemplateText(templates.service_and_appointment.greeting, selectedBiz.name, selectedBiz.agent_name) : ''), 'profileGreeting')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedProfileGreeting ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedProfileGreeting ? 'Copied!' : 'Copy Greeting'}</span>
                          </button>
                        </div>
                        <div style={{ padding: '12px 16px', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{selectedBiz.first_message || (templates.service_and_appointment?.greeting ? renderTemplateText(templates.service_and_appointment.greeting, selectedBiz.name, selectedBiz.agent_name) : `Hi, welcome to ${selectedBiz.name}. I am your AI voice assistant. How can I help you today?`)}"
                        </div>
                      </div>

                      {/* LIVE SYSTEM PROMPT (FISH AUDIO READY) */}
                      <div className="edit-section-card">
                        <div className="edit-section-header">
                          <h4>
                            <Code2 size={16} color="#2563eb" />
                            Live System Prompt (Fish Audio Parameterized)
                          </h4>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(selectedBiz.system_prompt || (templates.service_and_appointment?.system_prompt ? renderTemplateText(templates.service_and_appointment.system_prompt, selectedBiz.name, selectedBiz.agent_name, selectedBiz.business_key || selectedBiz.id) : ''), 'profilePrompt')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedProfilePrompt ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedProfilePrompt ? 'Copied!' : 'Copy System Prompt'}</span>
                          </button>
                        </div>

                        <div className="prompt-preview-container">
                          <div className="prompt-preview-header">
                            <span>Fish Audio Live System Prompt • {selectedBiz.prompt_version || 'v1.0'}</span>
                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>● CONNECTED TO FASTAPI TOOLS</span>
                          </div>
                          <pre className="prompt-preview-body">
                            {selectedBiz.system_prompt || (templates.service_and_appointment?.system_prompt ? renderTemplateText(templates.service_and_appointment.system_prompt, selectedBiz.name, selectedBiz.agent_name, selectedBiz.business_key || selectedBiz.id) : 'Pre-configured system prompt active.')}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

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
      {/* 2. ADD BUSINESS & AUTO-GENERATE VOICE AGENT MODAL            */}
      {/* ============================================================ */}
      {addModalOpen && (
        <div className="modal-overlay">
          <div className="edit-dialog" style={{ width: 'min(920px, 95vw)', maxWidth: 920, height: 'min(88vh, 820px)' }} role="dialog" aria-modal="true">
            <div className="modal-header" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 12, 
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Register Business & AI Voice Agent
                  </h3>
                  <p className="card-subtitle" style={{ margin: 0, fontSize: 12 }}>
                    Automatically provisions voice agent with industry prompts ready for Fish Audio.
                  </p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>

            <div className="edit-tabs-bar">
              <button
                type="button"
                className={`edit-tab-btn ${addTab === 'business' ? 'active' : ''}`}
                onClick={() => setAddTab('business')}
              >
                <Building2 size={15} />
                <span>1. Business & About</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${addTab === 'hours' ? 'active' : ''}`}
                onClick={() => setAddTab('hours')}
              >
                <Clock size={15} />
                <span>2. Operating Hours</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${addTab === 'services' ? 'active' : ''}`}
                onClick={() => setAddTab('services')}
              >
                <FileText size={15} />
                <span>3. Services & Catalogue</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${addTab === 'agent' ? 'active' : ''}`}
                onClick={() => setAddTab('agent')}
                style={!newBiz.setup_agent_now ? { color: '#64748b' } : {}}
              >
                {newBiz.setup_agent_now ? <Bot size={15} /> : <Lock size={14} color="#64748b" />}
                <span>4. AI Voice Agent & Fish Audio Prompt</span>
                {newBiz.setup_agent_now ? (
                  <span className="badge badge-green" style={{ fontSize: 9.5, padding: '1px 5px', marginLeft: 4 }}>Live</span>
                ) : (
                  <span className="badge badge-gray" style={{ fontSize: 9.5, padding: '1px 5px', marginLeft: 4 }}>Locked</span>
                )}
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, height: '100%', overflow: 'hidden' }}>
              <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                {createError && (
                  <div className="modal-alert-error" style={{ marginBottom: 18 }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 13.5, marginBottom: 2 }}>Unable to Create Business</strong>
                      <span style={{ fontSize: 13 }}>{createError}</span>
                    </div>
                  </div>
                )}

                {/* TAB 1: BUSINESS IDENTITY & ABOUT */}
                {addTab === 'business' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Building2 size={16} color="#2563eb" />
                          Business Identity & Industry
                        </h4>
                        <span className="badge badge-blue">Required</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                        <div className="edit-field-group">
                          <label>
                            <span>Business Name *</span>
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Scadova Care Clinic, Bawarchi Dining..."
                            value={newBiz.name}
                            onChange={(e) => handleBusinessNameChange(e.target.value)}
                            required
                          />
                          <small>Used across caller greetings, identification, and prompt rules</small>
                        </div>

                        <div className="edit-field-group">
                          <label>
                            <span>Industry / Business Type *</span>
                          </label>
                          <select
                            className="form-select"
                            value={newBiz.industry}
                            onChange={(e) => handleIndustryChange(e.target.value)}
                          >
                            <option value="service_and_appointment">Appointment Booking & Service Consultation</option>
                            <option value="restaurant">Restaurant & Dining Hospitality</option>
                            <option value="clinic">Clinic & Healthcare Consultation</option>
                            <option value="loan_finance">Loan & Financial Services</option>
                          </select>
                          <small>Auto-loads system prompt, voice profile, and router tools</small>
                        </div>
                      </div>
                    </div>

                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Globe size={16} color="#2563eb" />
                          Contact, Location & Coordinates
                        </h4>
                        <span className="badge badge-gray">Operational</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="edit-field-group">
                          <label>Phone Number</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. +1 (205) 555-0199"
                            value={newBiz.phone}
                            onChange={(e) => setNewBiz({ ...newBiz, phone: e.target.value })}
                          />
                        </div>

                        <div className="edit-field-group">
                          <label>Email Address</label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="e.g. contact@business.com"
                            value={newBiz.email}
                            onChange={(e) => setNewBiz({ ...newBiz, email: e.target.value })}
                          />
                        </div>

                        <div className="edit-field-group">
                          <label>Country</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="United States, India, Canada..."
                            value={newBiz.country}
                            onChange={(e) => setNewBiz({ ...newBiz, country: e.target.value })}
                          />
                        </div>

                        <div className="edit-field-group">
                          <label>Timezone (IANA)</label>
                          <select
                            className="form-select"
                            value={newBiz.timezone}
                            onChange={(e) => setNewBiz({ ...newBiz, timezone: e.target.value })}
                          >
                            <option value="America/New_York">America/New_York (Eastern)</option>
                            <option value="America/Chicago">America/Chicago (Central)</option>
                            <option value="America/Denver">America/Denver (Mountain)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                            <option value="UTC">UTC</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="edit-field-group">
                          <label>Website URL</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="https://example.com"
                            value={newBiz.website}
                            onChange={(e) => setNewBiz({ ...newBiz, website: e.target.value })}
                          />
                        </div>

                        <div className="edit-field-group">
                          <label>Physical Address / Location</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="123 Market Street, Suite 200..."
                            value={newBiz.address}
                            onChange={(e) => setNewBiz({ ...newBiz, address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* DEDICATED ABOUT THE BUSINESS / AI KNOWLEDGE BASE */}
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <FileText size={16} color="#2563eb" />
                          About the Business (AI Knowledge Base & FAQs)
                        </h4>
                        <span className="badge badge-blue">Ground Truth Context</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#475569', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                        Provide comprehensive background information, caller policies, FAQs, parking guidance, and general business details. The AI voice agent and tools rely on this verified knowledge base.
                      </p>

                      <div className="edit-field-group">
                        <textarea
                          rows={4}
                          className="form-textarea"
                          placeholder="e.g. Scadova Care Clinic has provided family healthcare, dental checkups, and wellness consultations for over 15 years. Walk-ins are accepted between 9am-11am. We require 24 hours notice for appointment rescheduling. Free customer parking is available behind the building."
                          value={newBiz.description}
                          onChange={(e) => setNewBiz({ ...newBiz, description: e.target.value })}
                          style={{ fontSize: 13, lineHeight: 1.5 }}
                        />
                        <small>Directly ingested into the AI voice agent prompt and Fish Audio runtime knowledge base.</small>
                      </div>
                    </div>

                    {/* SETUP VOICE AGENT CHOICE CARD */}
                    <div className="edit-section-card" style={{ border: newBiz.setup_agent_now ? '1.5px solid #bfdbfe' : '1.5px solid #cbd5e1', background: '#f8fafc' }}>
                      <div className="edit-section-header">
                        <h4>
                          <Bot size={16} color={newBiz.setup_agent_now ? '#2563eb' : '#64748b'} />
                          AI Voice Agent Setup
                        </h4>
                        <span className={`badge ${newBiz.setup_agent_now ? 'badge-blue' : 'badge-gray'}`}>
                          {newBiz.setup_agent_now ? 'Fish Audio Live' : 'Agent Skipped'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#475569', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                        Configure the automated AI voice agent right now with live Fish Audio voices and router tools, or register the business first and set up the agent later.
                      </p>

                      <div className="setup-choice-grid">
                        <div
                          className={`setup-choice-card ${newBiz.setup_agent_now ? 'selected' : ''}`}
                          onClick={() => setNewBiz((prev) => ({ ...prev, setup_agent_now: true, auto_create_agent: true }))}
                        >
                          <div className="setup-choice-radio">
                            {newBiz.setup_agent_now && <div className="setup-choice-radio-inner" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                Set up AI Voice Agent now
                              </span>
                              <span className="badge badge-green" style={{ fontSize: 10, padding: '1px 6px' }}>Recommended</span>
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                              Configures agent name, first greeting, Fish Audio voice profile, live system prompt, and auto-selects all {currentTemplate.tools?.length || 0} router tools.
                            </p>
                          </div>
                        </div>

                        <div
                          className={`setup-choice-card ${!newBiz.setup_agent_now ? 'selected' : ''}`}
                          onClick={() => {
                            setNewBiz((prev) => ({ ...prev, setup_agent_now: false, auto_create_agent: false }));
                            if (addTab === 'agent') setAddTab('business');
                          }}
                        >
                          <div className="setup-choice-radio">
                            {!newBiz.setup_agent_now && <div className="setup-choice-radio-inner" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                Set up Voice Agent later
                              </span>
                              <span className="badge badge-gray" style={{ fontSize: 10, padding: '1px 6px' }}>Tab 4 Locked</span>
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                              Save business details immediately without provisioning a voice agent. You can configure the agent anytime in the Edit menu.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* DYNAMIC SELECTION FEEDBACK BANNER */}
                      {newBiz.setup_agent_now ? (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#065f46' }}>
                            <CheckCircle size={16} color="#059669" style={{ flexShrink: 0 }} />
                            <span><strong>Tab 4 is Unlocked:</strong> AI Voice Agent will be created in Fish Audio with {currentTemplate.tools?.length || 8} webhook tools.</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setAddTab('agent')}
                            style={{ fontSize: 11, padding: '3px 10px', background: '#ffffff', color: '#047857', borderColor: '#6ee7b7', flexShrink: 0 }}
                          >
                            Go to Tab 4 →
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569' }}>
                            <Lock size={16} color="#64748b" style={{ flexShrink: 0 }} />
                            <span><strong>Tab 4 is Locked:</strong> Business will be registered immediately without creating an AI voice agent.</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setNewBiz(prev => ({ ...prev, setup_agent_now: true, auto_create_agent: true }))}
                            style={{ fontSize: 11, padding: '3px 10px', background: '#ffffff', color: '#2563eb', borderColor: '#bfdbfe', flexShrink: 0 }}
                          >
                            <Unlock size={12} />
                            <span>Unlock</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: OPERATING HOURS */}
                {addTab === 'hours' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Clock size={16} color="#2563eb" />
                          Weekly Operating Hours & Schedule
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newBizNoHours}
                              onChange={(e) => setNewBizNoHours(e.target.checked)}
                              style={{ width: 15, height: 15, accentColor: '#2563eb' }}
                            />
                            <span>No operating hours available / Open 24/7</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                          Caller inquiries asking "When are you open?" will refer to this schedule via the <code>get_business_hours</code> tool.
                        </p>
                        {!newBizNoHours && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(false, 'weekdays')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              Weekdays (9am-5pm)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(false, 'alldays')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              All 7 Days (9am-6pm)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(false, 'saturday')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              Weekend Half-Day
                            </button>
                          </div>
                        )}
                      </div>

                      {newBizNoHours ? (
                        <div style={{ padding: '24px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          🏢 Marked as Open 24/7 or no fixed schedule. Callers will be informed the business operates 24/7.
                        </div>
                      ) : (
                        <div className="hours-schedule-container">
                          {newBizHours.map((h) => (
                            <div key={h.day} className={`hours-day-row ${h.closed ? 'closed-day' : ''}`}>
                              <div className="hours-day-label">
                                <Calendar size={14} color="#64748b" />
                                <span>{h.day}</span>
                              </div>

                              <div className="hours-inputs-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Opens:</span>
                                  <input
                                    type="time"
                                    className="hours-time-input"
                                    value={h.open_time || '09:00'}
                                    disabled={h.closed}
                                    onChange={(e) => handleUpdateHour(false, h.day, 'open_time', e.target.value)}
                                  />
                                </div>

                                <span style={{ color: '#94a3b8' }}>—</span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Closes:</span>
                                  <input
                                    type="time"
                                    className="hours-time-input"
                                    value={h.close_time || '17:00'}
                                    disabled={h.closed}
                                    onChange={(e) => handleUpdateHour(false, h.day, 'close_time', e.target.value)}
                                  />
                                </div>
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(h.closed)}
                                  onChange={(e) => handleUpdateHour(false, h.day, 'closed', e.target.checked)}
                                  style={{ width: 14, height: 14, accentColor: '#dc2626' }}
                                />
                                <span style={{ color: h.closed ? '#dc2626' : '#64748b', fontWeight: h.closed ? 700 : 500 }}>
                                  {h.closed ? 'Closed all day' : 'Closed today?'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: SERVICES & CATALOGUE */}
                {addTab === 'services' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h4>
                            <FileText size={16} color="#2563eb" />
                            Catalogue Services & Offerings
                          </h4>
                          <span className="badge badge-blue">
                            {newBizNoServices ? '0 Services' : `${newBizServices.length} Active`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={newBizNoServices}
                              onChange={(e) => setNewBizNoServices(e.target.checked)}
                              style={{ width: 15, height: 15, accentColor: '#2563eb' }}
                            />
                            <span>No catalogue / services available</span>
                          </label>
                          {!newBizNoServices && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAddServiceItem(false)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px' }}
                            >
                              <Plus size={14} />
                              <span>Add New Service</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                        Services define what callers can inquire about or book via <code>get_services</code> and <code>create_appointment</code>. Use the option buttons on each item to dynamically attach price, duration, or descriptions.
                      </p>

                      {newBizNoServices ? (
                        <div style={{ padding: '24px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          ℹ️ No services configured for this business. You can add services at any time later in the Edit menu.
                        </div>
                      ) : newBizServices.length === 0 ? (
                        <div style={{ padding: '28px 16px', background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px 0' }}>No services added yet.</p>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleAddServiceItem(false)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Plus size={15} />
                            <span>Add First Service</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {newBizServices.map((svc, idx) => (
                            <div key={svc.id} className="service-item-card">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid #e8edf4', paddingBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Service #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRemoveServiceItem(false, svc.id)}
                                  title="Remove this service"
                                  style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5', padding: '3px 8px' }}
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              </div>

                              <div className="edit-field-group" style={{ marginBottom: 12 }}>
                                <label>
                                  <span>Service Name *</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Consultation, Tooth Extraction, Loan Intake..."
                                  value={svc.service_name}
                                  onChange={(e) => handleUpdateServiceItem(false, svc.id, 'service_name', e.target.value)}
                                  required
                                />
                              </div>

                              {/* DYNAMIC FIELD TOGGLES ROW */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: (svc.showPrice || svc.showDuration || svc.showDescription) ? 12 : 0 }}>
                                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Optional Fields:</span>
                                {!svc.showPrice && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(false, svc.id, 'price', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Price
                                  </button>
                                )}
                                {!svc.showDuration && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(false, svc.id, 'duration', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Duration
                                  </button>
                                )}
                                {!svc.showDescription && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(false, svc.id, 'description', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Description
                                  </button>
                                )}
                              </div>

                              {/* CONDITIONALLY RENDERED PRICE AND DURATION */}
                              {(svc.showPrice || svc.showDuration) && (
                                <div style={{ display: 'grid', gridTemplateColumns: svc.showPrice && svc.showDuration ? '1fr 1fr' : '1fr', gap: 12, marginBottom: svc.showDescription ? 12 : 0 }}>
                                  {svc.showPrice && (
                                    <div className="edit-field-group">
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <label style={{ margin: 0 }}>Price ($ USD)</label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleServiceField(false, svc.id, 'price', false)}
                                          style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                          title="Remove price field"
                                        >
                                          ✕ Remove
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="e.g. 49.00"
                                        value={svc.price}
                                        onChange={(e) => handleUpdateServiceItem(false, svc.id, 'price', e.target.value)}
                                      />
                                    </div>
                                  )}

                                  {svc.showDuration && (
                                    <div className="edit-field-group">
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <label style={{ margin: 0 }}>Duration (Minutes)</label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleServiceField(false, svc.id, 'duration', false)}
                                          style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                          title="Remove duration field"
                                        >
                                          ✕ Remove
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        min="1"
                                        className="form-input"
                                        placeholder="e.g. 30"
                                        value={svc.duration_minutes}
                                        onChange={(e) => handleUpdateServiceItem(false, svc.id, 'duration_minutes', e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CONDITIONALLY RENDERED DESCRIPTION */}
                              {svc.showDescription && (
                                <div className="edit-field-group">
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <label style={{ margin: 0 }}>Service Description</label>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleServiceField(false, svc.id, 'description', false)}
                                      style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                      title="Remove description field"
                                    >
                                      ✕ Remove
                                    </button>
                                  </div>
                                  <textarea
                                    rows={2}
                                    className="form-textarea"
                                    placeholder="Short description of what the service covers..."
                                    value={svc.short_description}
                                    onChange={(e) => handleUpdateServiceItem(false, svc.id, 'short_description', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleAddServiceItem(false)}
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderStyle: 'dashed' }}
                          >
                            <Plus size={15} />
                            <span>Add Another Service</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: AI VOICE AGENT & FISH AUDIO PROMPT */}
                {addTab === 'agent' && (
                  !newBiz.setup_agent_now ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 12 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#64748b' }}>
                        <Lock size={28} />
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                        AI Voice Agent Setup is Locked
                      </h4>
                      <p style={{ color: '#64748b', fontSize: 13, maxWidth: 480, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                        You selected <strong>"Set up Voice Agent later"</strong> in Step 1. The business will be registered without provisioning an agent in Fish Audio.
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setNewBiz(prev => ({ ...prev, setup_agent_now: true, auto_create_agent: true }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Unlock size={15} />
                          <span>Unlock & Configure Voice Agent Now</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setAddTab('business')}
                        >
                          ← Back to Step 1
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Bot size={16} color="#2563eb" />
                          Voice Agent Identity & Speech Profile
                        </h4>
                        <span className="badge badge-green">Ready for Fish Audio</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: 14 }}>
                        <div className="edit-field-group">
                          <label>Assigned Agent Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={newBiz.agent_name}
                            onChange={(e) => {
                              const aName = e.target.value;
                              setNewBiz((prev) => ({
                                ...prev,
                                agent_name: aName,
                                greeting: renderTemplateText(currentTemplate.greeting, prev.name, aName, prev.name.toLowerCase().replace(/\s+/g, '_')),
                                system_prompt: renderTemplateText(currentTemplate.system_prompt, prev.name, aName, prev.name.toLowerCase().replace(/\s+/g, '_'))
                              }));
                            }}
                            required
                          />
                        </div>

                        <div className="edit-field-group">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <label style={{ margin: 0 }}>Voice Profile</label>
                            <span className="badge-voice-default">Fish Audio</span>
                          </div>
                          <select
                            className="form-select"
                            value={newBizCustomVoice ? 'custom_public' : (newBiz.voice_id || 'fish_audio_default')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom_public') {
                                setNewBizCustomVoice(true);
                                setNewBiz((prev) => ({
                                  ...prev,
                                  voice_id: newBizCustomVoiceId.trim() || 'fish_audio_default',
                                  voice_name: newBizCustomVoiceId.trim() ? `Public Voice (${newBizCustomVoiceId.trim()})` : 'Custom Public Voice'
                                }));
                              } else {
                                setNewBizCustomVoice(false);
                                const profile = VOICE_PROFILES.find((p) => p.id === val);
                                setNewBiz((prev) => ({
                                  ...prev,
                                  voice_id: val,
                                  voice_name: profile ? profile.name : 'Fish Audio Default'
                                }));
                              }
                            }}
                          >
                            <optgroup label="Default (Standard)">
                              <option value="fish_audio_default">Fish Audio Default (System Standard)</option>
                            </optgroup>
                            <optgroup label="Curated Fish Audio Voices">
                              <option value="serena_exec_en">Fish Audio - Serena (Executive English)</option>
                              <option value="marcus_conv_en">Fish Audio - Marcus (Conversational English)</option>
                              <option value="sophia_care_en">Fish Audio - Sophia (Warm Healthcare English)</option>
                              <option value="ravi_finance_te_en">Fish Audio - Ravi (Professional Multilingual)</option>
                            </optgroup>
                            <optgroup label="Public / Custom Voice Models">
                              <option value="custom_public">Public / Custom Voice Model ID...</option>
                            </optgroup>
                          </select>
                        </div>

                        <div className="edit-field-group">
                          <label>Language</label>
                          <select
                            className="form-select"
                            value={newBiz.language}
                            onChange={(e) => setNewBiz({ ...newBiz, language: e.target.value })}
                          >
                            <option value="en">English (EN)</option>
                            <option value="te">Telugu (TE)</option>
                            <option value="es">Spanish (ES)</option>
                          </select>
                        </div>
                      </div>

                      {/* PUBLIC VOICE MODEL INPUT OR DEFAULT CALLOUT */}
                      {newBizCustomVoice ? (
                        <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                            Fish Audio Public Voice ID / Reference
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 7c32e189a456... or public voice reference name"
                            value={newBizCustomVoiceId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewBizCustomVoiceId(val);
                              setNewBiz((prev) => ({
                                ...prev,
                                voice_id: val.trim() || 'fish_audio_default',
                                voice_name: val.trim() ? `Public Voice (${val.trim()})` : 'Fish Audio Default'
                              }));
                            }}
                          />
                          <small style={{ color: '#64748b', fontSize: 11.5, marginTop: 5, display: 'block' }}>
                            Paste the ID or reference tag from the Fish Audio public voice model directory. You can switch back to Fish Audio Default at any time.
                          </small>
                        </div>
                      ) : (
                        <div className="voice-profile-callout">
                          <Bot size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12 }}>
                            <strong>Fish Audio Default is active.</strong> You can use standard speech synthesis now, and switch to any Fish Audio public voice profile anytime.
                          </span>
                        </div>
                      )}

                      {/* INTERACTIVE ROUTER TOOLS CHECKBOXES */}
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Attached Router Tools ({newBiz.attached_tools?.length || 0} / {currentTemplate.tools?.length || 0} Enabled)
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={handleSelectAllNewBizTools}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: '2px 8px' }}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={handleClearAllNewBizTools}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: '2px 8px' }}
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(currentTemplate.tools || []).map((tool) => {
                            const isChecked = (newBiz.attached_tools || []).includes(tool);
                            return (
                              <label
                                key={tool}
                                className={`tool-checkbox-item ${isChecked ? 'checked' : ''}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleToggleNewBizTool(tool);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                />
                                <span>⚙️ {tool}</span>
                              </label>
                            );
                          })}
                        </div>
                        <small style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 11 }}>
                          All tools for this industry are selected by default for live caller execution. Uncheck any tools you wish to disable.
                        </small>
                      </div>
                    </div>

                    {/* EDITABLE FIRST MESSAGE / GREETING */}
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Sparkles size={16} color="#eab308" />
                          First Message / Greeting (Pre-defined)
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={handleResetAddGreeting}
                            title="Reset greeting to industry default"
                            style={{ color: '#475569' }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset Default</span>
                          </button>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(newBiz.greeting, 'greeting')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedGreeting ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedGreeting ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="edit-field-group">
                        <textarea
                          rows={3}
                          className="form-textarea"
                          value={newBiz.greeting}
                          onChange={(e) => setNewBiz({ ...newBiz, greeting: e.target.value })}
                          style={{ fontSize: 13, lineHeight: 1.5 }}
                        />
                        <small>Spoken immediately when caller is connected. Automatically adapted to selected industry.</small>
                      </div>
                    </div>

                    {/* EDITABLE PRE-DEFINED SYSTEM PROMPT (FISH AUDIO READY) */}
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Code2 size={16} color="#2563eb" />
                          Pre-defined System Prompt (Fish Audio Ready)
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={handleResetAddPrompt}
                            title="Reset system prompt to industry default"
                            style={{ color: '#475569' }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset Default</span>
                          </button>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(newBiz.system_prompt, 'prompt')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedPrompt ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="edit-field-group">
                        <textarea
                          rows={12}
                          className="prompt-editor-box"
                          value={newBiz.system_prompt}
                          onChange={(e) => setNewBiz({ ...newBiz, system_prompt: e.target.value })}
                        />
                        <small>
                          Contains verified business rules, mandatory verification steps, backend data binding, and tool policies. Fully editable at any time.
                        </small>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

              {/* LOCKED MODAL FOOTER - GUARANTEED VISIBLE ACROSS ALL VIEWPORTS */}
              <div 
                className="modal-footer" 
                style={{ 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: '#f8fafc', 
                  borderTop: '1.5px solid #e2e8f0',
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 30,
                  boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAddModalOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {addTab === 'business' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (!newBiz.name.trim()) {
                          setCreateError('Please enter a business name first.');
                          return;
                        }
                        setCreateError('');
                        setAddTab('hours');
                      }}
                    >
                      <span>Next: Operating Hours</span>
                      <span>→</span>
                    </button>
                  )}

                  {addTab === 'hours' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAddTab('business')}
                      >
                        ← Back to Details
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setAddTab('services')}
                      >
                        <span>Next: Services & Catalogue</span>
                        <span>→</span>
                      </button>
                    </>
                  )}

                  {addTab === 'services' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAddTab('hours')}
                      >
                        ← Back to Hours
                      </button>
                      {newBiz.setup_agent_now ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setAddTab('agent')}
                        >
                          <span>Next: Voice Agent & Prompt</span>
                          <span>→</span>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={creating}
                          style={{ minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          {creating ? (
                            <>
                              <span className="spin">⟳</span>
                              <span>Registering Business...</span>
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              <span>Create Business (Voice Agent Later)</span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {addTab === 'agent' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setAddTab('services')}
                      >
                        ← Back to Services
                      </button>
                      {newBiz.setup_agent_now ? (
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={creating}
                          style={{ minWidth: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          {creating ? (
                            <>
                              <span className="spin">⟳</span>
                              <span>Provisioning Live Agent...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} />
                              <span>Create Business & Live Agent</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={creating}
                          style={{ minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          {creating ? (
                            <>
                              <span className="spin">⟳</span>
                              <span>Registering Business...</span>
                            </>
                          ) : (
                            <>
                              <Check size={16} />
                              <span>Create Business (Voice Agent Later)</span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. EDIT BUSINESS FORM MODAL                                  */}
      {/* ============================================================ */}
      {editingBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" style={{ width: 'min(920px, 95vw)', maxWidth: 920, height: 'min(88vh, 820px)' }} role="dialog" aria-modal="true">
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
                    <span className="badge badge-blue">ID: {editingBiz.id}</span>
                  </div>
                  <p className="card-subtitle" style={{ margin: 0, fontSize: 12 }}>
                    Update business entity parameters and voice routing attributes
                  </p>
                </div>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setEditingBiz(null)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="edit-tabs-bar">
              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'profile' ? 'active' : ''}`}
                onClick={() => setEditTab('profile')}
              >
                <Building2 size={15} />
                <span>1. General & About</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'hours' ? 'active' : ''}`}
                onClick={() => setEditTab('hours')}
              >
                <Clock size={15} />
                <span>2. Operating Hours</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'services' ? 'active' : ''}`}
                onClick={() => setEditTab('services')}
              >
                <FileText size={15} />
                <span>3. Services & Catalogue</span>
              </button>
              <button
                type="button"
                className={`edit-tab-btn ${editTab === 'voice' ? 'active' : ''}`}
                onClick={() => setEditTab('voice')}
              >
                <Bot size={15} />
                <span>4. Voice & AI Routing</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, height: '100%', overflow: 'hidden' }}>
              <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                {saveError && (
                  <div className="modal-alert-error" style={{ marginBottom: 18 }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: 13.5, marginBottom: 2 }}>Unable to Update Business</strong>
                      <span style={{ fontSize: 13 }}>{saveError}</span>
                    </div>
                  </div>
                )}

                {/* TAB 1: GENERAL & ABOUT */}
                {editTab === 'profile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="edit-field-group">
                      <label>Business Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editingBiz.name || ''}
                        onChange={(e) => setEditingBiz({ ...editingBiz, name: e.target.value })}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="edit-field-group">
                        <label>Business Type</label>
                        <select
                          className="form-select"
                          value={editingBiz.type || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, type: e.target.value })}
                        >
                          <option value="Service and Appointment Booking">Service and Appointment Booking</option>
                          <option value="Restaurant">Restaurant</option>
                          <option value="Clinic">Clinic</option>
                          <option value="Loan Agency">Loan Agency</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>

                      <div className="edit-field-group">
                        <label>Operational Status</label>
                        <select
                          className="form-select"
                          value={editingBiz.status || 'active'}
                          onChange={(e) => setEditingBiz({ ...editingBiz, status: e.target.value })}
                        >
                          <option value="active">Active (Serving live calls)</option>
                          <option value="inactive">Inactive / Paused</option>
                          <option value="draft">Draft Mode</option>
                        </select>
                      </div>
                    </div>

                    <div className="edit-field-group">
                      <label>Industry Vertical</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Fine Dining & Hospitality, Healthcare, Banking..."
                        value={editingBiz.industry || ''}
                        onChange={(e) => setEditingBiz({ ...editingBiz, industry: e.target.value })}
                      />
                    </div>

                    {/* CONTACT & LOCATION FIELDS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="edit-field-group">
                        <label>Telephone</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="+1 (555) 000-0000"
                          value={editingBiz.phone || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, phone: e.target.value })}
                        />
                      </div>

                      <div className="edit-field-group">
                        <label>Email</label>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="info@business.com"
                          value={editingBiz.email || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="edit-field-group">
                        <label>Country</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editingBiz.country || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, country: e.target.value })}
                        />
                      </div>

                      <div className="edit-field-group">
                        <label>Timezone (IANA)</label>
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
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="edit-field-group">
                        <label>Website URL</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="https://example.com"
                          value={editingBiz.website || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, website: e.target.value })}
                        />
                      </div>

                      <div className="edit-field-group">
                        <label>Physical Address</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="123 Main St, Suite 400..."
                          value={editingBiz.address || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, address: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* DEDICATED ABOUT THE BUSINESS / AI KNOWLEDGE BASE */}
                    <div className="edit-section-card" style={{ background: '#f8fafc' }}>
                      <div className="edit-section-header">
                        <h4>
                          <FileText size={16} color="#2563eb" />
                          About the Business (AI Knowledge Base & FAQs)
                        </h4>
                        <span className="badge badge-blue">Knowledge Ground Truth</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#475569', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                        Background facts, cancellation policies, FAQs, parking details, and instructions provided to callers by the AI voice agent.
                      </p>

                      <div className="edit-field-group">
                        <textarea
                          rows={4}
                          className="form-textarea"
                          placeholder="Provide comprehensive background and FAQs for voice agent knowledge..."
                          value={editingBiz.description || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, description: e.target.value })}
                          style={{ fontSize: 13, lineHeight: 1.5 }}
                        />
                        <small>Directly synchronized with live agent context and runtime prompts.</small>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: OPERATING HOURS */}
                {editTab === 'hours' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Clock size={16} color="#2563eb" />
                          Weekly Operating Hours & Schedule
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editBizNoHours}
                              onChange={(e) => setEditBizNoHours(e.target.checked)}
                              style={{ width: 15, height: 15, accentColor: '#2563eb' }}
                            />
                            <span>No operating hours available / Open 24/7</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                          Caller inquiries asking about business hours are answered using this schedule.
                        </p>
                        {!editBizNoHours && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(true, 'weekdays')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              Weekdays (9am-5pm)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(true, 'alldays')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              All 7 Days (9am-6pm)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleApplyPresetHours(true, 'saturday')}
                              style={{ fontSize: 11, padding: '3px 8px' }}
                            >
                              Weekend Half-Day
                            </button>
                          </div>
                        )}
                      </div>

                      {editBizNoHours ? (
                        <div style={{ padding: '24px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          🏢 Marked as Open 24/7 or no fixed schedule.
                        </div>
                      ) : (
                        <div className="hours-schedule-container">
                          {editBizHours.map((h) => (
                            <div key={h.day} className={`hours-day-row ${h.closed ? 'closed-day' : ''}`}>
                              <div className="hours-day-label">
                                <Calendar size={14} color="#64748b" />
                                <span>{h.day}</span>
                              </div>

                              <div className="hours-inputs-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Opens:</span>
                                  <input
                                    type="time"
                                    className="hours-time-input"
                                    value={h.open_time || '09:00'}
                                    disabled={h.closed}
                                    onChange={(e) => handleUpdateHour(true, h.day, 'open_time', e.target.value)}
                                  />
                                </div>

                                <span style={{ color: '#94a3b8' }}>—</span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: '#64748b' }}>Closes:</span>
                                  <input
                                    type="time"
                                    className="hours-time-input"
                                    value={h.close_time || '17:00'}
                                    disabled={h.closed}
                                    onChange={(e) => handleUpdateHour(true, h.day, 'close_time', e.target.value)}
                                  />
                                </div>
                              </div>

                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5, userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(h.closed)}
                                  onChange={(e) => handleUpdateHour(true, h.day, 'closed', e.target.checked)}
                                  style={{ width: 14, height: 14, accentColor: '#dc2626' }}
                                />
                                <span style={{ color: h.closed ? '#dc2626' : '#64748b', fontWeight: h.closed ? 700 : 500 }}>
                                  {h.closed ? 'Closed all day' : 'Closed today?'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: SERVICES & CATALOGUE */}
                {editTab === 'services' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h4>
                            <FileText size={16} color="#2563eb" />
                            Catalogue Services & Offerings
                          </h4>
                          <span className="badge badge-blue">
                            {editBizNoServices ? '0 Services' : `${editBizServices.length} Active`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editBizNoServices}
                              onChange={(e) => setEditBizNoServices(e.target.checked)}
                              style={{ width: 15, height: 15, accentColor: '#2563eb' }}
                            />
                            <span>No catalogue / services available</span>
                          </label>
                          {!editBizNoServices && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAddServiceItem(true)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px' }}
                            >
                              <Plus size={14} />
                              <span>Add New Service</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                        Services available for customer consultation or booking. Optional fields can be enabled or removed dynamically on each service.
                      </p>

                      {editBizNoServices ? (
                        <div style={{ padding: '24px 16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          ℹ️ No services configured. Callers asking for services will be informed that general assistance is provided.
                        </div>
                      ) : editBizServices.length === 0 ? (
                        <div style={{ padding: '28px 16px', background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 10, textAlign: 'center' }}>
                          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px 0' }}>No services configured yet.</p>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleAddServiceItem(true)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Plus size={15} />
                            <span>Add First Service</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {editBizServices.map((svc, idx) => (
                            <div key={svc.id} className="service-item-card">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid #e8edf4', paddingBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Service #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRemoveServiceItem(true, svc.id)}
                                  title="Remove this service"
                                  style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5', padding: '3px 8px' }}
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              </div>

                              <div className="edit-field-group" style={{ marginBottom: 12 }}>
                                <label>
                                  <span>Service Name *</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Consultation, Tooth Extraction, Loan Intake..."
                                  value={svc.service_name}
                                  onChange={(e) => handleUpdateServiceItem(true, svc.id, 'service_name', e.target.value)}
                                  required
                                />
                              </div>

                              {/* DYNAMIC FIELD TOGGLES ROW */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: (svc.showPrice || svc.showDuration || svc.showDescription) ? 12 : 0 }}>
                                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Optional Fields:</span>
                                {!svc.showPrice && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(true, svc.id, 'price', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Price
                                  </button>
                                )}
                                {!svc.showDuration && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(true, svc.id, 'duration', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Duration
                                  </button>
                                )}
                                {!svc.showDescription && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleToggleServiceField(true, svc.id, 'description', true)}
                                    style={{ fontSize: 11, padding: '3px 9px', background: '#ffffff' }}
                                  >
                                    + Add Description
                                  </button>
                                )}
                              </div>

                              {/* CONDITIONALLY RENDERED PRICE AND DURATION */}
                              {(svc.showPrice || svc.showDuration) && (
                                <div style={{ display: 'grid', gridTemplateColumns: svc.showPrice && svc.showDuration ? '1fr 1fr' : '1fr', gap: 12, marginBottom: svc.showDescription ? 12 : 0 }}>
                                  {svc.showPrice && (
                                    <div className="edit-field-group">
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <label style={{ margin: 0 }}>Price ($ USD)</label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleServiceField(true, svc.id, 'price', false)}
                                          style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                          title="Remove price field"
                                        >
                                          ✕ Remove
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="form-input"
                                        placeholder="e.g. 49.00"
                                        value={svc.price}
                                        onChange={(e) => handleUpdateServiceItem(true, svc.id, 'price', e.target.value)}
                                      />
                                    </div>
                                  )}

                                  {svc.showDuration && (
                                    <div className="edit-field-group">
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <label style={{ margin: 0 }}>Duration (Minutes)</label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleServiceField(true, svc.id, 'duration', false)}
                                          style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                          title="Remove duration field"
                                        >
                                          ✕ Remove
                                        </button>
                                      </div>
                                      <input
                                        type="number"
                                        min="1"
                                        className="form-input"
                                        placeholder="e.g. 30"
                                        value={svc.duration_minutes}
                                        onChange={(e) => handleUpdateServiceItem(true, svc.id, 'duration_minutes', e.target.value)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CONDITIONALLY RENDERED DESCRIPTION */}
                              {svc.showDescription && (
                                <div className="edit-field-group">
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <label style={{ margin: 0 }}>Service Description</label>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleServiceField(true, svc.id, 'description', false)}
                                      style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                                      title="Remove description field"
                                    >
                                      ✕ Remove
                                    </button>
                                  </div>
                                  <textarea
                                    rows={2}
                                    className="form-textarea"
                                    placeholder="Short description of what the service covers..."
                                    value={svc.short_description}
                                    onChange={(e) => handleUpdateServiceItem(true, svc.id, 'short_description', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleAddServiceItem(true)}
                            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderStyle: 'dashed' }}
                          >
                            <Plus size={15} />
                            <span>Add Another Service</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editTab === 'voice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {!editingBiz.has_agent && (
                      <div className="notice warning" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '12px 16px', borderRadius: 8 }}>
                        <Sparkles size={18} color="#d97706" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: 13 }}>
                          <strong>AI Voice Agent Not Configured Yet:</strong>
                          <span style={{ marginLeft: 6 }}>
                            This business was registered without an active voice agent. Fill out the parameters below to configure and provision its live agent with Fish Audio tools and prompts.
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Bot size={16} color="#2563eb" />
                          Voice Agent Identity & Speech Profile
                        </h4>
                        <span className="badge badge-green">Fish Audio Runtime</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                        <div className="edit-field-group">
                          <label>Assigned Agent Name *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editingBiz.agent_name || ''}
                            onChange={(e) => setEditingBiz({ ...editingBiz, agent_name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="edit-field-group">
                          <label>Fish Audio Agent ID</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="agent_xxxxxxxxxxxx"
                            value={editingBiz.fish_agent_id || editingBiz.agent_id || ''}
                            onChange={(e) => setEditingBiz({ ...editingBiz, fish_agent_id: e.target.value, agent_id: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14, marginTop: 12 }}>
                        <div className="edit-field-group">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <label style={{ margin: 0 }}>Voice Model Profile</label>
                            <span className="badge-voice-default">Fish Audio</span>
                          </div>
                          <select
                            className="form-select"
                            value={editBizCustomVoice ? 'custom_public' : (editingBiz.voice_id || 'fish_audio_default')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom_public') {
                                setEditBizCustomVoice(true);
                                setEditingBiz((prev) => ({
                                  ...prev,
                                  voice_id: editBizCustomVoiceId.trim() || 'fish_audio_default',
                                  voice: editBizCustomVoiceId.trim() ? `Public Voice (${editBizCustomVoiceId.trim()})` : 'Custom Public Voice'
                                }));
                              } else {
                                setEditBizCustomVoice(false);
                                const profile = VOICE_PROFILES.find((p) => p.id === val);
                                setEditingBiz((prev) => ({
                                  ...prev,
                                  voice_id: val,
                                  voice: profile ? profile.name : 'Fish Audio Default'
                                }));
                              }
                            }}
                          >
                            <optgroup label="Default (Standard)">
                              <option value="fish_audio_default">Fish Audio Default (System Standard)</option>
                            </optgroup>
                            <optgroup label="Curated Fish Audio Voices">
                              <option value="serena_exec_en">Fish Audio - Serena (Executive English)</option>
                              <option value="marcus_conv_en">Fish Audio - Marcus (Conversational English)</option>
                              <option value="sophia_care_en">Fish Audio - Sophia (Warm Healthcare English)</option>
                              <option value="ravi_finance_te_en">Fish Audio - Ravi (Professional Multilingual)</option>
                            </optgroup>
                            <optgroup label="Public / Custom Voice Models">
                              <option value="custom_public">Public / Custom Voice Model ID...</option>
                            </optgroup>
                          </select>
                        </div>

                        <div className="edit-field-group">
                          <label>Language</label>
                          <select
                            className="form-select"
                            value={editingBiz.language || 'en'}
                            onChange={(e) => setEditingBiz({ ...editingBiz, language: e.target.value })}
                          >
                            <option value="en">English (EN)</option>
                            <option value="te">Telugu (TE)</option>
                            <option value="es">Spanish (ES)</option>
                          </select>
                        </div>

                        <div className="edit-field-group">
                          <label>Prompt Version Label</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="v1.0"
                            value={editingBiz.prompt_version || 'v1.0'}
                            onChange={(e) => setEditingBiz({ ...editingBiz, prompt_version: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* PUBLIC VOICE MODEL INPUT OR DEFAULT CALLOUT */}
                      {editBizCustomVoice ? (
                        <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                            Fish Audio Public Voice ID / Reference
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 7c32e189a456... or public voice reference name"
                            value={editBizCustomVoiceId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditBizCustomVoiceId(val);
                              setEditingBiz((prev) => ({
                                ...prev,
                                voice_id: val.trim() || 'fish_audio_default',
                                voice: val.trim() ? `Public Voice (${val.trim()})` : 'Fish Audio Default'
                              }));
                            }}
                          />
                          <small style={{ color: '#64748b', fontSize: 11.5, marginTop: 5, display: 'block' }}>
                            Paste the ID or reference tag from the Fish Audio public voice model directory. You can switch back to Fish Audio Default at any time.
                          </small>
                        </div>
                      ) : (
                        <div className="voice-profile-callout">
                          <Bot size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 12 }}>
                            <strong>Fish Audio Default is active.</strong> Standard neural voice synthesis configured. You can switch to any Fish Audio public voice profile anytime.
                          </span>
                        </div>
                      )}

                      {/* INTERACTIVE ROUTER TOOLS CHECKBOXES */}
                      {(() => {
                        const editTemplate = getBizTemplate(editingBiz);
                        const availableTools = editTemplate.tools || [];
                        return (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Attached Router Tools ({(editingBiz.attached_tools || []).length} / {availableTools.length} Active)
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={handleSelectAllEditTools}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 10.5, padding: '2px 8px' }}
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={handleClearAllEditTools}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 10.5, padding: '2px 8px' }}
                                >
                                  Clear All
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {availableTools.map((tool) => {
                                const isChecked = (editingBiz.attached_tools || []).includes(tool);
                                return (
                                  <label
                                    key={tool}
                                    className={`tool-checkbox-item ${isChecked ? 'checked' : ''}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleToggleEditTool(tool);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                    />
                                    <span>⚙️ {tool}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <small style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: 11 }}>
                              Enabled tools allow callers to query live database records and execute booking or intake actions.
                            </small>
                          </div>
                        );
                      })()}
                    </div>

                    {/* EDITABLE FIRST MESSAGE / GREETING */}
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Sparkles size={16} color="#eab308" />
                          First Message / Greeting (Pre-defined)
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={handleResetEditGreeting}
                            title="Reset greeting to template default"
                            style={{ color: '#475569' }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset Default</span>
                          </button>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(editingBiz.first_message, 'editGreeting')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedEditGreeting ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedEditGreeting ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="edit-field-group">
                        <textarea
                          rows={3}
                          className="form-textarea"
                          value={editingBiz.first_message || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, first_message: e.target.value })}
                          style={{ fontSize: 13, lineHeight: 1.5 }}
                        />
                        <small>Spoken immediately when a caller reaches the voice agent.</small>
                      </div>
                    </div>

                    {/* EDITABLE SYSTEM PROMPT (FISH AUDIO READY) */}
                    <div className="edit-section-card">
                      <div className="edit-section-header">
                        <h4>
                          <Code2 size={16} color="#2563eb" />
                          Pre-defined System Prompt (Fish Audio Ready)
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={handleResetEditPrompt}
                            title="Reset system prompt to template default"
                            style={{ color: '#475569' }}
                          >
                            <RotateCcw size={12} />
                            <span>Reset Default</span>
                          </button>
                          <button
                            type="button"
                            className="copy-badge-btn"
                            onClick={() => copyToClipboard(editingBiz.system_prompt, 'editPrompt')}
                            style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}
                          >
                            {copiedEditPrompt ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                            <span>{copiedEditPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="edit-field-group">
                        <textarea
                          rows={12}
                          className="prompt-editor-box"
                          value={editingBiz.system_prompt || ''}
                          onChange={(e) => setEditingBiz({ ...editingBiz, system_prompt: e.target.value })}
                        />
                        <small>
                          Customizable system prompt defining caller rules, data validation, and tool interaction behavior.
                        </small>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LOCKED MODAL FOOTER */}
              <div 
                className="modal-footer" 
                style={{ 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: 10, 
                  background: '#f8fafc', 
                  borderTop: '1.5px solid #e2e8f0',
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 30,
                  boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.05)'
                }}
              >
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
                  style={{ minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. DELETE CONFIRMATION DIALOG (CASCADE REMOVAL)              */}
      {/* ============================================================ */}
      {deletingBiz && (
        <div className="modal-overlay">
          <div className="edit-dialog" style={{ width: 480, maxWidth: '90vw' }} role="dialog" aria-modal="true">
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 10, 
                  background: '#dc2626', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#ffffff'
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
