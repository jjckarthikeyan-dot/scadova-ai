import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Link2,
  Menu,
  PhoneCall,
  Target,
  PanelLeftClose,
  AudioLines,
  Settings,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

const navSections = [
  {
    title: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/businesses', icon: Building2, label: 'Businesses' },
      { to: '/agents', icon: Bot, label: 'Voice Agents' },
      { to: '/calls', icon: PhoneCall, label: 'Calls' },
      { to: '/appointments', icon: CalendarDays, label: 'Appointments' },
      { to: '/leads', icon: Target, label: 'Leads' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/integrations', icon: Link2, label: 'Integrations' },
      { to: '/fish-audio', icon: AudioLines, label: 'Fish Audio' },
      { to: '/api-explorer', icon: Zap, label: 'API Explorer' },
      { to: '/usage', icon: BarChart3, label: 'Usage & Credits' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/prompts', icon: BookOpenCheck, label: 'Rules' },
      { to: '/logs', icon: ClipboardList, label: 'System Logs' },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon" aria-hidden="true">
            <AudioLines size={22} />
          </div>
          <div className="sidebar-title">
            <span>Scadova AI</span>
            <span className="sidebar-title-badge">Control</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-burger"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navSections.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-group-title">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <div className="nav-link-content">
                    <span className="nav-link-icon">
                      <Icon size={18} strokeWidth={2.1} />
                    </span>
                    <span className="nav-link-label">{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status-pill">
          
          <span>Voice workspace</span>
        </div>
        <NavLink className="sidebar-settings-link" to="/integrations" title="Settings">
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
