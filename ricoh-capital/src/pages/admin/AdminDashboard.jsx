import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardList, Send, TrendingUp,
  Clock, CheckCircle, AlertCircle, BarChart3, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/backendClient';
import { keys } from '../../lib/queryClient';
import { LoadingSpinner } from '../../components/shared/FormField';

function useAdminStats() {
  return useQuery({
    queryKey: keys.adminStats(),
    queryFn: async () => {
      const [apps, deals, contracts, originators] = await Promise.all([
        db.applications().select('status').neq('status', 'draft'),
        db.deals().select('status, monthly_payment, asset_value').neq('status', 'draft'),
        db.contracts().select('status, asset_value, monthly_payment'),
        db.profiles().select('id').eq('role', 'originator').eq('onboarding_status', 'approved'),
      ]);
      if (apps.error || deals.error || contracts.error || originators.error) {
        throw apps.error || deals.error || contracts.error || originators.error;
      }

      const appData = apps.data || [];
      const dealData = deals.data || [];
      const contractData = contracts.data || [];

      return {
        pendingApplications: appData.filter(a => ['submitted', 'under_review'].includes(a.status)).length,
        approvedApplications: appData.filter(a => a.status === 'approved').length,
        dealsAwaitingReview: dealData.filter(d => ['submitted', 'under_review'].includes(d.status)).length,
        dealsApproved: dealData.filter(d => d.status === 'approved').length,
        activeContracts: contractData.filter(c => c.status === 'active').length,
        totalPortfolioValue: contractData.filter(c => c.status === 'active').reduce((s, c) => s + (c.asset_value || 0), 0),
        monthlyBook: contractData.filter(c => c.status === 'active').reduce((s, c) => s + (c.monthly_payment || 0), 0),
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
        db.deals()
          .select('*')
          .in('status', ['submitted', 'under_review'])
          .order('created_at', { ascending: false }),
        db.applications()
          .select('*')
          .in('status', ['submitted', 'under_review'])
          .order('created_at', { ascending: false }),
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
        recentDeals: deals.map((deal) => ({
          ...deal,
          originator: profilesById[deal.originator_id] || null,
        })),
        recentApps: apps.map((app) => ({
          ...app,
          profiles: profilesById[app.user_id] || null,
        })),
      };
    },
    staleTime: 1000 * 60,
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: activity, isLoading: actLoading } = useRecentActivity();

  if (statsLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  const kpis = [
    { label: 'Approved originators', value: stats?.approvedOriginators ?? '—', icon: <Users size={18} />, color: 'var(--blue)', action: null },
    { label: 'Applications pending', value: stats?.pendingApplications ?? '—', icon: <ClipboardList size={18} />, color: stats?.pendingApplications > 0 ? 'var(--amber)' : 'var(--green)', action: '/admin/review' },
    { label: 'Deals awaiting decision', value: stats?.dealsAwaitingReview ?? '—', icon: <Send size={18} />, color: stats?.dealsAwaitingReview > 0 ? 'var(--coral)' : 'var(--green)', action: '/admin/deals' },
    { label: 'Active contracts', value: stats?.activeContracts ?? '—', icon: <CheckCircle size={18} />, color: 'var(--green)', action: null },
    { label: 'Total portfolio', value: stats ? `£${(stats.totalPortfolioValue / 1_000_000).toFixed(2)}M` : '—', icon: <TrendingUp size={18} />, color: 'var(--coral)', action: null },
    { label: 'Monthly book', value: stats ? `£${(stats.monthlyBook).toLocaleString()}` : '—', icon: <BarChart3 size={18} />, color: 'var(--blue)', action: null },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Admin dashboard</div>
          <div className="page-sub">Platform overview at a glance</div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="three-col" style={{ marginBottom: 24 }}>
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className="metric-card"
            style={{ cursor: kpi.action ? 'pointer' : 'default' }}
            onClick={() => kpi.action && navigate(kpi.action)}
          >
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
            {kpi.action && <div style={{ fontSize: 9, color: 'var(--tx4)', marginTop: 6 }}>Click to view →</div>}
          </div>
        ))}
      </div>

      <div className="two-col-equal">
        {/* Deals awaiting review */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Deals pending decision</div>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/admin/deals')}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          {actLoading ? (
            <div style={{ textAlign: 'center', padding: 16 }}><LoadingSpinner size={20} /></div>
          ) : activity?.recentDeals.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '16px 0' }}>No deals awaiting review</div>
          ) : (
            activity?.recentDeals.map((d, i) => (
              <div
                key={d.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < activity.recentDeals.length - 1 ? '1px solid var(--bdr)' : 'none', cursor: 'pointer' }}
                onClick={() => navigate('/admin/deals')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.customer_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>
                    {d.originator?.company_name} · {d.reference_number}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: d.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', background: d.status === 'under_review' ? 'var(--amber-l)' : 'var(--blue-l)', borderRadius: 99, padding: '2px 7px' }}>
                  {d.status === 'under_review' ? 'In review' : 'New'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Applications pending */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Originator applications</div>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/admin/review')}>
              View all <ChevronRight size={12} />
            </button>
          </div>
          {actLoading ? (
            <div style={{ textAlign: 'center', padding: 16 }}><LoadingSpinner size={20} /></div>
          ) : activity?.recentApps.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '16px 0' }}>No pending applications</div>
          ) : (
            activity?.recentApps.map((a, i) => (
              <div
                key={a.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < activity.recentApps.length - 1 ? '1px solid var(--bdr)' : 'none', cursor: 'pointer' }}
                onClick={() => navigate('/admin/review')}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.profiles?.company_name || a.profiles?.full_name || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>
                    {new Date(a.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: a.status === 'under_review' ? 'var(--amber)' : 'var(--blue)', background: a.status === 'under_review' ? 'var(--amber-l)' : 'var(--blue-l)', borderRadius: 99, padding: '2px 7px' }}>
                  {a.status === 'under_review' ? 'In review' : 'New'}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Quick actions</div>
          {[
            { icon: <Send size={14} />, label: 'Review deal queue', sub: `${stats?.dealsAwaitingReview ?? 0} pending`, to: '/admin/deals', color: 'var(--coral)' },
            { icon: <ClipboardList size={14} />, label: 'Review applications', sub: `${stats?.pendingApplications ?? 0} pending`, to: '/admin/review', color: 'var(--blue)' },
            { icon: <AlertCircle size={14} />, label: 'Audit log', sub: 'Review all platform activity', to: '/admin/audit', color: 'var(--tx3)' },
          ].map(item => (
            <div
              key={item.label}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--bdr)', cursor: 'pointer' }}
              onClick={() => navigate(item.to)}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
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

        {/* Platform health */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Platform summary</div>
          {[
            ['Approved originators', stats?.approvedOriginators, 'var(--green)'],
            ['Pending applications', stats?.pendingApplications, stats?.pendingApplications > 0 ? 'var(--amber)' : 'var(--green)'],
            ['Deals in pipeline', stats?.dealsAwaitingReview, stats?.dealsAwaitingReview > 0 ? 'var(--coral)' : 'var(--green)'],
            ['Approved deals (total)', stats?.dealsApproved, 'var(--blue)'],
            ['Active contracts', stats?.activeContracts, 'var(--green)'],
            ['Monthly book value', stats ? `£${(stats.monthlyBook).toLocaleString()}` : '—', 'var(--coral)'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--bdr)', marginBottom: 8 }}>
              <span style={{ color: 'var(--tx3)' }}>{label}</span>
              <span style={{ fontWeight: 700, color }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
