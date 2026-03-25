import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const BREADCRUMBS = {
  '/portfolio':                ['Portfolio'],
  '/portfolio/:id':            ['Portfolio', 'Contract detail'],
  '/deals/new':                ['Deals', 'New deal'],
  '/deals/assets':             ['Deals', 'Asset details'],
  '/deals/review':             ['Deals', 'Review & submit'],
  '/deals/confirmation':       ['Deals', 'Confirmation'],
  '/crm':                      ['CRM', 'Prospects'],
  '/crm/:id':                  ['CRM', 'Prospect profile'],
  '/quotes':                   ['Quotes'],
  '/quotes/new':               ['Quotes', 'New quote'],
  '/quotes/:id':               ['Quotes', 'Quote output'],
  '/onboarding/registration':  ['Onboarding', 'Registration'],
  '/onboarding/documents':     ['Onboarding', 'Documents'],
  '/onboarding/verification':  ['Onboarding', 'Verification'],
  '/onboarding/welcome':       ['Onboarding', 'Welcome'],
  '/admin':                    ['Admin', 'Dashboard'],
  '/admin/review':             ['Admin', 'Applications'],
  '/admin/deals':              ['Admin', 'Deal queue'],
  '/admin/audit':              ['Admin', 'Audit log'],
  '/portal/dashboard':         ['Customer portal'],
  '/portal/contracts/:id':     ['Customer portal', 'Contract detail'],
  '/portal/account':           ['Customer portal', 'Account actions'],
  '/portal/notifications':     ['Notifications'],
  '/notifications':            ['Notifications'],
  '/deals':                    ['Deals', 'My deals'],
  '/deals/:id':                ['Deals', 'Deal detail'],
  '/portfolio/export':         ['Portfolio', 'Export data'],
  '/crm/:id/convert':          ['CRM', 'Convert to deal'],
  '/settings':                 ['Settings'],
};

const ROLE_BADGES = {
  originator: { label: 'Originator', color: 'var(--coral)',   bg: 'var(--coral-l)',  border: 'var(--coral-m)' },
  admin:      { label: 'Admin',      color: '#5C3FA0',        bg: '#F0EAFF',         border: '#C5AEED' },
  customer:   { label: 'Customer',   color: 'var(--green-d)', bg: 'var(--green-l)',  border: 'var(--green-m)' },
};

function getBreadcrumbs(pathname) {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  for (const pattern of Object.keys(BREADCRUMBS)) {
    if (pattern.includes(':')) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(pathname)) return BREADCRUMBS[pattern];
    }
  }
  return ['Dashboard'];
}

export default function TopNav({ onMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  const crumbs = getBreadcrumbs(location.pathname);
  const roleMeta = profile?.role ? ROLE_BADGES[profile.role] : null;
  const notifPath = profile?.role === 'customer' ? '/portal/notifications' : '/notifications';
  const initials = profile?.avatar_initials || profile?.full_name?.[0]?.toUpperCase() || '?';

  return (
    <div className="topnav">
      {/* Hamburger — mobile only */}
      <button
        className="btn btn-ghost mobile-only"
        style={{ padding: '6px 8px', border: 'none', flexShrink: 0 }}
        onClick={onMenuToggle}
        aria-label="Open menu"
      >
        <Menu size={18} style={{ color: 'var(--tx2)' }} />
      </button>

      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--bdrm)', flexShrink: 0 }} />}
            <span className={i === crumbs.length - 1 ? 'breadcrumb-active' : 'breadcrumb-link'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right side */}
      <div className="topnav-right">
        {roleMeta && (
          <div className="mode-badge" style={{
            background: roleMeta.bg,
            color: roleMeta.color,
            border: `1px solid ${roleMeta.border}`,
          }}>
            {roleMeta.label}
          </div>
        )}

        {/* Notification bell */}
        <button
          className="btn btn-ghost"
          style={{ position: 'relative', padding: '6px 8px', border: 'none' }}
          onClick={() => navigate(notifPath)}
          title="Notifications"
        >
          <Bell size={17} style={{ color: 'var(--tx3)' }} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 1, right: 1,
              background: 'var(--coral)', color: '#fff',
              fontSize: 8, fontWeight: 700, borderRadius: '50%',
              width: 14, height: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, background: 'var(--coral)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{profile?.full_name || 'User'}</div>
            <button
              onClick={signOut}
              style={{
                all: 'unset', fontSize: 10, color: 'var(--tx4)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <LogOut size={9} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
