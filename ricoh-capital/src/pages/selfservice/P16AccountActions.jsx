import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, CreditCard, MessageSquare, RefreshCw, ArrowLeft } from 'lucide-react';
import { useCreateClosureRequest, useCustomerContracts, exportContractsCSV } from '../../hooks/useContracts';
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
      showToast('Request submitted - our team will be in touch within 1 business day', 'success');
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
  const createClosureRequest = useCreateClosureRequest();

  const [selectedContract, setSelectedContract] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
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
    try {
      await createClosureRequest.mutateAsync({
        contractId: selectedContract,
        reason: 'Customer settlement request',
        settlementAmount: Number(settlementAmount || 0),
        notes: settlementNote,
      });
      showToast('Closure request sent to the admin team', 'success');
      setSettlementNote('');
      setSettlementAmount('');
      setSelectedContract('');
    } catch (error) {
      showToast(error.message || 'Failed to create closure request', 'error');
    }
  };

  const handleBankUpdate = async () => {
    if (!bankName || !sortCode || !accountNumber) { showToast('Please fill in all bank details', 'warning'); return; }
    await submit({
      type: 'Bank detail update request',
      body: `Account holder: ${bankName} | Sort code: ${sortCode} | Account number: ${accountNumber}`,
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
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <FileText size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Statements & documents</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Account statement</div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)' }}>All contracts - CSV format</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={handleExportStatement}>
                  <Download size={12} /> Download
                </button>
              </div>
              {contracts.map((contract) => (
                <div key={contract.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{contract.asset_description}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{contract.reference_number} | {(contract.monthly_payment || 0).toLocaleString()}/mo</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate(`/portal/contracts/${contract.id}`)}>
                    View <RefreshCw size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <MessageSquare size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Contact support</div>
            </div>
            <FormField label="Your message">
              <textarea
                className="form-input"
                rows={4}
                placeholder="How can we help? Describe your query or issue..."
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </FormField>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleContact} disabled={submitting || !contactMessage.trim()}>
              {submitting ? <LoadingSpinner size={12} /> : <MessageSquare size={13} />} Send message
            </button>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CreditCard size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Request settlement / closure</div>
            </div>
            <FormField label="Select contract">
              <select className="form-input" value={selectedContract} onChange={(event) => setSelectedContract(event.target.value)}>
                <option value="">- Choose a contract -</option>
                {contracts.filter((contract) => contract.status === 'active').map((contract) => (
                  <option key={contract.id} value={contract.id}>{contract.asset_description} - {contract.reference_number}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Target settlement amount">
              <input className="form-input" type="number" value={settlementAmount} onChange={(event) => setSettlementAmount(event.target.value)} />
            </FormField>
            <FormField label="Additional notes">
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Looking to settle by end of month..."
                value={settlementNote}
                onChange={(event) => setSettlementNote(event.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </FormField>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleSettlementRequest} disabled={createClosureRequest.isPending || !selectedContract}>
              {createClosureRequest.isPending ? <LoadingSpinner size={12} /> : <CreditCard size={13} />} Submit closure request
            </button>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Download size={15} style={{ color: 'var(--coral)' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Update bank details</div>
            </div>
            <FormField label="Account holder name" required>
              <input className="form-input" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder={profile?.full_name || 'Account holder name'} />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <FormField label="Sort code" required>
                <input className="form-input" value={sortCode} onChange={(event) => setSortCode(event.target.value)} placeholder="00-00-00" maxLength={8} />
              </FormField>
              <FormField label="Account number" required>
                <input className="form-input" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="12345678" maxLength={8} />
              </FormField>
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
