import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardList, Send, TrendingUp,
  CheckCircle, AlertCircle, BarChart3, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/backendClient';
import { keys } from '../../lib/queryClient';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import { convertWithRate, useFxRate } from '../../hooks/useFx';

function useAdminStats() {
  return useQuery({
    queryKey: keys.adminStats(),
    queryFn: async () => {
      const [apps, deals, contracts, originators] = await Promise.all([
        db.applications().select('status').neq('status', 'draft'),
        db.deals().select('status').neq('status', 'draft'),
        db.contracts().select('status, deal_id, asset_value, monthly_payment'),
        db.profiles().select('id').eq('role', 'originator').eq('onboarding_status', 'approved'),
      ]);
      if (apps.error || deals.error || contracts.error || originators.error) {
        throw apps.error || deals.error || contracts.error || originators.error;
      }

      const appData = apps.data || [];
      const dealData = deals.data || [];
      const contractData = contracts.data || [];
      const dealIds = [...new Set(contractData.map((contract) => contract.deal_id).filter(Boolean))];
      const dealResult = dealIds.length
        ? await db.deals().select('*').in('id', dealIds)
        : { data: [], error: null };
      if (dealResult.error) throw dealResult.error;
      const dealsById = Object.fromEntries((dealResult.data || []).map((deal) => [deal.id, deal]));

      const activeContracts = contractData.filter((item) => item.status === 'active');
      const reportingPortfolioValue = activeContracts.reduce((sum, item) => {
        const linkedDeal = dealsById[item.deal_id];
        const originalCurrency = linkedDeal?.original_currency_code || 'GBP';
        const reportingCurrencyCode = linkedDeal?.reporting_currency_code || (originalCurrency === 'GBP' ? 'GBP' : null);
        if (Number.isFinite(Number(linkedDeal?.reporting_asset_value))) return sum + Number(linkedDeal.reporting_asset_value);
        if (reportingCurrencyCode === 'GBP' || originalCurrency === 'GBP') return sum + Number(item.asset_value || 0);
        return sum;
      }, 0);
      const reportingMonthlyBook = activeContracts.reduce((sum, item) => {
        const linkedDeal = dealsById[item.deal_id];
        const originalCurrency = linkedDeal?.original_currency_code || 'GBP';
        const reportingCurrencyCode = linkedDeal?.reporting_currency_code || (originalCurrency === 'GBP' ? 'GBP' : null);
        if (Number.isFinite(Number(linkedDeal?.reporting_monthly_payment))) return sum + Number(linkedDeal.reporting_monthly_payment);
        if (reportingCurrencyCode === 'GBP' || originalCurrency === 'GBP') return sum + Number(item.monthly_payment || 0);
        return sum;
      }, 0);

      return {
        pendingApplications: appData.filter((item) => ['submitted', 'under_review'].includes(item.status)).length,
        approvedApplications: appData.filter((item) => item.status === 'approved').length,
        dealsAwaitingReview: dealData.filter((item) => ['submitted', 'under_review'].includes(item.status)).length,
        dealsApproved: dealData.filter((item) => item.status === 'approved').length,
        activeContracts: activeContracts.length,
        reportingPortfolioValue,
        reportingMonthlyBook,
        approvedOriginators: originators.data?.length || 0,
      };
    },
    staleTime: 1000 * 60,
  });
}

function useRecentActivity() {
  return useQuery({
    queryKey: ['admin', 'recent-activity'],
    queryFn: async () => {
      const [recentDeals, recentApps] = await Promise.all([
        db.deals().select('*').in('status', ['submitted', 'under_review']).order('created_at', { ascending: false }),
        db.applications().select('*').in('status', ['submitted', 'under_review']).order('created_at', { ascending: false }),
      ]);
      if (recentDeals.error || recentApps.error) {
        throw recentDeals.error || recentApps.error;
      }

      const deals = (recentDeals.data || []).slice(0, 5);
      const apps = (recentApps.data || []).slice(0, 5);
      const originatorIds = [...new Set(deals.map((deal) => deal.originator_id).filter(Boolean))];
      const appUserIds = [...new Set(apps.map((app) => app.user_id).filter(Boolean))];
      const profileIds = [...new Set([...originatorIds, ...appUserIds])];

      const profilesResult = profileIds.length
        ? await db.profiles().select('*').in('id', profileIds)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;

      const profilesById = Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile]));

      return {
        recentDeals: deals.map((deal) => ({ ...deal, originator: profilesById[deal.originator_id] || null })),
        recentApps: apps.map((app) => ({ ...app, profiles: profilesById[app.user_id] || null })),
      };
    },
    staleTime: 1000 * 60,
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { primaryCurrency, reportingCurrency, formatCurrency, formatDate, t } = useLocale();
  const { data: fx } = useFxRate(reportingCurrency, primaryCurrency);
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats();
  const { data: activity, isLoading: activityLoading, error: activityError } = useRecentActivity();

  const portfolioValue = primaryCurrency === reportingCurrency
    ? stats?.reportingPortfolioValue
    : convertWithRate(stats?.reportingPortfolioValue, fx?.rate);
  const monthlyBook = primaryCurrency === reportingCurrency
    ? stats?.reportingMonthlyBook
    : convertWithRate(stats?.reportingMonthlyBook, fx?.rate);

  const kpis = [
    { label: t('admin.approvedOriginators'), value: stats?.approvedOriginators ?? '-', icon: <Users size={18} />, color: 'var(--blue)', action: null },
    { label: t('admin.pendingApplications'), value: stats?.pendingApplications ?? '-', icon: <ClipboardList size={18} />, color: stats?.pendingApplications > 0 ? 'var(--amber)' : 'var(--green)', action: '/admin/review' },
    { label: t('admin.dealsAwaitingDecision'), value: stats?.dealsAwaitingReview ?? '-', icon: <Send size={18} />, color: stats?.dealsAwaitingReview > 0 ? 'var(--coral)' : 'var(--green)', action: '/admin/deals' },
    { label: t('admin.activeContracts'), value: stats?.activeContracts ?? '-', icon: <CheckCircle size={18} />, color: 'var(--green)', action: null },
    { label: t('admin.totalPortfolio'), value: Number.isFinite(portfolioValue) ? formatCurrency(portfolioValue, primaryCurrency) : '-', icon: <TrendingUp size={18} />, color: 'var(--coral)', action: null },
    { label: t('admin.monthlyBook'), value: Number.isFinite(monthlyBook) ? formatCurrency(monthlyBook, primaryCurrency) : '-', icon: <BarChart3 size={18} />, color: 'var(--blue)', action: null },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('admin.title')}</div>
          <div className="page-sub">{t('admin.subtitle')}</div>
        </div>
      </div>

      {statsError && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--red)', fontSize: 13 }}>
          {statsError.message}
        </div>
      )}

      <div className="three-col" style={{ marginBottom: 24 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="metric-card"
            style={{ cursor: kpi.action ? 'pointer' : 'default' }}
            onClick={() => kpi.action && navigate(kpi.action)}
          >
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>
              {statsLoading ? <LoadingSpinner size={18} /> : kpi.value}
            </div>
            <div className="metric-label">{kpi.label}</div>
            {kpi.action && <div style={{ fontSize: 9, color: 'var(--tx4)', marginTop: 6 }}>{t('admin.clickToView')}</div>}
          </div>
        ))}
      </div>

      <div className="two-col-equal">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('admin.dealsPendingDecision')}</div>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/admin/deals')}>
              {t('admin.viewAll')} <ChevronRight size={12} />
            </button>
          </div>
          {activityLoading ? (
            <div style={{ textAlign: 'center', padding: 16 }}><LoadingSpinner size={20} /></div>
          ) : activityError ? (
            <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', padding: '16px 0' }}>{activityError.message}</div>
          ) : activity?.recentDeals.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '16px 0' }}>{t('admin.noDealsAwaitingReview')}</div>
          ) : (
            activity?.recentDeals.map((deal, index) => (
              <div
                key={deal.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: index < activity.recentDeals.length - 1 ? '1px solid var(--bdr)' : 'none', cursor: 'pointer' }}
                onClick={() => navigate('/admin/deals')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: deal.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.customer_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>
                    {deal.originator?.company_name} - {deal.reference_number}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: deal.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', background: deal.status === 'under_review' ? 'var(--amber-l)' : 'var(--blue-l)', borderRadius: 99, padding: '2px 7px' }}>
                  {deal.status === 'under_review' ? t('common.inReview') : t('admin.new')}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('admin.originatorApplications')}</div>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/admin/review')}>
              {t('admin.viewAll')} <ChevronRight size={12} />
            </button>
          </div>
          {activityLoading ? (
            <div style={{ textAlign: 'center', padding: 16 }}><LoadingSpinner size={20} /></div>
          ) : activityError ? (
            <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', padding: '16px 0' }}>{activityError.message}</div>
          ) : activity?.recentApps.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '16px 0' }}>{t('admin.noPendingApplications')}</div>
          ) : (
            activity?.recentApps.map((application, index) => (
              <div
                key={application.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: index < activity.recentApps.length - 1 ? '1px solid var(--bdr)' : 'none', cursor: 'pointer' }}
                onClick={() => navigate('/admin/review')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: application.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {application.profiles?.company_name || application.profiles?.full_name || '-'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>
                    {formatDate(application.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: application.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', background: application.status === 'under_review' ? 'var(--amber-l)' : 'var(--blue-l)', borderRadius: 99, padding: '2px 7px' }}>
                  {application.status === 'under_review' ? t('common.inReview') : t('admin.new')}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{t('admin.quickActions')}</div>
          {[
            { icon: <Send size={14} />, label: t('admin.reviewDealQueue'), sub: t('admin.pendingCount', { count: stats?.dealsAwaitingReview ?? 0 }), to: '/admin/deals', color: 'var(--coral)' },
            { icon: <ClipboardList size={14} />, label: t('admin.reviewApplications'), sub: t('admin.pendingCount', { count: stats?.pendingApplications ?? 0 }), to: '/admin/review', color: 'var(--blue)' },
            { icon: <AlertCircle size={14} />, label: t('admin.auditLog'), sub: t('admin.auditSub'), to: '/admin/audit', color: 'var(--tx3)' },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--bdr)', cursor: 'pointer' }}
              onClick={() => navigate(item.to)}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>{item.sub}</div>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--tx4)' }} />
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{t('admin.platformSummary')}</div>
          {[
            [t('admin.approvedOriginators'), stats?.approvedOriginators, 'var(--green)'],
            [t('admin.pendingApplications'), stats?.pendingApplications, stats?.pendingApplications > 0 ? 'var(--amber)' : 'var(--green)'],
            [t('admin.dealsInPipeline'), stats?.dealsAwaitingReview, stats?.dealsAwaitingReview > 0 ? 'var(--coral)' : 'var(--green)'],
            [t('admin.approvedDealsTotal'), stats?.dealsApproved, 'var(--blue)'],
            [t('admin.activeContracts'), stats?.activeContracts, 'var(--green)'],
            [t('admin.monthlyBookValue'), Number.isFinite(monthlyBook) ? formatCurrency(monthlyBook, primaryCurrency) : '-', 'var(--coral)'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--bdr)', marginBottom: 8 }}>
              <span style={{ color: 'var(--tx3)' }}>{label}</span>
              <span style={{ fontWeight: 700, color }}>{value ?? '-'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
