import { NavLink } from 'react-router-dom';
import {
  BarChart3, Bell, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  CreditCard, Download, FileText, FolderOpen, Home, LayoutDashboard, Plus,
  ScrollText, Send, Settings, ShieldCheck, UserCog, Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { RicohMark, RicohWordmark } from '../shared/RicohLogo';

const ICON_SIZE = 15;

const ORIGINATOR_NAV = [
  {
    sectionKey: 'sidebar.overview',
    items: [
      { to: '/portfolio', icon: <LayoutDashboard size={ICON_SIZE} />, labelKey: 'sidebar.portfolio' },
      { to: '/portfolio/export', icon: <Download size={ICON_SIZE} />, labelKey: 'sidebar.exportData' },
    ],
  },
  {
    sectionKey: 'sidebar.dealsSection',
    items: [
      { to: '/deals', icon: <Send size={ICON_SIZE} />, labelKey: 'sidebar.myDeals' },
      { to: '/deals/new', icon: <Plus size={ICON_SIZE} />, labelKey: 'sidebar.newDeal' },
      { to: '/quotes', icon: <FileText size={ICON_SIZE} />, labelKey: 'sidebar.quotes' },
    ],
  },
  {
    sectionKey: 'sidebar.crmSection',
    items: [
      { to: '/crm', icon: <Users size={ICON_SIZE} />, labelKey: 'sidebar.prospects' },
    ],
  },
  {
    sectionKey: 'sidebar.account',
    items: [
      { to: '/notifications', icon: <Bell size={ICON_SIZE} />, labelKey: 'common.notifications' },
      { to: '/settings', icon: <Settings size={ICON_SIZE} />, labelKey: 'common.settings' },
    ],
  },
];

const ADMIN_NAV = [
  {
    sectionKey: 'sidebar.overview',
    items: [
      { to: '/admin', icon: <BarChart3 size={ICON_SIZE} />, labelKey: 'sidebar.dashboard' },
    ],
  },
  {
    sectionKey: 'sidebar.queues',
    items: [
      { to: '/admin/review', icon: <ClipboardCheck size={ICON_SIZE} />, labelKey: 'sidebar.applications' },
      { to: '/admin/deals', icon: <Send size={ICON_SIZE} />, labelKey: 'sidebar.dealQueue' },
    ],
  },
  {
    sectionKey: 'sidebar.system',
    items: [
      { to: '/admin/users', icon: <UserCog size={ICON_SIZE} />, labelKey: 'sidebar.userManagement' },
      { to: '/admin/audit', icon: <ScrollText size={ICON_SIZE} />, labelKey: 'sidebar.auditLog' },
      { to: '/settings', icon: <Settings size={ICON_SIZE} />, labelKey: 'common.settings' },
    ],
  },
];

const CUSTOMER_NAV = [
  {
    sectionKey: 'sidebar.myAccount',
    items: [
      { to: '/portal/dashboard', icon: <Home size={ICON_SIZE} />, labelKey: 'sidebar.dashboard' },
      { to: '/portal/account', icon: <CreditCard size={ICON_SIZE} />, labelKey: 'sidebar.accountActions' },
      { to: '/portal/notifications', icon: <Bell size={ICON_SIZE} />, labelKey: 'common.notifications' },
      { to: '/settings', icon: <Settings size={ICON_SIZE} />, labelKey: 'common.settings' },
    ],
  },
];

const ONBOARDING_NAV = [
  {
    sectionKey: 'sidebar.onboarding',
    items: [
      { to: '/onboarding/registration', icon: <ClipboardList size={ICON_SIZE} />, labelKey: 'sidebar.registration' },
      { to: '/onboarding/documents', icon: <FolderOpen size={ICON_SIZE} />, labelKey: 'sidebar.documents' },
      { to: '/onboarding/verification', icon: <ShieldCheck size={ICON_SIZE} />, labelKey: 'sidebar.verification' },
    ],
  },
];

export default function LeftNav({ collapsed, navOpen, onToggle, onClose }) {
  const { profile, isAdmin, isOriginator, isCustomer, isApproved } = useAuth();
  const { t } = useLocale();

  let navSections;
  if (isAdmin) navSections = ADMIN_NAV;
  else if (isCustomer) navSections = CUSTOMER_NAV;
  else if (isOriginator && isApproved) navSections = ORIGINATOR_NAV;
  else if (isOriginator) navSections = ONBOARDING_NAV;
  else navSections = [];

  const initials = profile?.avatar_initials || profile?.full_name?.[0] || '?';
  const navClass = ['leftnav', collapsed ? 'leftnav-collapsed' : '', navOpen ? 'nav-mobile-open' : ''].filter(Boolean).join(' ');

  return (
    <div className={navClass}>
      <div className="leftnav-logo">
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          {collapsed ? <RicohMark size={26} /> : <RicohWordmark size={28} gap={9} fontSize={14} />}
        </div>
        <button onClick={onToggle} className="nav-collapse-btn desktop-only" title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <button onClick={onClose} className="nav-collapse-btn mobile-only" title={t('sidebar.closeMenu')} style={{ display: 'none' }}>
          <ChevronLeft size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        {navSections.map((section) => (
          <div key={section.sectionKey} className="nav-section">
            {!collapsed && <div className="nav-section-label">{t(section.sectionKey)}</div>}
            {collapsed && <div style={{ height: 8 }} />}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={['/portfolio', '/crm', '/portal/dashboard'].includes(item.to)}
                className={({ isActive }) => `nav-item${collapsed ? ' nav-item-collapsed' : ''}${isActive ? ' active' : ''}`}
                title={collapsed ? t(item.labelKey) : undefined}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span>{t(item.labelKey)}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {collapsed ? (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--bdr)', display: 'flex', justifyContent: 'center' }} title={profile?.full_name || profile?.email}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--coral-l)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
            {initials}
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bdr)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--coral-l)', color: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, color: 'var(--tx2)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || '-'}
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
