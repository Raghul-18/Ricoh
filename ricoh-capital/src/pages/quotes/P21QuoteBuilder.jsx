import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { X, Plus, Send, Save, ExternalLink } from 'lucide-react';
import { useCreateQuote, calcMonthly } from '../../hooks/useQuotes';
import { useProspects } from '../../hooks/useProspects';
import { useAppContext } from '../../context/AppContext';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';

const ASSET_TYPES = ['Commercial vehicle', 'Plant & machinery', 'Medical equipment', 'Catering equipment', 'IT & technology', 'Agricultural equipment', 'Other'];
const TERMS = [12, 24, 36, 48, 60, 72, 84];
const defaultScenario = () => ({ termMonths: 36, deposit: 0, aprPct: 7.2, rateType: 'Fixed' });

export default function P21QuoteBuilder() {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const { data: prospects = [], isLoading: prospectsLoading } = useProspects();
  const createQuote = useCreateQuote();
  const { primaryCurrency, formatCurrency, t } = useLocale();

  const [customerName, setCustomerName] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [assetType, setAssetType] = useState('Commercial vehicle');
  const [assetValue, setAssetValue] = useState(0);
  const [scenarios, setScenarios] = useState([defaultScenario()]);

  const updateScenario = (index, updates) => {
    setScenarios((items) => items.map((scenario, itemIndex) => (itemIndex === index ? { ...scenario, ...updates } : scenario)));
  };

  const addScenario = () => {
    if (scenarios.length >= 4) {
      showToast(t('quotes.maxScenarios'), 'warning');
      return;
    }
    setScenarios((items) => [...items, defaultScenario()]);
  };

  const removeScenario = (index) => {
    if (scenarios.length === 1) return;
    setScenarios((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleProspectChange = (event) => {
    const nextProspectId = event.target.value;
    setProspectId(nextProspectId);
    const prospect = prospects.find((item) => item.id === nextProspectId);
    if (prospect) setCustomerName(prospect.company_name);
  };

  const handleSave = async (status) => {
    if (!customerName.trim()) {
      showToast(t('quotes.enterCustomerName'), 'warning');
      return;
    }
    if (!assetValue || assetValue <= 0) {
      showToast(t('quotes.enterAssetValue'), 'warning');
      return;
    }

    const scenariosData = scenarios.map((scenario) => {
      const monthly = calcMonthly(assetValue, scenario.deposit, scenario.termMonths, scenario.aprPct);
      return {
        termMonths: scenario.termMonths,
        deposit: scenario.deposit,
        aprPct: scenario.aprPct,
        rateType: scenario.rateType,
        monthlyPayment: monthly,
        totalPayable: monthly * scenario.termMonths,
      };
    });

    try {
      const quote = await createQuote.mutateAsync({
        customer_name: customerName,
        prospect_id: prospectId || null,
        asset_type: assetType,
        asset_value: assetValue,
        scenarios: scenariosData,
        status,
      });
      showToast(status === 'sent' ? t('quotes.sentSuccess') : t('quotes.savedSuccess'), 'success');
      navigate(`/quotes/${quote.id}`);
    } catch (error) {
      showToast(error.message || t('quotes.saveFailed'), 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('quotes.builderTitle')}</div>
          <div className="page-sub">{t('quotes.builderSub')}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/quotes')}><X size={14} /> {t('common.cancel')}</button>
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>{t('common.customer')}</div>
            <FormField label={t('quotes.customerName')} required>
              <input className="form-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="TechWorks Solutions Ltd" />
            </FormField>
            <FormField label={t('quotes.linkProspect')} hint={t('quotes.linkProspectHint')}>
              {prospectsLoading ? (
                <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx4)' }}>
                  <LoadingSpinner size={12} /> {t('quotes.loadingProspects')}
                </div>
              ) : prospects.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t('quotes.noProspects')}
                  <Link to="/crm/new" style={{ color: 'var(--coral)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {t('quotes.addProspect')} <ExternalLink size={11} />
                  </Link>
                </div>
              ) : (
                <select className="form-input" value={prospectId} onChange={handleProspectChange}>
                  <option value="">{t('common.none')}</option>
                  {prospects.map((prospect) => (
                    <option key={prospect.id} value={prospect.id}>{prospect.company_name}</option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>{t('common.asset')}</div>
            <FormField label={t('quotes.assetType')} required>
              <select className="form-input" value={assetType} onChange={(event) => setAssetType(event.target.value)}>
                {ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </FormField>
            <FormField label={t('quotes.assetValue', { currency: primaryCurrency })} required>
              <input className="form-input" type="number" min="0" step="1000" value={assetValue || ''} onChange={(event) => setAssetValue(Number(event.target.value))} placeholder="42000" />
            </FormField>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{t('quotes.scenarioCount', { count: scenarios.length })}</div>
            <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={addScenario}><Plus size={12} /> {t('quotes.addScenario')}</button>
          </div>

          {scenarios.map((scenario, index) => {
            const monthly = assetValue > 0 ? calcMonthly(assetValue, scenario.deposit, scenario.termMonths, scenario.aprPct) : 0;
            const total = monthly * scenario.termMonths;
            return (
              <div key={index} className="card" style={{ marginBottom: 12, border: index === 0 ? '2px solid var(--coral)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {t('quotes.option', { count: index + 1 })}
                    {index === 0 && <span style={{ fontSize: 10, background: 'var(--coral)', color: '#fff', borderRadius: 99, padding: '2px 8px', marginLeft: 8 }}>{t('quotes.recommended')}</span>}
                  </div>
                  {index > 0 && (
                    <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)', padding: '2px 8px' }} onClick={() => removeScenario(index)}><X size={12} /></button>
                  )}
                </div>

                <div className="two-col-equal" style={{ gap: '0 12px' }}>
                  <FormField label={t('common.term')}>
                    <select className="form-input" value={scenario.termMonths} onChange={(event) => updateScenario(index, { termMonths: Number(event.target.value) })}>
                      {TERMS.map((term) => <option key={term} value={term}>{t('deals.months', { count: term })}</option>)}
                    </select>
                  </FormField>
                  <FormField label={t('quotes.deposit', { currency: primaryCurrency })}>
                    <input className="form-input" type="number" min="0" step="100" value={scenario.deposit} onChange={(event) => updateScenario(index, { deposit: Number(event.target.value) })} />
                  </FormField>
                </div>

                <div className="two-col-equal" style={{ gap: '0 12px' }}>
                  <FormField label="APR (%)">
                    <input className="form-input" type="number" min="1" max="30" step="0.1" value={scenario.aprPct} onChange={(event) => updateScenario(index, { aprPct: Number(event.target.value) })} />
                  </FormField>
                  <FormField label={t('deals.rateType')}>
                    <select className="form-input" value={scenario.rateType} onChange={(event) => updateScenario(index, { rateType: event.target.value })}>
                      <option>Fixed</option>
                      <option>Variable</option>
                    </select>
                  </FormField>
                </div>

                <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: '12px 14px', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>{t('common.monthlyPayment')}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral)' }}>{formatCurrency(monthly, primaryCurrency)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>{t('deals.totalPayable')}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(total, primaryCurrency)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--tx4)', marginBottom: 2 }}>{t('quotes.over')}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t('deals.months', { count: scenario.termMonths })}</div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleSave('draft')} disabled={createQuote.isPending}>
              <Save size={13} /> {t('quotes.saveDraft')}
            </button>
            <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => handleSave('sent')} disabled={createQuote.isPending}>
              {createQuote.isPending ? <LoadingSpinner /> : <><Send size={13} /> {t('quotes.saveAndSend')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
