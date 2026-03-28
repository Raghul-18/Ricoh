import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, TrendingUp, ChevronRight, CreditCard, AlertCircle, Bell } from 'lucide-react';
import { useCustomerContracts } from '../../hooks/useContracts';
import { useAuth } from '../../auth/AuthContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import { convertWithRate, useFxRate } from '../../hooks/useFx';

const STATUS_META = {
  pending_signatures: { labelKey: 'common.inReview', color: 'var(--amber)', bg: 'var(--amber-l)' },
  partially_signed: { labelKey: 'common.inReview', color: 'var(--amber)', bg: 'var(--amber-l)' },
  active: { labelKey: 'portfolio.statusActive', color: 'var(--green)', bg: 'var(--green-l)' },
  overdue: { labelKey: 'portfolio.statusOverdue', color: 'var(--red)', bg: 'var(--red-l)' },
  maturing: { labelKey: 'portfolio.statusMaturing', color: 'var(--amber)', bg: 'var(--amber-l)' },
  completed: { labelKey: 'portfolio.statusCompleted', color: 'var(--tx3)', bg: 'var(--bg)' },
};

function getReportingMonthlyValue(contract, reportingCurrency) {
  const originalCurrency = contract?.deal?.original_currency_code || reportingCurrency;
  const reportingCurrencyCode = contract?.deal?.reporting_currency_code || (originalCurrency === reportingCurrency ? reportingCurrency : null);
  if (Number.isFinite(Number(contract?.deal?.reporting_monthly_payment))) return Number(contract.deal.reporting_monthly_payment);
  if (reportingCurrencyCode === reportingCurrency || originalCurrency === reportingCurrency) {
    return Number(contract?.monthly_payment || 0);
  }
  return null;
}

export default function P15CustomerDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: contracts = [], isLoading } = useCustomerContracts();
  const { primaryCurrency, reportingCurrency, formatCurrency, formatDate, t } = useLocale();
  const { data: fx } = useFxRate(reportingCurrency, primaryCurrency);

  const displayName = profile?.full_name?.split(' ')[0] || t('portal.greetingFallback');
  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const overdueContracts = contracts.filter((contract) => contract.status === 'overdue');
  const reportingOutstanding = activeContracts.reduce((sum, contract) => {
    const remaining = Math.max(0, (contract.term_months || 0) - (contract.payments_made || 0));
    return sum + Number(getReportingMonthlyValue(contract, reportingCurrency) || 0) * remaining;
  }, 0);
  const totalOutstanding = primaryCurrency === reportingCurrency
    ? reportingOutstanding
    : convertWithRate(reportingOutstanding, fx?.rate);

  const kpis = useMemo(() => [
    { label: t('portal.activeAgreements'), value: activeContracts.length, icon: <FileText size={18} />, color: 'var(--blue)' },
    { label: t('portal.overduePayments'), value: overdueContracts.length, icon: <AlertCircle size={18} />, color: overdueContracts.length > 0 ? 'var(--red)' : 'var(--green)' },
    {
      label: t('portal.totalOutstanding'),
      value: Number.isFinite(totalOutstanding) ? formatCurrency(totalOutstanding, primaryCurrency) : t('common.none'),
      icon: <TrendingUp size={18} />,
      color: 'var(--coral)',
    },
  ], [activeContracts.length, formatCurrency, overdueContracts.length, primaryCurrency, t, totalOutstanding]);

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('portal.welcomeBack', { name: displayName })}</div>
          <div className="page-sub">{t('portal.subtitle')}</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/portal/notifications')}>
          <Bell size={14} /> {t('common.notifications')}
        </button>
      </div>

      <div className="kpi-row-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="metric-card">
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>{t('portal.yourAgreements')}</div>
        {contracts.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div style={{ color: 'var(--tx4)', marginBottom: 12 }}><CreditCard size={36} /></div>
            <div className="empty-state-title">{t('portal.noAgreementsTitle')}</div>
            <div className="empty-state-sub">{t('portal.noAgreementsSub')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {contracts.map((contract, index) => {
              const meta = STATUS_META[contract.status] || STATUS_META.active;
              const originalCurrency = contract.deal?.original_currency_code || reportingCurrency;
              const originalMonthly = contract.monthly_payment || 0;
              const reportingMonthly = getReportingMonthlyValue(contract, reportingCurrency);
              const currentMonthly = primaryCurrency === originalCurrency
                ? originalMonthly
                : convertWithRate(reportingMonthly, fx?.rate);

              return (
                <div
                  key={contract.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 0',
                    borderBottom: index < contracts.length - 1 ? '1px solid var(--bdr)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/portal/contracts/${contract.id}`)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{contract.asset_description || t('portal.financeAgreement')}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                      {contract.reference_number} - {t('deals.months', { count: contract.term_months })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(originalMonthly, originalCurrency)}/mo</div>
                    {primaryCurrency !== originalCurrency && Number.isFinite(currentMonthly) && (
                      <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2 }}>{formatCurrency(currentMonthly, primaryCurrency)}/mo</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 3 }}>
                      {contract.next_payment_date && (
                        <span style={{ fontSize: 10, color: 'var(--tx4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={9} />{formatDate(contract.next_payment_date, { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 8, padding: '2px 6px' }}>{t(meta.labelKey)}</span>
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
