import { useNavigate } from 'react-router-dom';
import { Plus, FileText, ChevronRight, Clock, CheckCircle, Send } from 'lucide-react';
import { useQuotes } from '../../hooks/useQuotes';
import { LoadingSpinner } from '../../components/shared/FormField';

const STATUS_META = {
  draft:    { label: 'Draft',    color: 'var(--tx3)',   bg: 'var(--bg)',        icon: <Clock size={12} /> },
  sent:     { label: 'Sent',     color: 'var(--blue)',  bg: 'var(--blue-l)',    icon: <Send size={12} /> },
  accepted: { label: 'Accepted', color: 'var(--green)', bg: 'var(--green-l)',   icon: <CheckCircle size={12} /> },
  expired:  { label: 'Expired',  color: 'var(--red)',   bg: 'var(--red-l)',     icon: <Clock size={12} /> },
};

export default function QuotesListPage() {
  const navigate = useNavigate();
  const { data: quotes = [], isLoading, error } = useQuotes();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Quotes</div>
          <div className="page-sub">{quotes.length} quotes</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>
          <Plus size={14} /> New quote
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
            <div className="empty-state-title">No quotes yet</div>
            <div className="empty-state-sub">Build your first multi-scenario quote for a prospect.</div>
            <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}><Plus size={14} /> New quote</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {quotes.map((q, i) => {
            const meta = STATUS_META[q.status] || STATUS_META.draft;
            return (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: i < quotes.length - 1 ? '1px solid var(--bdr)' : 'none',
                cursor: 'pointer',
              }} onClick={() => navigate(`/quotes/${q.id}`)}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', flexShrink: 0 }}>
                  <FileText size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{q.prospect_name || 'Quote'}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                    {q.reference_number} · {q.scenarios?.length || 0} scenario{q.scenarios?.length !== 1 ? 's' : ''}
                    {q.asset_description ? ` · ${q.asset_description}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {q.asset_value && <div style={{ fontWeight: 700, fontSize: 13 }}>£{q.asset_value.toLocaleString()}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, background: meta.bg, borderRadius: 8, padding: '2px 7px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 2 }}>
                    {new Date(q.created_at).toLocaleDateString('en-GB')}
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
