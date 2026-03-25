import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Download, Plus, FileText, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { useContracts, usePortfolioStats, exportContractsCSV } from '../../hooks/useContracts';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const STATUS_META = {
  active:    { label: 'Active',    color: 'var(--green)',  bg: 'var(--green-l)' },
  overdue:   { label: 'Overdue',   color: 'var(--red)',    bg: 'var(--red-l)' },
  maturing:  { label: 'Maturing',  color: 'var(--amber)',  bg: 'var(--amber-l)' },
  completed: { label: 'Completed', color: 'var(--tx3)',    bg: 'var(--bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--tx4)',    bg: 'var(--bg)' },
};

export default function P10PortfolioDashboard() {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const { data: contracts = [], isLoading, error, refetch } = useContracts();
  const stats = usePortfolioStats(contracts);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');

  const filteredContracts = contracts
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      const q = search.toLowerCase();
      return !q ||
        c.customer_name?.toLowerCase().includes(q) ||
        c.reference_number?.toLowerCase().includes(q) ||
        c.asset_description?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'monthly_payment') return (b.monthly_payment || 0) - (a.monthly_payment || 0);
      if (sort === 'asset_value')     return (b.asset_value || 0) - (a.asset_value || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const handleExport = () => {
    exportContractsCSV(filteredContracts, [
      'reference_number', 'customer_name', 'asset_description',
      'asset_value', 'monthly_payment', 'term_months', 'start_date', 'end_date', 'status',
    ]);
    showToast('CSV exported', 'success');
  };

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  const kpis = [
    { label: 'Active contracts',     value: stats.active,    icon: <FileText size={18} />,    color: 'var(--green)' },
    { label: 'Overdue',              value: stats.overdue,   icon: <AlertCircle size={18} />, color: 'var(--red)' },
    { label: 'Maturing (90 days)',   value: stats.maturing,  icon: <Calendar size={18} />,    color: 'var(--amber)' },
    { label: 'Total portfolio value', value: `£${(stats.totalValue / 1000000).toFixed(2)}M`, icon: <TrendingUp size={18} />, color: 'var(--blue)' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Portfolio</div>
          <div className="page-sub">{contracts.length} contracts · Updated just now</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleExport}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-row">
        {kpis.map(kpi => (
          <div key={kpi.label} className="metric-card">
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters & search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ width: '100%', maxWidth: 240, height: 34, fontSize: 12 }}
          placeholder="Search customer, ref or asset…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'active', 'overdue', 'maturing', 'completed'].map(f => (
            <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 12px', height: 32 }}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select className="form-input" style={{ width: 140, height: 34, fontSize: 12 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="created_at">Latest first</option>
          <option value="monthly_payment">Monthly payment</option>
          <option value="asset_value">Asset value</option>
        </select>
      </div>

      {/* Table */}
      {error ? (
        <div className="page-error">Error loading portfolio: {error.message}</div>
      ) : filteredContracts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><FileText size={40} /></div>
            <div className="empty-state-title">{contracts.length === 0 ? 'No contracts yet' : 'No results'}</div>
            <div className="empty-state-sub">
              {contracts.length === 0
                ? 'Once you submit and get deals approved, contracts will appear here.'
                : 'Try adjusting your search or filters.'}
            </div>
            {contracts.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                <Plus size={14} /> Submit first deal
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="portfolio-table-wrap table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Asset</th>
                <th style={{ textAlign: 'right' }}>Monthly</th>
                <th style={{ textAlign: 'right' }}>Asset value</th>
                <th>Term</th>
                <th>Next payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map(c => {
                const sm = STATUS_META[c.status] || STATUS_META.active;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/portfolio/${c.id}`)}>
                    <td><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--coral)' }}>{c.reference_number}</span></td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{c.customer_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--tx3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.asset_description}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>£{(c.monthly_payment || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--tx3)', fontSize: 12 }}>£{(c.asset_value || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--tx3)' }}>{c.term_months}mo</td>
                    <td style={{ fontSize: 12 }}>
                      {c.next_payment_date ? new Date(c.next_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sm.color, background: sm.bg, borderRadius: 10, padding: '3px 8px' }}>
                        {sm.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
