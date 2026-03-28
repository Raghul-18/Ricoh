import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useLocale } from '../../context/LocaleContext';

const BREADCRUMBS = {
  '/portfolio': ['breadcrumb.portfolio'],
  '/portfolio/:id': ['breadcrumb.portfolio', 'breadcrumb.contractDetail'],
  '/deals/new': ['breadcrumb.deals', 'breadcrumb.newDeal'],
  '/deals/assets': ['breadcrumb.deals', 'breadcrumb.assetDetails'],
  '/deals/review': ['breadcrumb.deals', 'breadcrumb.reviewSubmit'],
  '/deals/confirmation': ['breadcrumb.deals', 'breadcrumb.confirmation'],
  '/crm': ['breadcrumb.crm', 'breadcrumb.prospects'],
  '/crm/:id': ['breadcrumb.crm', 'breadcrumb.prospectProfile'],
  '/quotes': ['breadcrumb.quotes'],
  '/quotes/new': ['breadcrumb.quotes', 'breadcrumb.newQuote'],
  '/quotes/:id': ['breadcrumb.quotes', 'breadcrumb.quoteOutput'],
  '/onboarding/registration': ['breadcrumb.onboarding', 'breadcrumb.registration'],
  '/onboarding/documents': ['breadcrumb.onboarding', 'breadcrumb.documents'],
  '/onboarding/verification': ['breadcrumb.onboarding', 'breadcrumb.verification'],
  '/onboarding/welcome': ['breadcrumb.onboarding', 'breadcrumb.welcome'],
  '/admin': ['breadcrumb.admin', 'breadcrumb.dashboard'],
  '/admin/review': ['breadcrumb.admin', 'breadcrumb.applications'],
  '/admin/deals': ['breadcrumb.admin', 'breadcrumb.dealQueue'],
  '/admin/audit': ['breadcrumb.admin', 'breadcrumb.auditLog'],
  '/portal/dashboard': ['breadcrumb.customerPortal'],
  '/portal/contracts/:id': ['breadcrumb.customerPortal', 'breadcrumb.contractDetail'],
  '/portal/account': ['breadcrumb.customerPortal', 'breadcrumb.accountActions'],
  '/portal/notifications': ['common.notifications'],
  '/notifications': ['common.notifications'],
  '/deals': ['breadcrumb.deals', 'sidebar.myDeals'],
  '/deals/:id': ['breadcrumb.deals', 'breadcrumb.dealDetail'],
  '/portfolio/export': ['breadcrumb.portfolio', 'sidebar.exportData'],
  '/crm/:id/convert': ['breadcrumb.crm', 'breadcrumb.convertToDeal'],
  '/settings': ['common.settings'],
};

const ROLE_BADGES = {
  originator: { labelKey: 'nav.roleOriginator', color: 'var(--coral)', bg: 'var(--coral-l)', border: 'var(--coral-m)' },
  admin: { labelKey: 'nav.roleAdmin', color: '#5C3FA0', bg: '#F0EAFF', border: '#C5AEED' },
  customer: { labelKey: 'nav.roleCustomer', color: 'var(--green-d)', bg: 'var(--green-l)', border: 'var(--green-m)' },
};

function getBreadcrumbs(pathname) {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  for (const pattern of Object.keys(BREADCRUMBS)) {
    if (!pattern.includes(':')) continue;
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    if (regex.test(pathname)) return BREADCRUMBS[pattern];
  }
  return ['breadcrumb.dashboard'];
}

export default function TopNav({ onMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const { locale, primaryCurrency, supportedLocales, setPreferences, t } = useLocale();

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const crumbs = getBreadcrumbs(location.pathname);
  const roleMeta = profile?.role ? ROLE_BADGES[profile.role] : null;
  const notifPath = profile?.role === 'customer' ? '/portal/notifications' : '/notifications';
  const initials = profile?.avatar_initials || profile?.full_name?.[0]?.toUpperCase() || '?';
  const currentConfig = supportedLocales.find((entry) => entry.locale === locale) || supportedLocales[0];
  const currencyOptions = [...new Set(supportedLocales.map((entry) => entry.currency))];

  return (
    <div className="topnav">
      <button
        className="btn btn-ghost mobile-only"
        style={{ padding: '6px 8px', border: 'none', flexShrink: 0 }}
        onClick={onMenuToggle}
        aria-label={t('sidebar.expand')}
      >
        <Menu size={18} style={{ color: 'var(--tx2)' }} />
      </button>

      <div className="breadcrumbs">
        {crumbs.map((crumb, index) => (
          <span key={crumb + index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {index > 0 && <ChevronRight size={12} style={{ color: 'var(--bdrm)', flexShrink: 0 }} />}
            <span className={index === crumbs.length - 1 ? 'breadcrumb-active' : 'breadcrumb-link'}>
              {t(crumb)}
            </span>
          </span>
        ))}
      </div>

      <div className="topnav-right">
        {roleMeta && (
          <div className="mode-badge" style={{ background: roleMeta.bg, color: roleMeta.color, border: `1px solid ${roleMeta.border}` }}>
            {t(roleMeta.labelKey)}
          </div>
        )}

        <select
          className="form-input"
          style={{ width: 150, height: 34, fontSize: 12 }}
          value={locale}
          onChange={(event) => {
            const next = supportedLocales.find((entry) => entry.locale === event.target.value) || currentConfig;
            setPreferences({ locale: next.locale, language: next.language, currency: next.currency });
          }}
          aria-label={t('common.language')}
        >
          {supportedLocales.map((entry) => (
            <option key={entry.locale} value={entry.locale}>{entry.label}</option>
          ))}
        </select>

        <select
          className="form-input"
          style={{ width: 100, height: 34, fontSize: 12 }}
          value={primaryCurrency}
          onChange={(event) => setPreferences({ locale, language: currentConfig.language, currency: event.target.value })}
          aria-label={t('common.currency')}
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>

        <button
          className="btn btn-ghost"
          style={{ position: 'relative', padding: '6px 8px', border: 'none' }}
          onClick={() => navigate(notifPath)}
          title={t('common.notifications')}
        >
          <Bell size={17} style={{ color: 'var(--tx3)' }} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 1,
                right: 1,
                background: 'var(--coral)',
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                borderRadius: '50%',
                width: 14,
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: 'var(--coral)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{profile?.full_name || t('common.user')}</div>
            <button
              onClick={signOut}
              style={{
                all: 'unset',
                fontSize: 10,
                color: 'var(--tx4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <LogOut size={9} /> {t('common.signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
