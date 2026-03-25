import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Search, Phone, Mail, Building2, ChevronRight } from 'lucide-react';
import { useProspects } from '../../hooks/useProspects';
import { LoadingSpinner } from '../../components/shared/FormField';

const STAGE_META = {
  'New lead':    { label: 'New lead',    color: 'var(--tx3)',    bg: 'var(--bg)' },
  'Qualified':   { label: 'Qualified',   color: 'var(--blue)',   bg: 'var(--blue-l)' },
  'Proposal':    { label: 'Proposal',    color: 'var(--amber)',  bg: 'var(--amber-l)' },
  'Negotiation': { label: 'Negotiation', color: 'var(--coral)',  bg: 'var(--coral-l)' },
  'Won':         { label: 'Won',         color: 'var(--green)',  bg: 'var(--green-l)' },
  'Lost':        { label: 'Lost',        color: 'var(--red)',    bg: 'var(--red-l)' },
};

const SUMMARY_STAGES = ['New lead', 'Qualified', 'Proposal', 'Won'];

export default function P18ProspectList() {
  const navigate = useNavigate();
  const { data: prospects = [], isLoading, error } = useProspects();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const filtered = prospects
    .filter(p => stageFilter === 'all' || p.pipeline_stage === stageFilter)
    .filter(p => {
      const q = search.toLowerCase();
      return !q || p.contact_name?.toLowerCase().includes(q) || p.company_name?.toLowerCase().includes(q) || p.contact_email?.toLowerCase().includes(q);
    });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Prospects</div>
          <div className="page-sub">{prospects.length} contacts in your pipeline</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/crm/new')}>
          <Plus size={14} /> Add prospect
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {SUMMARY_STAGES.map(s => {
          const meta = STAGE_META[s];
          const count = prospects.filter(p => p.pipeline_stage === s).length;
          return (
            <div key={s} className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setStageFilter(stageFilter === s ? 'all' : s)}>
              <div style={{ color: meta.color }}><Users size={16} /></div>
              <div className="metric-value" style={{ color: meta.color }}>{count}</div>
              <div className="metric-label">{meta.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, width: 240, height: 34, padding: '0 10px' }}>
          <Search size={13} style={{ color: 'var(--tx4)', flexShrink: 0 }} />
          <input style={{ all: 'unset', flex: 1, fontSize: 12 }} placeholder="Search name, company or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...Object.keys(STAGE_META)].map(s => (
            <button key={s} className={`btn ${stageFilter === s ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '4px 12px', height: 32 }} onClick={() => setStageFilter(s)}>
              {s === 'all' ? 'All' : STAGE_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="page-loading"><LoadingSpinner size={24} /></div>
      ) : error ? (
        <div className="page-error">{error.message}</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><Users size={40} /></div>
            <div className="empty-state-title">{prospects.length === 0 ? 'No prospects yet' : 'No results'}</div>
            <div className="empty-state-sub">{prospects.length === 0 ? 'Add your first prospect to start building your pipeline.' : 'Try adjusting your search or filters.'}</div>
            {prospects.length === 0 && <button className="btn btn-primary" onClick={() => navigate('/crm/new')}><Plus size={14} /> Add prospect</button>}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((p, i) => {
            const meta = STAGE_META[p.pipeline_stage] || STAGE_META['New lead'];
            return (
              <div key={p.id} style={{
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--bdr)' : 'none',
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
              }} onClick={() => navigate(`/crm/${p.id}`)}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--coral-l)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'var(--coral)', flexShrink: 0,
                }}>
                  {p.contact_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{p.contact_name}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--tx3)', flexWrap: 'wrap' }}>
                    {p.company_name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={10} />{p.company_name}</span>}
                    {p.contact_email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{p.contact_email}</span>}
                    {p.contact_phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{p.contact_phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {p.estimated_value && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>£{p.estimated_value.toLocaleString()}</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 10, padding: '3px 8px' }}>{meta.label}</span>
                  <ChevronRight size={14} style={{ color: 'var(--tx4)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
