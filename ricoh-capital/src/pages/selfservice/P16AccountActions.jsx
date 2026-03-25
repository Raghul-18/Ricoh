import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, CreditCard, MessageSquare, RefreshCw, ArrowLeft } from 'lucide-react';
import { useCustomerContracts, exportContractsCSV } from '../../hooks/useContracts';
import { useAuth } from '../../auth/AuthContext';
import { db } from '../../lib/backendClient';
import { useAppContext } from '../../context/AppContext';
import { FormField, LoadingSpinner } from '../../components/shared/FormField';

function useSubmitServiceRequest() {
  const { user } = useAuth();
  const { showToast } = useAppContext();
  const [loading, setLoading] = useState(false);

  const submit = async ({ type, body }) => {
    setLoading(true);
    try {
      await db.notifications().insert({
        user_id: user.id,
        title: type,
        body,
        type: 'system',
      });
      showToast('Request submitted — our team will be in touch within 1 business day', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to submit request', 'error');
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading };
}

export default function P16AccountActions() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useAppContext();
  const { data: contracts = [], isLoading } = useCustomerContracts();
  const { submit, loading: submitting } = useSubmitServiceRequest();

  const [selectedContract, setSelectedContract] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [bankName, setBankName] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const handleExportStatement = () => {
    if (!contracts.length) { showToast('No contracts to export', 'warning'); return; }
    exportContractsCSV(contracts, ['reference_number', 'asset_description', 'asset_value', 'monthly_payment', 'term_months', 'start_date', 'end_date', 'status']);
    showToast('Statement downloaded', 'success');
  };

  const handleSettlementRequest = async () => {
    if (!selectedContract) { showToast('Please select a contract', 'warning'); return; }
    const c = contracts.find(c => c.id === selectedContract);
    await submit({
      type: 'Early settlement request',
      body: `Early settlement requested for contract ${c?.reference_number} — ${c?.asset_description}. ${settlementNote ? 'Note: ' + settlementNote : ''}`,
    });
    setSettlementNote('');
    setSelectedContract('');
  };

  const handleBankUpdate = async () => {
    if (!bankName || !sortCode || !accountNumber) { showToast('Please fill in all bank details', 'warning'); return; }
    await submit({
      type: 'Bank detail update request',
      body: `Account holder: ${bankName} · Sort code: ${sortCode} · Account number: ${accountNumber}`,
    });
    setBankName(''); setSortCode(''); setAccountNumber('');
  };

  const handleContact = async () => {
    if (!contactMessage.trim()) { showToast('Please enter your message', 'warning'); return; }
    await submit({ type: 'Customer support request', body: contactMessage });
    setContactMessage('');
  };

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/portal/dashboard')}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="page-title">Account actions</div>
            <div className="page-sub">Manage your agreements and service requests</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div>
          {/* Statements */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <FileText size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Statements & documents</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Account statement</div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>All contracts — CSV format</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={handleExportStatement}>
                  <Download size={12} /> Download
                </button>
              </div>
              {contracts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.asset_description}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{c.reference_number} · £{(c.monthly_payment || 0).toLocaleString()}/mo</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate(`/portal/contracts/${c.id}`)}>
                    View <RefreshCw size={10} />
                  </button>
                </div>
              ))}
              {contracts.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: '12px 0' }}>No active contracts</div>
              )}
            </div>
          </div>

          {/* Contact us */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <MessageSquare size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Contact support</div>
            </div>
            <FormField label="Your message">
              <textarea
                className="form-input"
                rows={4}
                placeholder="How can we help? Describe your query or issue…"
                value={contactMessage}
                onChange={e => setContactMessage(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </FormField>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleContact} disabled={submitting || !contactMessage.trim()}>
              {submitting ? <LoadingSpinner size={12} /> : <MessageSquare size={13} />} Send message
            </button>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Early settlement */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CreditCard size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Request early settlement</div>
            </div>
            <FormField label="Select contract">
              <select className="form-input" value={selectedContract} onChange={e => setSelectedContract(e.target.value)}>
                <option value="">— Choose a contract —</option>
                {contracts.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.asset_description} — {c.reference_number}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Additional notes" hint="Optional — any context for your request">
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Looking to settle by end of month…"
                value={settlementNote}
                onChange={e => setSettlementNote(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </FormField>
            <div className="info-banner blue" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.5 }}>
                An early settlement figure will be provided within 2 business days. Early settlement may be subject to an early repayment charge.
              </div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSettlementRequest} disabled={submitting || !selectedContract}>
              {submitting ? <LoadingSpinner size={12} /> : <CreditCard size={13} />} Request settlement quote
            </button>
          </div>

          {/* Bank details */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Download size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Update bank details</div>
            </div>
            <FormField label="Account holder name" required>
              <input className="form-input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder={profile?.full_name || 'Account holder name'} />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Sort code" required>
                <input className="form-input" value={sortCode} onChange={e => setSortCode(e.target.value)} placeholder="00-00-00" maxLength={8} />
              </FormField>
              <FormField label="Account number" required>
                <input className="form-input" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="12345678" maxLength={8} />
              </FormField>
            </div>
            <div className="info-banner blue" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.5 }}>
                Bank detail changes require verification. We'll send a confirmation to your registered email before any changes take effect.
              </div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleBankUpdate} disabled={submitting}>
              {submitting ? <LoadingSpinner size={12} /> : 'Submit change request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
