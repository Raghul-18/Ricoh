import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Send, CheckCircle, XCircle } from 'lucide-react';
import { useQuote, useSendQuote, useAcceptQuote, useDeclineQuote, calcMonthly } from '../../hooks/useQuotes';
import { useAppContext } from '../../context/AppContext';
import { useDealStore } from '../../store/dealStore';
import { LoadingSpinner } from '../../components/shared/FormField';
import { RicohMark } from '../../components/shared/RicohLogo';
import { useLocale } from '../../context/LocaleContext';

const STATUS_META = {
  draft: { labelKey: 'quotes.statusDraft', color: 'var(--tx3)' },
  sent: { labelKey: 'quotes.statusSent', color: 'var(--blue)' },
  accepted: { labelKey: 'quotes.statusAccepted', color: 'var(--green)' },
  rejected: { labelKey: 'quotes.statusRejected', color: 'var(--red)' },
  expired: { labelKey: 'quotes.statusExpired', color: 'var(--tx4)' },
};

function QuoteCard({ quote, onSend, onAccept, onDecline }) {
  const { primaryCurrency, formatCurrency, formatDate, t } = useLocale();
  if (!quote) return null;

  const meta = STATUS_META[quote.status] || STATUS_META.draft;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--bdr)', borderRadius: 'var(--rxl)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--coral)', padding: '24px 28px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RicohMark size={34} />
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.3px', color: '#fff' }}>Ricoh Capital</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{t('quotes.reference')}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700 }}>{quote.reference_number}</div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{t('quotes.preparedFor')}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{quote.customer_name}</div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 12, color: 'var(--tx3)' }}>
          <div>{t('quotes.assetType')}: <strong style={{ color: 'var(--tx1)' }}>{quote.asset_type}</strong></div>
          <div>{t('common.assetValue')}: <strong style={{ color: 'var(--tx1)' }}>{formatCurrency(quote.asset_value || 0, primaryCurrency)}</strong></div>
          <div>{t('quotes.validUntil')}: <strong style={{ color: 'var(--tx1)' }}>{quote.valid_until ? formatDate(quote.valid_until, { day: 'numeric', month: 'short', year: 'numeric' }) : t('common.none')}</strong></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('common.status')}: <span style={{ fontWeight: 700, color: meta.color }}>{t(meta.labelKey)}</span>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>{t('quotes.financeOptions')}</div>
        {(quote.scenarios || []).map((scenario, index) => (
          <div
            key={index}
            style={{
              border: index === 0 ? '2px solid var(--coral)' : '1px solid var(--bdr)',
              borderRadius: 'var(--rl)',
              padding: '16px 20px',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t('quotes.option', { count: index + 1 })}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                  {t('deals.months', { count: scenario.termMonths })} - {scenario.aprPct}% APR - {scenario.rateType} {t('deals.rateType').toLowerCase()}
                  {scenario.deposit > 0 && ` - ${formatCurrency(scenario.deposit, primaryCurrency)} ${t('quotes.depositSuffix')}`}
                  {scenario.balloon > 0 && ` - ${formatCurrency(scenario.balloon, primaryCurrency)} balloon`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: index === 0 ? 'var(--coral)' : 'var(--tx1)' }}>
                  {formatCurrency(scenario.monthlyPayment || calcMonthly(quote.asset_value, scenario.deposit, scenario.termMonths, scenario.aprPct, scenario.balloon), primaryCurrency)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('quotes.perMonth')}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--bdr)', marginTop: 12, paddingTop: 10, display: 'flex', gap: 24, fontSize: 12, color: 'var(--tx3)' }}>
              <div>{t('deals.totalPayable')}: <strong style={{ color: 'var(--tx1)' }}>{formatCurrency(scenario.totalPayable || 0, primaryCurrency)}</strong></div>
              <div>{t('quotes.amountFinanced')}: <strong style={{ color: 'var(--tx1)' }}>{formatCurrency((quote.asset_value || 0) - (scenario.deposit || 0) - (scenario.balloon || 0), primaryCurrency)}</strong></div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 16, lineHeight: 1.6 }}>
          {t('quotes.disclaimer')}
        </div>
      </div>

      {quote.status === 'draft' && (
        <div style={{ borderTop: '1px solid var(--bdr)', padding: '16px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => onSend(quote.id, quote.customer_name)}>
            <Send size={13} /> {t('quotes.sendToCustomer')}
          </button>
        </div>
      )}

      {quote.status === 'sent' && (
        <div style={{ borderTop: '1px solid var(--bdr)', padding: '16px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 12, textAlign: 'center' }}>
            {t('quotes.customerResponsePrompt')}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ minWidth: 140 }} onClick={() => onAccept(quote)}>
              <CheckCircle size={13} /> {t('quotes.customerAccepted')}
            </button>
            <button className="btn btn-ghost" style={{ minWidth: 140, color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={() => onDecline(quote.id)}>
              <XCircle size={13} /> {t('quotes.customerDeclined')}
            </button>
          </div>
        </div>
      )}

      {quote.status === 'accepted' && (
        <div style={{ borderTop: '1px solid var(--bdr)', padding: '16px 24px', background: 'var(--green-l)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--green-d)' }}>{t('quotes.acceptedBannerTitle')}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{t('quotes.acceptedBannerSub')}</div>
          </div>
        </div>
      )}

      {quote.status === 'rejected' && (
        <div style={{ borderTop: '1px solid var(--bdr)', padding: '16px 24px', background: 'var(--red-l)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <XCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>{t('quotes.rejectedBanner')}</div>
        </div>
      )}
    </div>
  );
}

export default function P22QuoteOutput() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const sendQuote = useSendQuote();
  const acceptQuote = useAcceptQuote();
  const declineQuote = useDeclineQuote();
  const { showToast, confirm } = useAppContext();
  const { setInitiation, setAssetDetails } = useDealStore();
  const { t } = useLocale();

  const handleSend = async (quoteId, customerName) => {
    await sendQuote.mutateAsync({ quoteId, customerName });
    showToast(t('quotes.sentSuccess'), 'success');
  };

  const handleAccept = async (selectedQuote) => {
    const ok = await confirm({
      title: t('quotes.acceptModalTitle'),
      message: t('quotes.acceptModalMessage', { name: selectedQuote.customer_name }),
      confirmLabel: t('quotes.acceptModalConfirm'),
    });
    if (!ok) return;

    try {
      await acceptQuote.mutateAsync({ quoteId: selectedQuote.id });

      const bestScenario = (selectedQuote.scenarios || [])[0] || {};
      setInitiation({
        customerName: selectedQuote.customer_name,
        productType: 'Asset Finance - Finance Lease',
        notes: `Created from quote ${selectedQuote.reference_number}`,
      });
      setAssetDetails({
        assetType: selectedQuote.asset_type || 'Commercial vehicle',
        assetValue: selectedQuote.asset_value || 0,
        termMonths: bestScenario.termMonths || 36,
        deposit: bestScenario.deposit || 0,
        balloon: bestScenario.balloon || 0,
        rateType: bestScenario.rateType || 'Fixed',
      });

      showToast(t('quotes.acceptedSuccess'), 'success');
      navigate('/deals/new');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDecline = async (quoteId) => {
    const ok = await confirm({
      title: t('quotes.declineModalTitle'),
      message: t('quotes.declineModalMessage'),
      confirmLabel: t('quotes.declineModalConfirm'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await declineQuote.mutateAsync({ quoteId });
      showToast(t('quotes.declinedSuccess'), 'info');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!quote) return <div className="page-error">{t('quotes.notFound')}</div>;

  return (
    <div className="page" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/quotes')}><ArrowLeft size={14} /> {t('quotes.allQuotes')}</button>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => window.print()}><Printer size={13} /> {t('quotes.print')}</button>
      </div>
      <QuoteCard quote={quote} onSend={handleSend} onAccept={handleAccept} onDecline={handleDecline} />
    </div>
  );
}
