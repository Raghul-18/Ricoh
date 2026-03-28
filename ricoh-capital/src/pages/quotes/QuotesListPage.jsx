import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ChevronRight, Clock, CheckCircle, Send } from 'lucide-react';
import { useQuotes } from '../../hooks/useQuotes';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';

const STATUS_META = {
  draft: { labelKey: 'quotes.statusDraft', color: 'var(--tx3)', bg: 'var(--bg)', icon: <Clock size={12} /> },
  sent: { labelKey: 'quotes.statusSent', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Send size={12} /> },
  accepted: { labelKey: 'quotes.statusAccepted', color: 'var(--green)', bg: 'var(--green-l)', icon: <CheckCircle size={12} /> },
  expired: { labelKey: 'quotes.statusExpired', color: 'var(--red)', bg: 'var(--red-l)', icon: <Clock size={12} /> },
};

export default function QuotesListPage() {
  const navigate = useNavigate();
  const { data: quotes = [], isLoading, error } = useQuotes();
  const { primaryCurrency, formatCurrency, formatDate, formatNumber, t } = useLocale();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('sidebar.quotes')}</div>
          <div className="page-sub">{t('quotes.count', { count: formatNumber(quotes.length) })}</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>
          <Plus size={14} /> {t('quotes.newQuote')}
        </button>
      </div>

      {isLoading ? (
        <div className="page-loading"><LoadingSpinner size={24} /></div>
      ) : error ? (
        <div className="page-error">{error.message}</div>
      ) : quotes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><FileText size={40} /></div>
            <div className="empty-state-title">{t('quotes.emptyTitle')}</div>
            <div className="empty-state-sub">{t('quotes.emptySub')}</div>
            <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}><Plus size={14} /> {t('quotes.newQuote')}</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {quotes.map((quote, index) => {
            const meta = STATUS_META[quote.status] || STATUS_META.draft;
            return (
              <div
                key={quote.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 20px',
                  borderBottom: index < quotes.length - 1 ? '1px solid var(--bdr)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/quotes/${quote.id}`)}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                  <FileText size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{quote.prospect_name || t('quotes.quoteLabel')}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                    {quote.reference_number} - {t('quotes.scenarios', { count: quote.scenarios?.length || 0 })}
                    {quote.asset_description ? ` - ${quote.asset_description}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {quote.asset_value ? <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(quote.asset_value, primaryCurrency)}</div> : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, background: meta.bg, borderRadius: 8, padding: '2px 7px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {meta.icon} {t(meta.labelKey)}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2 }}>
                    {formatDate(quote.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}
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
