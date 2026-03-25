import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, TrendingUp, ChevronRight, CreditCard, AlertCircle, Bell } from 'lucide-react';
import { useCustomerContracts } from '../../hooks/useContracts';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const STATUS_META = {
  active:    { label: 'Active',    color: 'var(--green)',  bg: 'var(--green-l)' },
  overdue:   { label: 'Overdue',   color: 'var(--red)',    bg: 'var(--red-l)' },
  maturing:  { label: 'Maturing',  color: 'var(--amber)',  bg: 'var(--amber-l)' },
  completed: { label: 'Completed', color: 'var(--tx3)',    bg: 'var(--bg)' },
};

export default function P15CustomerDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: contracts = [], isLoading } = useCustomerContracts();

  const displayName = profile?.full_name?.split(' ')[0] || 'there';
  const activeContracts = contracts.filter(c => c.status === 'active');
  const overdueContracts = contracts.filter(c => c.status === 'overdue');
  const totalOutstanding = activeContracts.reduce((sum, c) => {
    const remaining = Math.max(0, (c.term_months || 0) - (c.payments_made || 0));
    return sum + (c.monthly_payment || 0) * remaining;
  }, 0);

  const kpis = [
    { label: 'Active agreements', value: activeContracts.length,    icon: <FileText size={18} />,    color: 'var(--blue)' },
    { label: 'Overdue payments',  value: overdueContracts.length,   icon: <AlertCircle size={18} />, color: overdueContracts.length > 0 ? 'var(--red)' : 'var(--green)' },
    { label: 'Total outstanding', value: `£${(totalOutstanding / 1000).toFixed(1)}k`, icon: <TrendingUp size={18} />, color: 'var(--coral)' },
  ];

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Welcome back, {displayName}</div>
          <div className="page-sub">Your finance agreements at a glance</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/portal/notifications')}>
          <Bell size={14} /> Notifications
        </button>
      </div>

      {/* KPI row */}
      <div className="kpi-row-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="metric-card">
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Contracts list */}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Your agreements</div>
        {contracts.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div style={{ color: 'var(--tx4)', marginBottom: 12 }}><CreditCard size={36} /></div>
            <div className="empty-state-title">No agreements yet</div>
            <div className="empty-state-sub">Your finance agreements will appear here once active.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {contracts.map((c, i) => {
              const meta = STATUS_META[c.status] || STATUS_META.active;
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0', borderBottom: i < contracts.length - 1 ? '1px solid var(--bdr)' : 'none',
                  cursor: 'pointer',
                }} onClick={() => navigate(`/portal/contracts/${c.id}`)}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.asset_description || 'Finance agreement'}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                      {c.reference_number} · {c.term_months} months
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>£{(c.monthly_payment || 0).toLocaleString()}/mo</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 3 }}>
                      {c.next_payment_date && <span style={{ fontSize: 10, color: 'var(--tx4)', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={9} />{new Date(c.next_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 8, padding: '2px 6px' }}>{meta.label}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
