import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, CreditCard, TrendingDown } from 'lucide-react';
import { useContract, usePaymentSchedule, useMarkPaymentPaid, useCancelContract, useCustomerPayNow } from '../../hooks/useContracts';
import { useAuth } from '../../auth/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const STATUS_META = {
  active:     { label: 'Active',    color: 'var(--green)',  dot: '#22c55e' },
  overdue:    { label: 'Overdue',   color: 'var(--red)',    dot: '#ef4444' },
  maturing:   { label: 'Maturing',  color: 'var(--amber)',  dot: '#f59e0b' },
  completed:  { label: 'Completed', color: 'var(--tx3)',    dot: 'var(--tx4)' },
  cancelled:  { label: 'Cancelled', color: 'var(--tx4)',    dot: 'var(--tx4)' },
};

const PAYMENT_META = {
  upcoming:  { label: 'Upcoming',  color: 'var(--tx3)' },
  due_soon:  { label: 'Due soon',  color: 'var(--amber)' },
  paid:      { label: 'Paid',      color: 'var(--green)' },
  overdue:   { label: 'Overdue',   color: 'var(--red)' },
};

export default function P12AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isCustomer } = useAuth();
  const { showToast } = useAppContext();
  const { data: contract, isLoading: contractLoading } = useContract(id);
  const { data: schedule = [], isLoading: scheduleLoading } = usePaymentSchedule(id);
  const markPaid = useMarkPaymentPaid();
  const cancelContract = useCancelContract();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [payingPayment, setPayingPayment] = useState(null);

  if (contractLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!contract) return <div className="page-error">Contract not found.</div>;

  const backPath = isCustomer ? '/portal/dashboard' : '/portfolio';
  const backLabel = isCustomer ? '← Dashboard' : '← Portfolio';

  const sm = STATUS_META[contract.status] || STATUS_META.active;
  const paidPayments = schedule.filter(p => p.status === 'paid').length;
  const progressPct = schedule.length ? Math.round((paidPayments / schedule.length) * 100) : 0;
  const totalPaid = schedule.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount_paid || p.amount || 0), 0);
  const totalExtraPrincipal = schedule.reduce((s, p) => s + (p.extra_principal || 0), 0);
  const outstanding = Math.max(0, (schedule.length - paidPayments) * (contract.monthly_payment || 0) - totalExtraPrincipal);

  const handleMarkPaid = async (paymentId) => {
    try {
      await markPaid.mutateAsync({ paymentId, contractId: id });
      showToast('Payment marked as paid', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to mark payment', 'error');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelContract.mutateAsync(id);
      showToast('Contract cancelled', 'success');
      setCancelConfirm(false);
    } catch (err) {
      showToast(err.message || 'Failed to cancel contract', 'error');
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
              <span style={{ fontSize: 11, fontWeight: 600, color: sm.color, background: 'var(--bg)', border: `1px solid ${sm.color}33`, borderRadius: 10, padding: '3px 8px' }}>
                {sm.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
              {contract.reference_number} · {contract.asset_description}
            </div>
          </div>
        </div>

        {/* Admin: cancel contract */}
        {isAdmin && contract.status !== 'cancelled' && contract.status !== 'completed' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {cancelConfirm ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--red)' }}>Confirm cancel?</span>
                <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={handleCancel} disabled={cancelContract.isPending}>
                  <XCircle size={12} /> Yes, cancel
                </button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setCancelConfirm(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={() => setCancelConfirm(true)}>
                <XCircle size={12} /> Cancel contract
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        {[
          { label: 'Monthly payment', value: `£${(contract.monthly_payment || 0).toLocaleString()}` },
          { label: 'Asset value', value: `£${(contract.asset_value || 0).toLocaleString()}` },
          { label: 'Total paid', value: `£${totalPaid.toLocaleString()}` },
          { label: 'Outstanding', value: `£${outstanding.toLocaleString()}` },
        ].map(k => (
          <div key={k.label} className="metric-card">
            <div className="metric-value" style={{ fontSize: 20 }}>{k.value}</div>
            <div className="metric-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        {/* Left: contract details */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Contract Details</div>
            {[
              ['Reference', contract.reference_number],
              ['Asset', contract.asset_description],
              ['Asset value', `£${(contract.asset_value || 0).toLocaleString()}`],
              ['Term', `${contract.term_months} months`],
              ['Start date', contract.start_date ? new Date(contract.start_date).toLocaleDateString('en-GB') : '—'],
              ['End date', contract.end_date ? new Date(contract.end_date).toLocaleDateString('en-GB') : '—'],
              ['Next payment', contract.next_payment_date ? new Date(contract.next_payment_date).toLocaleDateString('en-GB') : '—'],
              ['Payments made', `${paidPayments} of ${schedule.length}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid var(--bdr)', marginBottom: 6 }}>
                <span style={{ color: 'var(--tx3)' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 12 }}>Agreement progress</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
              <span>{paidPayments} payments made</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: sm.dot, width: `${progressPct}%`, transition: '1s' }} />
            </div>
          </div>
        </div>

        {/* Right: payment schedule */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Payment schedule</div>
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{schedule.length} payments</span>
          </div>

          {scheduleLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><LoadingSpinner size={20} /></div>
          ) : schedule.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--tx4)', textAlign: 'center', padding: 20 }}>
              No payment schedule found
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due date</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(p => {
                    const pm = PAYMENT_META[p.status] || PAYMENT_META.upcoming;
                    const canMarkPaid = isAdmin && p.status !== 'paid';
                    const canPayNow = isCustomer && p.status !== 'paid';
                    return (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--tx4)', fontSize: 11 }}>{p.payment_number}</td>
                        <td style={{ fontSize: 12 }}>{new Date(p.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                          £{(p.amount || 0).toLocaleString()}
                          {(p.extra_principal > 0) && (
                            <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 400 }}>
                              +£{p.extra_principal.toLocaleString()} principal
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, color: pm.color, fontWeight: 500 }}>{pm.label}</span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--tx4)' }}>
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td>
                          {canMarkPaid && (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 10, padding: '2px 8px', color: 'var(--green)' }}
                              onClick={() => handleMarkPaid(p.id)}
                              disabled={markPaid.isPending}
                            >
                              <CheckCircle size={10} /> Paid
                            </button>
                          )}
                          {canPayNow && (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 10, padding: '3px 10px' }}
                              onClick={() => setPayingPayment(p)}
                            >
                              <CreditCard size={10} /> Pay now
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
          onClose={() => setPayingPayment(null)}
        />
      )}
    </div>
  );
}

function PayNowModal({ payment, contractId, schedule, onClose }) {
  const [payExtra, setPayExtra] = useState(false);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraError, setExtraError] = useState('');
  const payNow = useCustomerPayNow();
  const { showToast } = useAppContext();

  const dueAmount = payment.amount || 0;
  const extra = parseFloat(extraAmount) || 0;
  const totalAmount = dueAmount + (payExtra ? extra : 0);

  // Remaining payments after this one (exclude current + already paid)
  const remainingPayments = (schedule || []).filter(p => p.status !== 'paid' && p.id !== payment.id);
  const remainingCount = remainingPayments.length;
  const currentRemainingTotal = remainingPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const newRemainingTotal = Math.max(0, currentRemainingTotal - (payExtra ? extra : 0));
  const newMonthly = remainingCount > 0 ? Math.round((newRemainingTotal / remainingCount) * 100) / 100 : 0;
  const showImpact = payExtra && extra > 0 && remainingCount > 0;

  const handlePay = async () => {
    if (payExtra && extra <= 0) {
      setExtraError('Enter a valid extra amount greater than zero');
      return;
    }
    if (payExtra && extra > currentRemainingTotal && remainingCount > 0) {
      setExtraError(`Maximum extra is £${currentRemainingTotal.toLocaleString()} (full remaining balance)`);
      return;
    }
    try {
      await payNow.mutateAsync({
        paymentId: payment.id,
        contractId,
        amountPaid: totalAmount,
        extraPrincipal: payExtra ? extra : 0,
      });
      showToast('Payment recorded successfully', 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Payment failed. Please try again.', 'error');
    }
  };

  return (
    <div className="modal-bg show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400, width: '100%' }}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={15} style={{ color: 'var(--coral)' }} />
          Pay instalment #{payment.payment_number}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 3 }}>Due date</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {new Date(payment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Amount due */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg)', border: '1px solid var(--bdr)',
          borderRadius: 'var(--rl)', padding: '12px 14px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Amount due</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--coral)' }}>
            £{dueAmount.toLocaleString()}
          </span>
        </div>

        {/* Pay extra toggle */}
        <div style={{
          background: payExtra ? 'var(--green-l)' : 'var(--bg)',
          border: `1px solid ${payExtra ? 'var(--green)' : 'var(--bdr)'}`,
          borderRadius: 'var(--rl)', padding: '12px 14px', marginBottom: 16, transition: '0.2s',
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={payExtra}
              onChange={e => { setPayExtra(e.target.checked); setExtraAmount(''); setExtraError(''); }}
              style={{ marginTop: 2, width: 14, height: 14, accentColor: 'var(--green)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: payExtra ? 'var(--green)' : 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={13} /> Pay more to reduce principal
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, lineHeight: 1.4 }}>
                Any extra amount is applied directly off your outstanding balance
              </div>
            </div>
          </label>

          {payExtra && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', marginBottom: 5 }}>
                Extra amount (£)
              </div>
              <input
                className="form-input"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 500"
                value={extraAmount}
                onChange={e => { setExtraAmount(e.target.value); setExtraError(''); }}
                autoFocus
              />
              {extraError && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{extraError}</div>
              )}

              {/* Live impact preview */}
              {showImpact && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'var(--green-l)', border: '1px solid var(--green)',
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <TrendingDown size={11} /> Impact on remaining payments
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx2)', marginBottom: 3 }}>
                    <span>Remaining instalments</span>
                    <strong>{remainingCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx2)', marginBottom: 3 }}>
                    <span>Current monthly</span>
                    <span style={{ textDecoration: extra > 0 ? 'line-through' : 'none', color: 'var(--tx3)' }}>
                      £{(remainingPayments[0]?.amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
                    <span>New monthly</span>
                    <span>£{newMonthly.toLocaleString()}</span>
                  </div>
                  {extra >= currentRemainingTotal && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
                      Extra amount clears the remaining balance entirely
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'var(--coral-l)',
          borderRadius: 'var(--rl)', marginBottom: 20,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Total to pay</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--coral)' }}>
            £{totalAmount.toLocaleString()}
          </span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handlePay}
            disabled={payNow.isPending}
            style={{ minWidth: 150 }}
          >
            {payNow.isPending ? <LoadingSpinner size={13} /> : <CreditCard size={13} />}
            Pay £{totalAmount.toLocaleString()}
          </button>
        </div>
      </div>
    </div>
  );
}
