import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Plus, FileText, Users, Bell,
  ClipboardList, FolderOpen, ShieldCheck,
  ClipboardCheck, ScrollText, Home, Send,
  Settings, Download, BarChart3, CreditCard, UserCog,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ZoroWordmark, ZoroMark } from '../shared/ZoroLogo';

const ICON_SIZE = 15;

const ORIGINATOR_NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/portfolio',        icon: <LayoutDashboard size={ICON_SIZE} />, label: 'Portfolio' },
      { to: '/portfolio/export', icon: <Download size={ICON_SIZE} />,        label: 'Export data' },
    ],
  },
  {
    section: 'Deals',
    items: [
      { to: '/deals',     icon: <Send size={ICON_SIZE} />,      label: 'My deals' },
      { to: '/deals/new', icon: <Plus size={ICON_SIZE} />,      label: 'New deal' },
      { to: '/quotes',    icon: <FileText size={ICON_SIZE} />,  label: 'Quotes' },
    ],
  },
  {
    section: 'CRM',
    items: [
      { to: '/crm', icon: <Users size={ICON_SIZE} />, label: 'Prospects' },
    ],
  },
  {
    section: 'Account',
    items: [
      { to: '/notifications', icon: <Bell size={ICON_SIZE} />,     label: 'Notifications' },
      { to: '/settings',      icon: <Settings size={ICON_SIZE} />, label: 'Settings' },
    ],
  },
];

const ADMIN_NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/admin', icon: <BarChart3 size={ICON_SIZE} />, label: 'Dashboard' },
    ],
  },
  {
    section: 'Queues',
    items: [
      { to: '/admin/review', icon: <ClipboardCheck size={ICON_SIZE} />, label: 'Applications' },
      { to: '/admin/deals',  icon: <Send size={ICON_SIZE} />,           label: 'Deal queue' },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/admin/users',  icon: <UserCog size={ICON_SIZE} />,    label: 'User management' },
      { to: '/admin/audit',  icon: <ScrollText size={ICON_SIZE} />, label: 'Audit log' },
      { to: '/settings',     icon: <Settings size={ICON_SIZE} />,   label: 'Settings' },
    ],
  },
];

const CUSTOMER_NAV = [
  {
    section: 'My account',
    items: [
      { to: '/portal/dashboard',     icon: <Home size={ICON_SIZE} />,       label: 'Dashboard' },
      { to: '/portal/account',       icon: <CreditCard size={ICON_SIZE} />, label: 'Account actions' },
      { to: '/portal/notifications', icon: <Bell size={ICON_SIZE} />,       label: 'Notifications' },
      { to: '/settings',             icon: <Settings size={ICON_SIZE} />,   label: 'Settings' },
    ],
  },
];

const ONBOARDING_NAV = [
  {
    section: 'Onboarding',
    items: [
      { to: '/onboarding/registration', icon: <ClipboardList size={ICON_SIZE} />, label: 'Registration' },
      { to: '/onboarding/documents',    icon: <FolderOpen size={ICON_SIZE} />,    label: 'Documents' },
      { to: '/onboarding/verification', icon: <ShieldCheck size={ICON_SIZE} />,   label: 'Verification' },
    ],
  },
];

export default function LeftNav({ collapsed, navOpen, onToggle, onClose }) {
  const { profile, isAdmin, isOriginator, isCustomer, isApproved } = useAuth();

  let navSections;
  if (isAdmin)                         navSections = ADMIN_NAV;
  else if (isCustomer)                 navSections = CUSTOMER_NAV;
  else if (isOriginator && isApproved) navSections = ORIGINATOR_NAV;
  else if (isOriginator)               navSections = ONBOARDING_NAV;
  else                                 navSections = [];

  const initials = profile?.avatar_initials || profile?.full_name?.[0] || '?';

  const navClass = [
    'leftnav',
    collapsed ? 'leftnav-collapsed' : '',
    navOpen   ? 'nav-mobile-open'   : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={navClass}>

      {/* Logo + toggle */}
      <div className="leftnav-logo">
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          {collapsed
            ? <ZoroMark size={26} />
            : <ZoroWordmark size={28} gap={9} fontSize={14} />
          }
        </div>
        {/* Desktop collapse button — hidden on mobile via CSS */}
        <button
          onClick={onToggle}
          className="nav-collapse-btn desktop-only"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {/* Mobile close button — hidden on desktop via CSS */}
        <button
          onClick={onClose}
          className="nav-collapse-btn mobile-only"
          title="Close menu"
          style={{ display: 'none' }}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {navSections.map(section => (
          <div key={section.section} className="nav-section">
            {!collapsed && (
              <div className="nav-section-label">{section.section}</div>
            )}
            {collapsed && <div style={{ height: 8 }} />}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={['/portfolio', '/crm', '/portal/dashboard'].includes(item.to)}
                className={({ isActive }) => `nav-item${collapsed ? ' nav-item-collapsed' : ''}${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* User info */}
      {collapsed ? (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--bdr)', display: 'flex', justifyContent: 'center' }} title={profile?.full_name || profile?.email}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--coral-l)', color: 'var(--coral)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>
            {initials}
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bdr)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'var(--coral-l)', color: 'var(--coral)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, color: 'var(--tx2)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || '—'}
            </div>
            <div style={{ color: 'var(--tx4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.company_name || profile?.email}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
