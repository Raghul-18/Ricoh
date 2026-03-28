import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, Clock, FileText, Plus, RefreshCw, Send, XCircle } from 'lucide-react';
import { useDeals } from '../../hooks/useDeals';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import { convertWithRate, useFxRate } from '../../hooks/useFx';

const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--tx3)', bg: 'var(--bg)', icon: <FileText size={12} /> },
  submitted: { label: 'Submitted', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Send size={12} /> },
  under_review: { label: 'In review', color: 'var(--amber)', bg: 'var(--amber-l)', icon: <Clock size={12} /> },
  approved: { label: 'Approved', color: 'var(--green)', bg: 'var(--green-l)', icon: <CheckCircle size={12} /> },
  rejected: { label: 'Not approved', color: 'var(--red)', bg: 'var(--red-l)', icon: <XCircle size={12} /> },
};

export default function MyDealsPage() {
  const navigate = useNavigate();
  const { data: deals = [], isLoading, error, refetch } = useDeals();
  const { primaryCurrency, reportingCurrency, formatCurrency, formatDate, t } = useLocale();
  const { data: fx } = useFxRate(reportingCurrency, primaryCurrency);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = deals
    .filter((deal) => filter === 'all' || deal.status === filter)
    .filter((deal) => {
      const query = search.toLowerCase();
      return !query
        || deal.customer_name?.toLowerCase().includes(query)
        || deal.reference_number?.toLowerCase().includes(query)
        || deal.originator_reference?.toLowerCase().includes(query);
    });

  const counts = Object.fromEntries(
    ['submitted', 'under_review', 'approved', 'rejected'].map((status) => [status, deals.filter((deal) => deal.status === status).length]),
  );

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My Deals</div>
          <div className="page-title">{t('deals.myDealsTitle')}</div>
          <div className="page-sub">{t('deals.myDealsSub', { count: deals.length })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
            <Plus size={14} /> {t('sidebar.newDeal')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'submitted', label: t('common.submitted'), color: 'var(--blue)' },
          { key: 'under_review', label: t('common.inReview'), color: 'var(--amber)' },
          { key: 'approved', label: t('common.approved'), color: 'var(--green)' },
          { key: 'rejected', label: t('common.declined'), color: 'var(--red)' },
        ].map(({ key, label, color }) => (
          <div key={key} className="metric-card" style={{ cursor: 'pointer', outline: filter === key ? `2px solid ${color}` : undefined }} onClick={() => setFilter(filter === key ? 'all' : key)}>
            <div className="metric-value" style={{ color }}>{counts[key] || 0}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ width: 240, height: 34, fontSize: 12 }} placeholder={t('deals.searchPlaceholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...Object.keys(STATUS_META)].map((status) => (
            <button key={status} className={`btn ${filter === status ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '4px 12px', height: 32 }} onClick={() => setFilter(status)}>
              {status === 'all' ? t('common.all') : STATUS_META[status].label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="page-error">{error.message}</div>}

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><FileText size={40} /></div>
            <div className="empty-state-title">{deals.length === 0 ? t('deals.noDealsTitle') : t('common.noResults')}</div>
            <div className="empty-state-sub">{deals.length === 0 ? t('deals.noDealsSub') : t('common.adjustFilters')}</div>
            {deals.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                <Plus size={14} /> {t('deals.submitDeal')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((deal, index) => {
            const status = STATUS_META[deal.status] || STATUS_META.submitted;
            const originalCurrency = deal.original_currency_code || deal.reporting_currency_code || reportingCurrency;
            const originalMonthly = deal.original_monthly_payment ?? deal.monthly_payment ?? 0;
            const currentMonthly = primaryCurrency === originalCurrency
              ? originalMonthly
              : convertWithRate(deal.reporting_monthly_payment ?? deal.monthly_payment ?? 0, fx?.rate);

            return (
              <div
                key={deal.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderBottom: index < filtered.length - 1 ? '1px solid var(--bdr)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/deals/${deal.id}`)}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                  <FileText size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{deal.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--coral)' }}>{deal.reference_number}</span>
                    <span>{deal.product_type}</span>
                    {deal.originator_reference && <span>{t('deals.yourReferenceShort')}: {deal.originator_reference}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(originalMonthly, originalCurrency)}/mo</div>
                  {primaryCurrency !== originalCurrency && Number.isFinite(currentMonthly) && (
                    <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2 }}>{formatCurrency(currentMonthly, primaryCurrency)}/mo</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: status.color, background: status.bg, borderRadius: 99, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 3 }}>
                    {formatDate(deal.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
