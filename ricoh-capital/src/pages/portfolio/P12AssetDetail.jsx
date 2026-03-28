import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, CreditCard, PenSquare, TrendingDown, XCircle } from 'lucide-react';
import {
  useCancelContract,
  useContract,
  useContractClosureRequests,
  useContractSignatures,
  useCreateClosureRequest,
  useCustomerPayNow,
  useMarkPaymentPaid,
  usePaymentSchedule,
  useReviewClosureRequest,
  useSignContract,
} from '../../hooks/useContracts';
import { useAuth } from '../../auth/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';

const STATUS_META = {
  active: { labelKey: 'portfolio.statusActive', color: 'var(--green)', dot: '#22c55e' },
  overdue: { labelKey: 'portfolio.statusOverdue', color: 'var(--red)', dot: '#ef4444' },
  maturing: { labelKey: 'portfolio.statusMaturing', color: 'var(--amber)', dot: '#f59e0b' },
  completed: { labelKey: 'portfolio.statusCompleted', color: 'var(--tx3)', dot: 'var(--tx4)' },
  cancelled: { labelKey: 'portfolio.statusCancelled', color: 'var(--tx4)', dot: 'var(--tx4)' },
};

const PAYMENT_META = {
  upcoming: { labelKey: 'portfolio.paymentUpcoming', color: 'var(--tx3)' },
  due_soon: { labelKey: 'portfolio.paymentDueSoon', color: 'var(--amber)' },
  paid: { labelKey: 'portfolio.paymentPaid', color: 'var(--green)' },
  overdue: { labelKey: 'portfolio.paymentOverdue', color: 'var(--red)' },
  cancelled: { labelKey: 'portfolio.statusCancelled', color: 'var(--tx4)' },
};

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
      <span style={{ color: 'var(--tx3)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SignatureCard({ contractId, signatures, canSign, signerLabel }) {
  const [signerName, setSignerName] = useState('');
  const [signaturePayload, setSignaturePayload] = useState('');
  const signContract = useSignContract();
  const { showToast } = useAppContext();

  const handleSign = async () => {
    try {
      await signContract.mutateAsync({ contractId, signerName, signaturePayload });
      showToast('Contract signed successfully', 'success');
      setSignaturePayload('');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Contract signatures</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {['customer', 'admin'].map((role) => {
          const signature = signatures.find((item) => item.signer_role === role);
          return (
            <div key={role} style={{ border: '1px solid var(--bdr)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{role === 'customer' ? 'Customer' : 'Admin'}</div>
              <div style={{ fontSize: 11, color: signature ? 'var(--green)' : 'var(--tx4)' }}>
                {signature ? `Signed by ${signature.signer_name}` : 'Pending'}
              </div>
            </div>
          );
        })}
      </div>
      {canSign && (
        <>
          <DetailRow label="Signer role" value={signerLabel} />
          <div className="two-col-equal" style={{ gap: '0 12px' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Signer name</div>
              <input className="form-input" value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Full legal name" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Signature</div>
              <input className="form-input" value={signaturePayload} onChange={(event) => setSignaturePayload(event.target.value)} placeholder="Type your signature" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleSign} disabled={signContract.isPending || !signerName.trim() || !signaturePayload.trim()}>
            <PenSquare size={13} /> Sign contract
          </button>
        </>
      )}
    </div>
  );
}

function ClosurePanel({ contract, isAdmin, isCustomer, requests }) {
  const [form, setForm] = useState({ reason: '', settlementAmount: '', effectiveEndDate: '', notes: '' });
  const [reviewNotes, setReviewNotes] = useState('');
  const createRequest = useCreateClosureRequest();
  const reviewRequest = useReviewClosureRequest();
  const terminateContract = useCancelContract();
  const { showToast } = useAppContext();

  const handleRequest = async () => {
    try {
      await createRequest.mutateAsync({
        contractId: contract.id,
        reason: form.reason,
        settlementAmount: Number(form.settlementAmount || 0),
        effectiveEndDate: form.effectiveEndDate,
        notes: form.notes,
      });
      showToast('Closure request submitted', 'success');
      setForm({ reason: '', settlementAmount: '', effectiveEndDate: '', notes: '' });
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleTerminate = async () => {
    try {
      await terminateContract.mutateAsync({
        contractId: contract.id,
        effectiveEndDate: form.effectiveEndDate,
        reason: form.reason,
        settlementAmount: Number(form.settlementAmount || 0),
        notes: form.notes,
      });
      showToast('Contract terminated', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Contract closure</div>
      {(isCustomer || isAdmin) && (
        <>
          <div className="two-col-equal" style={{ gap: '0 12px' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Reason</div>
              <input className="form-input" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Settlement amount</div>
              <input className="form-input" type="number" value={form.settlementAmount} onChange={(event) => setForm((current) => ({ ...current, settlementAmount: event.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Effective end date</div>
            <input className="form-input" type="date" value={form.effectiveEndDate} onChange={(event) => setForm((current) => ({ ...current, effectiveEndDate: event.target.value }))} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Notes</div>
            <textarea className="form-input" rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {isCustomer && (
              <button className="btn btn-primary" onClick={handleRequest} disabled={createRequest.isPending || !form.reason.trim()}>
                Request closure
              </button>
            )}
            {isAdmin && (
              <button className="btn btn-ghost" style={{ color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={handleTerminate} disabled={terminateContract.isPending || !form.reason.trim()}>
                <XCircle size={13} /> Terminate contract
              </button>
            )}
          </div>
        </>
      )}

      {requests.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--bdr)', paddingTop: 12 }}>
          {requests.map((request) => (
            <div key={request.id} style={{ border: '1px solid var(--bdr)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{request.reason || 'Closure request'}</strong>
                <span>{request.status}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>{request.notes}</div>
              {isAdmin && request.status === 'pending' && (
                <>
                  <textarea className="form-input" rows={2} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Admin review notes" />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={() => reviewRequest.mutateAsync({ requestId: request.id, contractId: contract.id, status: 'approved', reviewNotes })}>
                      Approve request
                    </button>
                    <button className="btn btn-ghost" onClick={() => reviewRequest.mutateAsync({ requestId: request.id, contractId: contract.id, status: 'declined', reviewNotes })}>
                      Decline
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function P12AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isCustomer } = useAuth();
  const { showToast } = useAppContext();
  const { formatCurrency, formatDate, t } = useLocale();
  const { data: contract, isLoading: contractLoading } = useContract(id);
  const { data: schedule = [], isLoading: scheduleLoading } = usePaymentSchedule(id);
  const { data: signatures = [] } = useContractSignatures(id);
  const { data: closureRequests = [] } = useContractClosureRequests(id);
  const markPaid = useMarkPaymentPaid();
  const [payingPayment, setPayingPayment] = useState(null);

  if (contractLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!contract) return <div className="page-error">{t('portfolio.contractNotFound')}</div>;

  const originalCurrency = contract.deal?.original_currency_code || contract.deal?.reporting_currency_code || 'GBP';
  const backPath = isCustomer ? '/portal/dashboard' : '/portfolio';
  const backLabel = isCustomer ? `${String.fromCharCode(8592)} ${t('breadcrumb.dashboard')}` : `${String.fromCharCode(8592)} ${t('breadcrumb.portfolio')}`;
  const statusMeta = STATUS_META[contract.status] || STATUS_META.active;
  const paidPayments = schedule.filter((payment) => payment.status === 'paid').length;
  const progressPct = schedule.length ? Math.round((paidPayments / schedule.length) * 100) : 0;
  const totalPaid = schedule.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (payment.amount_paid || payment.amount || 0), 0);
  const totalExtraPrincipal = schedule.reduce((sum, payment) => sum + (payment.extra_principal || 0), 0);
  const outstanding = Math.max(0, (schedule.length - paidPayments) * (contract.monthly_payment || 0) - totalExtraPrincipal);

  const handleMarkPaid = async (paymentId) => {
    try {
      await markPaid.mutateAsync({ paymentId, contractId: id });
      showToast(t('portfolio.paymentMarkedPaid'), 'success');
    } catch (error) {
      showToast(error.message || t('portfolio.paymentMarkFailed'), 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => navigate(backPath)}>{backLabel}</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="page-title">{contract.customer_name}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusMeta.color, background: 'var(--bg)', border: `1px solid ${statusMeta.color}33`, borderRadius: 10, padding: '3px 8px' }}>
                {t(statusMeta.labelKey)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
              {contract.reference_number} - {contract.asset_description}
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {[
          { label: t('common.monthlyPayment'), value: formatCurrency(contract.monthly_payment || 0, originalCurrency) },
          { label: t('common.assetValue'), value: formatCurrency(contract.asset_value || 0, originalCurrency) },
          { label: t('portfolio.totalPaid'), value: formatCurrency(totalPaid, originalCurrency) },
          { label: t('portfolio.outstanding'), value: formatCurrency(outstanding, originalCurrency) },
        ].map((item) => (
          <div key={item.label} className="metric-card">
            <div className="metric-value" style={{ fontSize: 20 }}>{item.value}</div>
            <div className="metric-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{t('portfolio.contractDetails')}</div>
            {[
              [t('common.reference'), contract.reference_number],
              [t('common.asset'), contract.asset_description],
              [t('common.assetValue'), formatCurrency(contract.asset_value || 0, originalCurrency)],
              [t('common.term'), t('deals.months', { count: contract.term_months })],
              ['Lifecycle', contract.lifecycle_status || 'pending_signatures'],
              [t('portfolio.startDate'), contract.start_date ? formatDate(contract.start_date, { day: 'numeric', month: 'short', year: 'numeric' }) : t('common.none')],
              [t('portfolio.endDate'), contract.end_date ? formatDate(contract.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : t('common.none')],
              [t('portfolio.nextPayment'), contract.next_payment_date ? formatDate(contract.next_payment_date, { day: 'numeric', month: 'short', year: 'numeric' }) : t('common.none')],
              [t('portfolio.paymentsMade'), `${paidPayments} / ${schedule.length}`],
            ].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}
          </div>

          <SignatureCard
            contractId={id}
            signatures={signatures}
            canSign={isAdmin || isCustomer}
            signerLabel={isAdmin ? 'Admin' : isCustomer ? 'Customer' : 'Viewer'}
          />

          <ClosurePanel contract={contract} isAdmin={isAdmin} isCustomer={isCustomer} requests={closureRequests} />

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12 }}>{t('portfolio.agreementProgress')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
              <span>{t('portfolio.paymentsMadeCount', { count: paidPayments })}</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: statusMeta.dot, width: `${progressPct}%`, transition: '1s' }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{t('portfolio.paymentSchedule')}</div>
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('portfolio.paymentsCount', { count: schedule.length })}</span>
          </div>

          {scheduleLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><LoadingSpinner size={20} /></div>
          ) : schedule.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: 20 }}>{t('portfolio.noPaymentSchedule')}</div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('portfolio.dueDate')}</th>
                    <th style={{ textAlign: 'right' }}>{t('portfolio.amount')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('portfolio.paidOn')}</th>
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((payment) => {
                    const paymentMeta = PAYMENT_META[payment.status] || PAYMENT_META.upcoming;
                    const canMarkPaid = isAdmin && payment.status !== 'paid';
                    const canPayNow = isCustomer && payment.status !== 'paid' && payment.status !== 'cancelled';

                    return (
                      <tr key={payment.id}>
                        <td style={{ color: 'var(--tx4)', fontSize: 11 }}>{payment.payment_number}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(payment.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                          {formatCurrency(payment.amount || 0, originalCurrency)}
                          {payment.extra_principal > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 400 }}>
                              +{formatCurrency(payment.extra_principal, originalCurrency)} {t('portfolio.principal')}
                            </div>
                          )}
                        </td>
                        <td><span style={{ fontSize: 11, color: paymentMeta.color, fontWeight: 500 }}>{t(paymentMeta.labelKey)}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--tx4)' }}>
                          {payment.paid_at ? formatDate(payment.paid_at, { day: 'numeric', month: 'short' }) : t('common.none')}
                        </td>
                        <td>
                          {canMarkPaid && (
                            <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--green)' }} onClick={() => handleMarkPaid(payment.id)} disabled={markPaid.isPending}>
                              <CheckCircle size={10} /> {t('portfolio.paymentPaid')}
                            </button>
                          )}
                          {canPayNow && (
                            <button className="btn btn-primary" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => setPayingPayment(payment)}>
                              <CreditCard size={10} /> {t('portfolio.payNow')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {payingPayment && (
        <PayNowModal
          payment={payingPayment}
          contractId={id}
          schedule={schedule}
          currencyCode={originalCurrency}
          onClose={() => setPayingPayment(null)}
        />
      )}
    </div>
  );
}

function PayNowModal({ payment, contractId, schedule, currencyCode, onClose }) {
  const [payExtra, setPayExtra] = useState(false);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraError, setExtraError] = useState('');
  const payNow = useCustomerPayNow();
  const { showToast } = useAppContext();
  const { formatCurrency, formatDate, t } = useLocale();

  const dueAmount = payment.amount || 0;
  const extra = parseFloat(extraAmount) || 0;
  const totalAmount = dueAmount + (payExtra ? extra : 0);
  const remainingPayments = (schedule || []).filter((item) => item.status !== 'paid' && item.id !== payment.id);
  const remainingCount = remainingPayments.length;
  const currentRemainingTotal = remainingPayments.reduce((sum, item) => sum + (item.amount || 0), 0);
  const newRemainingTotal = Math.max(0, currentRemainingTotal - (payExtra ? extra : 0));
  const newMonthly = remainingCount > 0 ? Math.round((newRemainingTotal / remainingCount) * 100) / 100 : 0;
  const showImpact = payExtra && extra > 0 && remainingCount > 0;

  const handlePay = async () => {
    if (payExtra && extra <= 0) {
      setExtraError(t('portfolio.enterValidExtra'));
      return;
    }
    if (payExtra && extra > currentRemainingTotal && remainingCount > 0) {
      setExtraError(t('portfolio.maxExtra', { amount: formatCurrency(currentRemainingTotal, currencyCode) }));
      return;
    }
    try {
      await payNow.mutateAsync({
        paymentId: payment.id,
        contractId,
        amountPaid: totalAmount,
        extraPrincipal: payExtra ? extra : 0,
      });
      showToast(t('portfolio.paymentRecorded'), 'success');
      onClose();
    } catch (error) {
      showToast(error.message || t('portfolio.paymentFailed'), 'error');
    }
  };

  return (
    <div className="modal-bg show" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400, width: '100%' }}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={15} style={{ color: 'var(--coral)' }} />
          {t('portfolio.payInstalment', { count: payment.payment_number })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 3 }}>{t('portfolio.dueDate')}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {formatDate(payment.due_date, { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 'var(--rl)', padding: '12px 14px', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('portfolio.amountDue')}</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--coral)' }}>{formatCurrency(dueAmount, currencyCode)}</span>
        </div>

        <div style={{ background: payExtra ? 'var(--green-l)' : 'var(--bg)', border: `1px solid ${payExtra ? 'var(--green)' : 'var(--bdr)'}`, borderRadius: 'var(--rl)', padding: '12px 14px', marginBottom: 16, transition: '0.2s' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={payExtra}
              onChange={(event) => {
                setPayExtra(event.target.checked);
                setExtraAmount('');
                setExtraError('');
              }}
              style={{ marginTop: 2, width: 14, height: 14, accentColor: 'var(--green)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: payExtra ? 'var(--green)' : 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={13} /> {t('portfolio.payMoreReducePrincipal')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, lineHeight: 1.4 }}>
                {t('portfolio.extraApplied')}
              </div>
            </div>
          </label>

          {payExtra && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', marginBottom: 5 }}>
                {t('portfolio.extraAmount', { currency: currencyCode })}
              </div>
              <input
                className="form-input"
                type="number"
                min="1"
                step="1"
                placeholder="500"
                value={extraAmount}
                onChange={(event) => {
                  setExtraAmount(event.target.value);
                  setExtraError('');
                }}
                autoFocus
              />
              {extraError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{extraError}</div>}

              {showImpact && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--green-l)', border: '1px solid var(--green)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingDown size={11} /> {t('portfolio.impactRemainingPayments')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx2)', marginBottom: 3 }}>
                    <span>{t('portfolio.remainingInstalments')}</span>
                    <strong>{remainingCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx2)', marginBottom: 3 }}>
                    <span>{t('portfolio.currentMonthly')}</span>
                    <span style={{ textDecoration: extra > 0 ? 'line-through' : 'none', color: 'var(--tx3)' }}>
                      {formatCurrency(remainingPayments[0]?.amount || 0, currencyCode)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
                    <span>{t('portfolio.newMonthly')}</span>
                    <span>{formatCurrency(newMonthly, currencyCode)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--coral-l)', borderRadius: 'var(--rl)', marginBottom: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{t('portfolio.totalToPay')}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral)' }}>{formatCurrency(totalAmount, currencyCode)}</span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={payNow.isPending} style={{ minWidth: 150 }}>
            {payNow.isPending ? <LoadingSpinner size={13} /> : <CreditCard size={13} />}
            {t('portfolio.payAmount', { amount: formatCurrency(totalAmount, currencyCode) })}
          </button>
        </div>
      </div>
    </div>
  );
}
