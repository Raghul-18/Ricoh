import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Clock, CheckCircle, XCircle, Send, ChevronRight, RefreshCw } from 'lucide-react';
import { useDeals } from '../../hooks/useDeals';
import { LoadingSpinner } from '../../components/shared/FormField';

const STATUS_META = {
  draft:        { label: 'Draft',        color: 'var(--tx3)',   bg: 'var(--bg)',        icon: <FileText size={12} /> },
  submitted:    { label: 'Submitted',    color: 'var(--blue)',  bg: 'var(--blue-l)',    icon: <Send size={12} /> },
  under_review: { label: 'In review',    color: 'var(--amber)', bg: 'var(--amber-l)',   icon: <Clock size={12} /> },
  approved:     { label: 'Approved',     color: 'var(--green)', bg: 'var(--green-l)',   icon: <CheckCircle size={12} /> },
  rejected:     { label: 'Not approved', color: 'var(--red)',   bg: 'var(--red-l)',     icon: <XCircle size={12} /> },
};

export default function MyDealsPage() {
  const navigate = useNavigate();
  const { data: deals = [], isLoading, error, refetch } = useDeals();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = deals
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => {
      const q = search.toLowerCase();
      return !q
        || d.customer_name?.toLowerCase().includes(q)
        || d.reference_number?.toLowerCase().includes(q)
        || d.originator_reference?.toLowerCase().includes(q);
    });

  const counts = Object.fromEntries(
    ['submitted', 'under_review', 'approved', 'rejected'].map(s => [s, deals.filter(d => d.status === s).length])
  );

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My Deals</div>
          <div className="page-sub">{deals.length} deal{deals.length !== 1 ? 's' : ''} submitted</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'submitted',    label: 'Submitted',  color: 'var(--blue)' },
          { key: 'under_review', label: 'In review',  color: 'var(--amber)' },
          { key: 'approved',     label: 'Approved',   color: 'var(--green)' },
          { key: 'rejected',     label: 'Declined',   color: 'var(--red)' },
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ width: 240, height: 34, fontSize: 12 }}
          placeholder="Search customer or reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...Object.keys(STATUS_META)].map(s => (
            <button
              key={s}
              className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 12px', height: 32 }}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="page-error">{error.message}</div>}

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><FileText size={40} /></div>
            <div className="empty-state-title">{deals.length === 0 ? 'No deals yet' : 'No results'}</div>
            <div className="empty-state-sub">
              {deals.length === 0
                ? 'Submit your first deal to start building your pipeline.'
                : 'Try adjusting your search or filter.'}
            </div>
            {deals.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                <Plus size={14} /> Submit a deal
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((d, i) => {
            const sm = STATUS_META[d.status] || STATUS_META.submitted;
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--bdr)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/deals/${d.id}`)}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                  <FileText size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{d.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--coral)' }}>{d.reference_number}</span>
                    <span>{d.product_type}</span>
                    {d.originator_reference && <span>Ref: {d.originator_reference}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>£{(d.monthly_payment || 0).toLocaleString()}/mo</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: sm.color, background: sm.bg,
                      borderRadius: 99, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {sm.icon} {sm.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 3 }}>
                    {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
