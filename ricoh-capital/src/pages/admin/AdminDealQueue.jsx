import { useState } from 'react';
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Building2, Wrench, CreditCard, Search, Send, Edit,
} from 'lucide-react';
import { useAllDeals, useApproveDeal, useRejectDeal, useRetryCustomerInvite, useSetDealUnderReview } from '../../hooks/useDeals';
import { useAllAmendments, useReviewAmendment } from '../../hooks/useAmendments';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const AMENDMENT_TYPE_LABELS = {
  term_extension:  'Term extension',
  payment_holiday: 'Payment holiday',
  settlement:      'Early settlement',
  rate_change:     'Rate change',
  other:           'Other variation',
};

function AmendmentCard({ amend }) {
  const { showToast } = useAppContext();
  const review = useReviewAmendment();
  const [notes, setNotes] = useState('');
  const isPending = amend.status === 'pending' || amend.status === 'under_review';

  const handle = async (status) => {
    try {
      await review.mutateAsync({ amendmentId: amend.id, status, adminNotes: notes });
      showToast(status === 'approved' ? 'Amendment approved' : 'Amendment declined', status === 'approved' ? 'success' : 'info');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const sm = { pending: { color: 'var(--blue)' }, under_review: { color: 'var(--amber)' }, approved: { color: 'var(--green)' }, rejected: { color: 'var(--red)' } };
  const color = sm[amend.status]?.color || 'var(--tx3)';

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{AMENDMENT_TYPE_LABELS[amend.amendment_type] || amend.amendment_type}</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
            {amend.deal?.reference_number} · {amend.deal?.customer_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 1 }}>
            Requested by {amend.requester?.company_name || amend.requester?.full_name} · {new Date(amend.created_at).toLocaleDateString('en-GB')}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color, padding: '3px 10px', borderRadius: 99, background: color + '18' }}>
          {amend.status.replace('_', ' ')}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6, marginBottom: 12 }}>{amend.description}</div>
      {isPending && (
        <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 12 }}>
          <textarea className="form-input" rows={2} style={{ fontSize: 12, resize: 'vertical', marginBottom: 10 }}
            placeholder="Decision notes (optional)…" value={notes} onChange={e => setNotes(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => handle('approved')} disabled={review.isPending}>
              <CheckCircle size={12} /> Approve
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-m)' }} onClick={() => handle('rejected')} disabled={review.isPending}>
              <XCircle size={12} /> Decline
            </button>
          </div>
        </div>
      )}
      {!isPending && amend.admin_notes && (
        <div style={{ fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bdr)', paddingTop: 10 }}>Notes: {amend.admin_notes}</div>
      )}
    </div>
  );
}

const STATUS_META = {
  submitted:    { label: 'Submitted',  color: 'var(--blue)',  bg: 'var(--blue-l)' },
  under_review: { label: 'In review',  color: 'var(--amber)', bg: 'var(--amber-l)' },
  approved:     { label: 'Approved',   color: 'var(--green)', bg: 'var(--green-l)' },
  rejected:     { label: 'Declined',   color: 'var(--red)',   bg: 'var(--red-l)' },
  draft:        { label: 'Draft',      color: 'var(--tx4)',   bg: 'var(--bg)' },
};

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingBottom: 5, borderBottom: '1px solid var(--bdr)', marginBottom: 5 }}>
      <span style={{ color: 'var(--tx4)' }}>{label}</span>
      <span style={{ fontWeight: 500, maxWidth: 200, textAlign: 'right', color: 'var(--tx2)' }}>{value}</span>
    </div>
  );
}

function DealCard({ deal }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(deal.admin_notes || '');
  const [startDate, setStartDate] = useState('');
  const [customerEmail, setCustomerEmail] = useState(deal.customer_email || '');
  const approve = useApproveDeal();
  const reject = useRejectDeal();
  const retryInvite = useRetryCustomerInvite();
  const setUnderReview = useSetDealUnderReview();
  const { showToast } = useAppContext();

  const sm = STATUS_META[deal.status] || STATUS_META.submitted;
  const originator = deal.originator || {};
  const canDecide = deal.status === 'submitted' || deal.status === 'under_review';

  const handleApprove = async () => {
    try {
      const result = await approve.mutateAsync({ dealId: deal.id, adminNotes: notes, startDate, customerEmail });
      if (result?.customerEmail && !result?.customerInviteSent) {
        showToast(
          `Deal approved, but invite email failed: ${result.customerInviteError || 'Unknown invite error'}`,
          'warning'
        );
      } else {
        showToast(
          result?.customerEmail
            ? 'Deal approved — contract created & customer invited'
            : 'Deal approved — contract created',
          'success'
        );
      }
    } catch (err) {
      console.error('Approve deal failed:', err);
      showToast(err.message, 'error');
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) { showToast('Please provide a reason for declining this deal', 'warning'); return; }
    try {
      await reject.mutateAsync({ dealId: deal.id, adminNotes: notes });
      showToast('Deal declined — originator notified', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleMarkUnderReview = async () => {
    try {
      await setUnderReview.mutateAsync(deal.id);
      showToast('Deal marked as in review', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleRetryInvite = async () => {
    if (!customerEmail?.trim()) {
      showToast('Please enter a customer email before sending invite', 'warning');
      return;
    }
    try {
      await retryInvite.mutateAsync({ dealId: deal.id, customerEmail: customerEmail.trim() });
      showToast(`Customer invite sent to ${customerEmail.trim()}`, 'success');
    } catch (err) {
      console.error('Retry customer invite failed:', err);
      showToast(err.message, 'error');
    }
  };

  const isPending = approve.isPending || reject.isPending || retryInvite.isPending || setUnderReview.isPending;

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{deal.customer_name}</div>
            <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: sm.bg, borderRadius: 99, padding: '2px 8px' }}>{sm.label}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--coral)' }}>{deal.reference_number}</span>
            <span>{deal.product_type}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Building2 size={10} /> {originator.company_name || originator.email || 'Unknown originator'}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--coral)' }}>£{(deal.monthly_payment || 0).toLocaleString()}/mo</div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>£{(deal.asset_value || 0).toLocaleString()} asset</div>
        </div>
        <div style={{ color: 'var(--tx4)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--bdr)', padding: '18px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
            {/* Client */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={11} /> Client
              </div>
              <Row label="Name" value={deal.customer_name} />
              <Row label="Product" value={deal.product_type} />
              <Row label="Your ref" value={deal.originator_reference} />
              <Row label="Start date" value={deal.preferred_start_date ? new Date(deal.preferred_start_date).toLocaleDateString('en-GB') : null} />
              {deal.notes && <Row label="Notes" value={deal.notes} />}
            </div>

            {/* Asset */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wrench size={11} /> Asset
              </div>
              <Row label="Type" value={deal.asset_type} />
              <Row label="Make" value={deal.asset_make} />
              <Row label="Model" value={deal.asset_model} />
              <Row label="Year" value={deal.asset_year} />
              <Row label="Value" value={`£${(deal.asset_value || 0).toLocaleString()}`} />
            </div>

            {/* Finance */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--tx4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CreditCard size={11} /> Finance
              </div>
              <Row label="Monthly" value={`£${(deal.monthly_payment || 0).toLocaleString()}`} />
              <Row label="Term" value={`${deal.term_months} months`} />
              <Row label="Deposit" value={deal.deposit ? `£${deal.deposit.toLocaleString()}` : 'None'} />
              <Row label="Balloon" value={deal.balloon ? `£${deal.balloon.toLocaleString()}` : 'None'} />
              <Row label="APR" value={`${deal.apr}%`} />
              <Row label="Rate type" value={deal.rate_type} />
              <Row label="Total payable" value={`£${(deal.total_payable || 0).toLocaleString()}`} />
            </div>
          </div>

          {/* Originator info */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: '10px 14px', marginBottom: 16, fontSize: 11, color: 'var(--tx3)' }}>
            Submitted by <strong style={{ color: 'var(--tx)' }}>{originator.company_name || '—'}</strong>
            {originator.full_name && ` · ${originator.full_name}`}
            {originator.email && ` · ${originator.email}`}
            {deal.created_at && ` · ${new Date(deal.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </div>

          {canDecide && (
            <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Credit decision</div>

              {deal.status === 'submitted' && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, marginBottom: 12 }}
                  onClick={handleMarkUnderReview}
                  disabled={isPending}
                >
                  <Clock size={12} /> Mark as in review
                </button>
              )}

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>
                  Decision notes (required for decline, optional for approval)
                </label>
                <textarea
                  className="form-input"
                  style={{ height: 72, fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="e.g. Approved subject to direct debit setup. / Declined due to insufficient trading history."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>
                    Contract start date (leave blank to use today)
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: 12 }}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>
                    Customer portal invite email
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ fontSize: 12 }}
                    placeholder={deal.customer_email || 'customer@example.com'}
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                  />
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 3 }}>
                    Sends a portal invite email on approval
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
                  onClick={handleApprove}
                  disabled={isPending}
                >
                  {approve.isPending ? <LoadingSpinner size={12} /> : <CheckCircle size={13} />}
                  Approve & create contract
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ color: 'var(--red)', border: '1px solid var(--red-m)' }}
                  onClick={handleReject}
                  disabled={isPending}
                >
                  {reject.isPending ? <LoadingSpinner size={12} /> : <XCircle size={13} />}
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Closed deal info */}
          {!canDecide && deal.admin_notes && (
            <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', marginBottom: 4 }}>Decision notes</div>
              <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{deal.admin_notes}</div>
            </div>
          )}

          {deal.status === 'approved' && (
            <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 14, marginTop: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Customer portal invite</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 4 }}>
                    Invite email
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    style={{ fontSize: 12 }}
                    placeholder={deal.customer_email || 'customer@example.com'}
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleRetryInvite}
                  disabled={isPending}
                >
                  {retryInvite.isPending ? <LoadingSpinner size={12} /> : <Send size={13} />}
                  Invite customer again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDealQueue() {
  const [tab, setTab] = useState('deals');
  const [filter, setFilter] = useState('submitted');
  const [search, setSearch] = useState('');
  const [amendFilter, setAmendFilter] = useState('pending');
  const { data: deals = [], isLoading, error } = useAllDeals();
  const { data: amendments = [], isLoading: amendLoading } = useAllAmendments();

  const filtered = deals
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => {
      const q = search.toLowerCase();
      return !q
        || d.customer_name?.toLowerCase().includes(q)
        || d.reference_number?.toLowerCase().includes(q)
        || d.originator?.company_name?.toLowerCase().includes(q);
    });

  const counts = Object.fromEntries(
    ['submitted', 'under_review', 'approved', 'rejected'].map(s => [s, deals.filter(d => d.status === s).length])
  );

  const pendingAmendments = amendments.filter(a => a.status === 'pending' || a.status === 'under_review');
  const filteredAmendments = amendFilter === 'all' ? amendments : amendments.filter(a => a.status === amendFilter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Deal review queue</div>
          <div className="page-sub">
            {counts.submitted + counts.under_review} deal{counts.submitted + counts.under_review !== 1 ? 's' : ''} awaiting decision
            {pendingAmendments.length > 0 && ` · ${pendingAmendments.length} amendment${pendingAmendments.length !== 1 ? 's' : ''} pending`}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--bdr)', paddingBottom: 0 }}>
        {[
          { key: 'deals',      label: 'Deal decisions', count: counts.submitted + counts.under_review },
          { key: 'amendments', label: 'Amendment requests', count: pendingAmendments.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--coral)' : 'var(--tx3)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--coral)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ background: t.key === 'deals' ? 'var(--blue-l)' : 'var(--amber-l)', color: t.key === 'deals' ? 'var(--blue)' : 'var(--amber)', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Deals tab ── */}
      {tab === 'deals' && (
        <>
          {/* Status summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { key: 'submitted',    label: 'New',       color: 'var(--blue)' },
              { key: 'under_review', label: 'In review', color: 'var(--amber)' },
              { key: 'approved',     label: 'Approved',  color: 'var(--green)' },
              { key: 'rejected',     label: 'Declined',  color: 'var(--red)' },
            ].map(({ key, label, color }) => (
              <div
                key={key}
                className="metric-card"
                style={{ cursor: 'pointer', outline: filter === key ? `2px solid ${color}` : undefined }}
                onClick={() => setFilter(filter === key ? 'all' : key)}
              >
                <div className="metric-value" style={{ color }}>{counts[key] || 0}</div>
                <div className="metric-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260, height: 34, padding: '0 10px' }}>
              <Search size={13} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
              <input style={{ all: 'unset', flex: 1, fontSize: 12 }} placeholder="Search customer, ref, or originator…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'submitted', 'under_review', 'approved', 'rejected'].map(s => (
                <button key={s} className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '4px 12px', height: 32 }} onClick={() => setFilter(s)}>
                  {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {isLoading && <div className="page-loading"><LoadingSpinner size={24} /></div>}
          {error && <div className="page-error">{error.message}</div>}

          {!isLoading && filtered.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><Send size={40} /></div>
                <div className="empty-state-title">No deals here</div>
                <div className="empty-state-sub">Submitted deals from originators will appear here for credit review.</div>
              </div>
            </div>
          ) : (
            filtered.map(d => <DealCard key={d.id} deal={d} />)
          )}
        </>
      )}

      {/* ── Amendments tab ── */}
      {tab === 'amendments' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['pending', 'under_review', 'approved', 'rejected', 'all'].map(s => (
              <button key={s} className={`btn ${amendFilter === s ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '4px 12px', height: 32 }} onClick={() => setAmendFilter(s)}>
                {s === 'all' ? 'All' : s === 'under_review' ? 'In review' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {amendLoading && <div className="page-loading"><LoadingSpinner size={24} /></div>}

          {!amendLoading && filteredAmendments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><Edit size={40} /></div>
                <div className="empty-state-title">No amendment requests</div>
                <div className="empty-state-sub">When originators request deal variations, they appear here.</div>
              </div>
            </div>
          ) : (
            filteredAmendments.map(a => <AmendmentCard key={a.id} amend={a} />)
          )}
        </>
      )}
    </div>
  );
}
