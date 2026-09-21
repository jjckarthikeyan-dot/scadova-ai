import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OnboardingModal from './components/OnboardingModal';

import DashboardPage from './pages/DashboardPage';
import BusinessesPage from './pages/BusinessesPage';
import AgentsPage from './pages/AgentsPage';
import CallsPage from './pages/CallsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import LeadsPage from './pages/LeadsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import FishAudioPage from './pages/FishAudioPage';
import ApiExplorerPage from './pages/ApiExplorerPage';
import PromptsPage from './pages/PromptsPage';
import UsagePage from './pages/UsagePage';
import LogsPage from './pages/LogsPage';

const pageTitles = {
  '/': { title: 'Platform Dashboard', subtitle: 'Executive overview & voice operations' },
  '/businesses': { title: 'Businesses', subtitle: 'Manage registered businesses & routers' },
  '/agents': { title: 'Voice Agents', subtitle: 'Local agents, tools, and usage controls' },
  '/calls': { title: 'Call Telemetry', subtitle: 'Historical snapshots, audio & transcripts' },
  '/appointments': { title: 'Appointments', subtitle: 'Schedule & manage consultations' },
  '/leads': { title: 'Inquiries & Leads', subtitle: 'Qualified customer & loan requests' },
  '/integrations': { title: 'Integrations', subtitle: 'Telephony, calendar, & webhook connections' },
  '/fish-audio': { title: 'Fish Audio', subtitle: 'Provider agents, knowledge sync, tracking & analysis' },
  '/api-explorer': { title: 'API Explorer', subtitle: 'Interactive OpenAPI router tools' },
  '/prompts': { title: 'Conversation Rules', subtitle: 'Audit and compare saved rule sets' },
  '/usage': { title: 'Usage & Credits', subtitle: 'Agent minutes, balances and Fish Audio sessions' },
  '/logs': { title: 'System Logs', subtitle: 'Runtime events & audit trail' },
};

function AppLayout() {
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] || { title: 'Scadova AI', subtitle: 'Voice Platform' };
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingConfig, setOnboardingConfig] = useState({});

  const handleOpenOnboarding = (opts = {}) => {
    setOnboardingConfig(opts || {});
    setOnboardingOpen(true);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onOpenOnboarding={() => handleOpenOnboarding({ mode: 'agent' })}
        />
        <main className="content-canvas">
          <Routes>
            <Route path="/" element={<DashboardPage onOpenOnboarding={() => handleOpenOnboarding({ mode: 'agent' })} />} />
            <Route path="/businesses" element={<BusinessesPage onOpenOnboarding={(opts) => handleOpenOnboarding({ mode: 'business', ...opts })} />} />
            <Route path="/agents" element={<AgentsPage onOpenOnboarding={(opts) => handleOpenOnboarding({ mode: 'agent', ...opts })} />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/fish-audio" element={<FishAudioPage />} />
            <Route path="/api-explorer" element={<ApiExplorerPage />} />
            <Route path="/prompts" element={<PromptsPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>

      {/* GLOBAL ONBOARDING & FISH AUDIO AGENT WIZARD */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          setOnboardingConfig({});
        }}
        onCreated={() => {}}
        mode={onboardingConfig.mode || 'agent'}
        initialBusinessId={onboardingConfig.businessId || null}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
