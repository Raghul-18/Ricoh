import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Download, Plus, FileText, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { useContracts, exportContractsCSV } from '../../hooks/useContracts';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';
import { useLocale } from '../../context/LocaleContext';
import { convertWithRate, useFxRate } from '../../hooks/useFx';

const STATUS_META = {
  active: { labelKey: 'portfolio.statusActive', color: 'var(--green)', bg: 'var(--green-l)' },
  overdue: { labelKey: 'portfolio.statusOverdue', color: 'var(--red)', bg: 'var(--red-l)' },
  maturing: { labelKey: 'portfolio.statusMaturing', color: 'var(--amber)', bg: 'var(--amber-l)' },
  completed: { labelKey: 'portfolio.statusCompleted', color: 'var(--tx3)', bg: 'var(--bg)' },
  cancelled: { labelKey: 'portfolio.statusCancelled', color: 'var(--tx4)', bg: 'var(--bg)' },
};

function getReportingAssetValue(contract, reportingCurrency) {
  const originalCurrency = contract?.deal?.original_currency_code || reportingCurrency;
  const reportingCurrencyCode = contract?.deal?.reporting_currency_code || (originalCurrency === reportingCurrency ? reportingCurrency : null);
  if (Number.isFinite(Number(contract?.deal?.reporting_asset_value))) return Number(contract.deal.reporting_asset_value);
  if (reportingCurrencyCode === reportingCurrency || originalCurrency === reportingCurrency) {
    return Number(contract?.asset_value || 0);
  }
  return 0;
}

function getReportingMonthlyValue(contract, reportingCurrency) {
  const originalCurrency = contract?.deal?.original_currency_code || reportingCurrency;
  const reportingCurrencyCode = contract?.deal?.reporting_currency_code || (originalCurrency === reportingCurrency ? reportingCurrency : null);
  if (Number.isFinite(Number(contract?.deal?.reporting_monthly_payment))) return Number(contract.deal.reporting_monthly_payment);
  if (reportingCurrencyCode === reportingCurrency || originalCurrency === reportingCurrency) {
    return Number(contract?.monthly_payment || 0);
  }
  return null;
}

function ContractRow({ contract, onOpen }) {
  const { primaryCurrency, reportingCurrency, formatCurrency, formatDate, t } = useLocale();
  const { data: fx } = useFxRate(reportingCurrency, primaryCurrency);
  const originalCurrency = contract.deal?.original_currency_code || reportingCurrency;
  const originalMonthly = contract.monthly_payment || 0;
  const originalAssetValue = contract.asset_value || 0;
  const reportingMonthly = getReportingMonthlyValue(contract, reportingCurrency);
  const reportingAssetValue = getReportingAssetValue(contract, reportingCurrency);
  const convertedMonthly = primaryCurrency === originalCurrency
    ? originalMonthly
    : convertWithRate(reportingMonthly, fx?.rate);
  const convertedAssetValue = primaryCurrency === originalCurrency
    ? originalAssetValue
    : convertWithRate(reportingAssetValue, fx?.rate);
  const meta = STATUS_META[contract.status] || STATUS_META.active;

  return (
    <tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--coral)' }}>{contract.reference_number}</span></td>
      <td style={{ fontWeight: 600, fontSize: 13 }}>{contract.customer_name}</td>
      <td style={{ fontSize: 12, color: 'var(--tx3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contract.asset_description}</td>
      <td style={{ textAlign: 'right', fontWeight: 700 }}>
        {formatCurrency(originalMonthly, originalCurrency)}
        {primaryCurrency !== originalCurrency && Number.isFinite(convertedMonthly) && (
          <div style={{ fontSize: 10, color: 'var(--tx4)', fontWeight: 500 }}>{formatCurrency(convertedMonthly, primaryCurrency)}</div>
        )}
      </td>
      <td style={{ textAlign: 'right', color: 'var(--tx3)', fontSize: 12 }}>
        {formatCurrency(originalAssetValue, originalCurrency)}
        {primaryCurrency !== originalCurrency && Number.isFinite(convertedAssetValue) && (
          <div style={{ fontSize: 10, color: 'var(--tx4)' }}>{formatCurrency(convertedAssetValue, primaryCurrency)}</div>
        )}
      </td>
      <td style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('portfolio.monthsShort', { count: contract.term_months })}</td>
      <td style={{ fontSize: 12 }}>
        {contract.next_payment_date ? formatDate(contract.next_payment_date, { day: 'numeric', month: 'short' }) : t('common.none')}
      </td>
      <td>
        <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, borderRadius: 10, padding: '3px 8px' }}>
          {t(meta.labelKey)}
        </span>
      </td>
    </tr>
  );
}

export default function P10PortfolioDashboard() {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const { data: contracts = [], isLoading, error, refetch } = useContracts();
  const { primaryCurrency, reportingCurrency, formatCurrency, formatNumber, t } = useLocale();
  const { data: fx } = useFxRate(reportingCurrency, primaryCurrency);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');

  const filteredContracts = useMemo(() => contracts
    .filter((contract) => filter === 'all' || contract.status === filter)
    .filter((contract) => {
      const query = search.toLowerCase();
      return !query
        || contract.customer_name?.toLowerCase().includes(query)
        || contract.reference_number?.toLowerCase().includes(query)
        || contract.asset_description?.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (sort === 'monthly_payment') return (b.monthly_payment || 0) - (a.monthly_payment || 0);
      if (sort === 'asset_value') return (b.asset_value || 0) - (a.asset_value || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    }), [contracts, filter, search, sort]);

  const stats = useMemo(() => {
    const active = contracts.filter((contract) => contract.status === 'active').length;
    const overdue = contracts.filter((contract) => contract.status === 'overdue').length;
    const maturing = contracts.filter((contract) => contract.status === 'maturing').length;
    const reportingTotalValue = contracts.reduce((sum, contract) => sum + getReportingAssetValue(contract, reportingCurrency), 0);
    const currentTotalValue = primaryCurrency === reportingCurrency
      ? reportingTotalValue
      : convertWithRate(reportingTotalValue, fx?.rate);

    return {
      active,
      overdue,
      maturing,
      currentTotalValue,
    };
  }, [contracts, fx?.rate, primaryCurrency, reportingCurrency]);

  const handleExport = () => {
    exportContractsCSV(filteredContracts, [
      'reference_number', 'customer_name', 'asset_description',
      'asset_value', 'monthly_payment', 'term_months', 'start_date', 'end_date', 'status',
    ]);
    showToast(t('portfolio.exported'), 'success');
  };

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;

  const kpis = [
    { label: t('portfolio.activeContracts'), value: stats.active, icon: <FileText size={18} />, color: 'var(--green)' },
    { label: t('portfolio.overdue'), value: stats.overdue, icon: <AlertCircle size={18} />, color: 'var(--red)' },
    { label: t('portfolio.maturing90'), value: stats.maturing, icon: <Calendar size={18} />, color: 'var(--amber)' },
    {
      label: t('portfolio.totalValue'),
      value: Number.isFinite(stats.currentTotalValue) ? formatCurrency(stats.currentTotalValue, primaryCurrency) : t('common.none'),
      icon: <TrendingUp size={18} />,
      color: 'var(--blue)',
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('sidebar.portfolio')}</div>
          <div className="page-sub">{t('portfolio.subtitle', { count: formatNumber(contracts.length) })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={handleExport}>
            <Download size={13} /> {t('portfolio.exportCsv')}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
            <Plus size={14} /> {t('sidebar.newDeal')}
          </button>
        </div>
      </div>

      <div className="kpi-row">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="metric-card">
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="metric-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ width: '100%', maxWidth: 240, height: 34, fontSize: 12 }}
          placeholder={t('portfolio.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'active', 'overdue', 'maturing', 'completed'].map((value) => (
            <button
              key={value}
              className={`btn ${filter === value ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 12px', height: 32 }}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? t('common.all') : t(STATUS_META[value]?.labelKey || 'portfolio.statusActive')}
            </button>
          ))}
        </div>
        <select className="form-input" style={{ width: 160, height: 34, fontSize: 12 }} value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="created_at">{t('common.latestFirst')}</option>
          <option value="monthly_payment">{t('common.monthlyPayment')}</option>
          <option value="asset_value">{t('common.assetValue')}</option>
        </select>
      </div>

      {error ? (
        <div className="page-error">{error.message}</div>
      ) : filteredContracts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: 'var(--tx4)', marginBottom: 14 }}><FileText size={40} /></div>
            <div className="empty-state-title">{contracts.length === 0 ? t('portfolio.noContractsTitle') : t('common.noResults')}</div>
            <div className="empty-state-sub">
              {contracts.length === 0 ? t('portfolio.noContractsSub') : t('common.adjustFilters')}
            </div>
            {contracts.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                <Plus size={14} /> {t('portfolio.submitFirstDeal')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="portfolio-table-wrap table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.reference')}</th>
                <th>{t('common.customer')}</th>
                <th>{t('common.asset')}</th>
                <th style={{ textAlign: 'right' }}>{t('common.monthlyPayment')}</th>
                <th style={{ textAlign: 'right' }}>{t('common.assetValue')}</th>
                <th>{t('common.term')}</th>
                <th>{t('portfolio.nextPayment')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((contract) => (
                <ContractRow key={contract.id} contract={contract} onOpen={() => navigate(`/portfolio/${contract.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
