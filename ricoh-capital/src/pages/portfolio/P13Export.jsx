import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useContracts, exportContractsCSV } from '../../hooks/useContracts';
import { useDeals } from '../../hooks/useDeals';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const CONTRACT_FIELDS = [
  { key: 'reference_number',  label: 'Contract ref' },
  { key: 'customer_name',     label: 'Customer' },
  { key: 'asset_description', label: 'Asset' },
  { key: 'asset_value',       label: 'Asset value' },
  { key: 'monthly_payment',   label: 'Monthly payment' },
  { key: 'term_months',       label: 'Term (months)' },
  { key: 'start_date',        label: 'Start date' },
  { key: 'end_date',          label: 'End date' },
  { key: 'status',            label: 'Status' },
  { key: 'next_payment_date', label: 'Next payment' },
];

const DEAL_FIELDS = [
  { key: 'reference_number',     label: 'Deal ref' },
  { key: 'customer_name',        label: 'Customer' },
  { key: 'product_type',         label: 'Product' },
  { key: 'asset_value',          label: 'Asset value' },
  { key: 'monthly_payment',      label: 'Monthly payment' },
  { key: 'term_months',          label: 'Term (months)' },
  { key: 'status',               label: 'Status' },
  { key: 'originator_reference', label: 'Your reference' },
  { key: 'created_at',           label: 'Submitted date' },
];

export default function P13Export() {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const { data: contracts = [], isLoading: contractsLoading } = useContracts();
  const { data: deals = [], isLoading: dealsLoading } = useDeals();

  const [exportType, setExportType] = useState('contracts');
  const [selectedFields, setSelectedFields] = useState(
    new Set(CONTRACT_FIELDS.slice(0, 6).map(f => f.key))
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isLoading = contractsLoading || dealsLoading;

  const toggleField = (key) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleExportTypeChange = (type) => {
    setExportType(type);
    const fields = type === 'contracts' ? CONTRACT_FIELDS : DEAL_FIELDS;
    setSelectedFields(new Set(fields.slice(0, 6).map(f => f.key)));
    setStatusFilter('all');
  };

  const getFilteredData = () => {
    const source = exportType === 'contracts' ? contracts : deals;
    return source.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (dateFrom && new Date(item.created_at || item.start_date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(item.created_at || item.start_date) > new Date(dateTo)) return false;
      return true;
    });
  };

  const handleExport = () => {
    const data = getFilteredData();
    if (!data.length) { showToast('No records match your filters', 'warning'); return; }
    if (!selectedFields.size) { showToast('Please select at least one field', 'warning'); return; }

    exportContractsCSV(data, [...selectedFields]);
    showToast(`Exported ${data.length} ${exportType} to CSV`, 'success');
  };

  const currentFields = exportType === 'contracts' ? CONTRACT_FIELDS : DEAL_FIELDS;
  const statusOptions = exportType === 'contracts'
    ? ['all', 'active', 'overdue', 'maturing', 'completed', 'cancelled']
    : ['all', 'submitted', 'under_review', 'approved', 'rejected'];

  const filteredCount = getFilteredData().length;

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/portfolio')}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="page-title">Export data</div>
            <div className="page-sub">Download your portfolio or deal data as CSV</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: config */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>What to export</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['contracts', 'Contracts'], ['deals', 'Deals']].map(([val, label]) => (
                <button
                  key={val}
                  className={`btn ${exportType === val ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                  onClick={() => handleExportTypeChange(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', marginBottom: 8 }}>Filter by status</div>
              <select className="form-input" style={{ fontSize: 12 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx3)', marginBottom: 8 }}>Date range (by created date)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="date" className="form-input" style={{ fontSize: 12 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <input type="date" className="form-input" style={{ fontSize: 12 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Fields to include</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentFields.map(f => (
                <button
                  key={f.key}
                  onClick={() => toggleField(f.key)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 99, border: '1px solid',
                    cursor: 'pointer', fontWeight: selectedFields.has(f.key) ? 700 : 400,
                    background: selectedFields.has(f.key) ? 'var(--coral)' : 'var(--bg)',
                    color: selectedFields.has(f.key) ? '#fff' : 'var(--tx3)',
                    borderColor: selectedFields.has(f.key) ? 'var(--coral)' : 'var(--bdr)',
                    transition: 'all .12s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: preview + download */}
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Export preview</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: 'var(--tx3)' }}>Records to export</span>
              <span style={{ fontWeight: 700, color: filteredCount > 0 ? 'var(--coral)' : 'var(--tx4)' }}>{filteredCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ color: 'var(--tx3)' }}>Fields selected</span>
              <span style={{ fontWeight: 700 }}>{selectedFields.size}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 16 }}>
              <span style={{ color: 'var(--tx3)' }}>Format</span>
              <span style={{ fontWeight: 700 }}>CSV</span>
            </div>

            {/* Column preview */}
            {selectedFields.size > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--rl)', padding: '8px 12px', marginBottom: 16, overflowX: 'auto' }}>
                <div style={{ fontSize: 10, color: 'var(--tx4)', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                  {[...selectedFields].map(k => currentFields.find(f => f.key === k)?.label || k).join(', ')}
                </div>
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 40 }}
              onClick={handleExport}
              disabled={filteredCount === 0 || selectedFields.size === 0}
            >
              <Download size={14} /> Download CSV ({filteredCount} records)
            </button>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Quick exports</div>
            {[
              {
                label: 'All active contracts',
                sub: `${contracts.filter(c => c.status === 'active').length} records`,
                action: () => {
                  exportContractsCSV(
                    contracts.filter(c => c.status === 'active'),
                    ['reference_number', 'customer_name', 'asset_description', 'monthly_payment', 'next_payment_date']
                  );
                  showToast('Exported active contracts', 'success');
                },
              },
              {
                label: 'All submitted deals',
                sub: `${deals.filter(d => ['submitted', 'under_review'].includes(d.status)).length} records`,
                action: () => {
                  exportContractsCSV(
                    deals.filter(d => ['submitted', 'under_review'].includes(d.status)),
                    ['reference_number', 'customer_name', 'product_type', 'monthly_payment', 'status']
                  );
                  showToast('Exported submitted deals', 'success');
                },
              },
              {
                label: 'Complete portfolio',
                sub: `${contracts.length} contracts total`,
                action: () => {
                  exportContractsCSV(contracts, CONTRACT_FIELDS.map(f => f.key));
                  showToast('Exported full portfolio', 'success');
                },
              },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bdr)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>{item.sub}</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={item.action}>
                  <FileText size={12} /> Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
