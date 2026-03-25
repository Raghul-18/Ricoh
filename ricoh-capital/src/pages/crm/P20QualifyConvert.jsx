import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Building2 } from 'lucide-react';
import { useProspect } from '../../hooks/useProspects';
import { useDealStore } from '../../store/dealStore';
import { LoadingSpinner } from '../../components/shared/FormField';

/**
 * Convert Prospect → Deal
 * Pre-fills the deal store from prospect data and redirects to the deal wizard.
 * Route: /crm/:id/convert
 */
export default function P20QualifyConvert() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: prospect, isLoading } = useProspect(id);
  const { setInitiation, reset } = useDealStore();

  const handleConvert = () => {
    reset();
    setInitiation({
      customerName: prospect.company_name,
      productType: mapProductType(prospect.product_interest),
      notes: prospect.notes || '',
      originatorReference: '',
    });
    navigate('/deals/new', { state: { fromProspect: id } });
  };

  if (isLoading) return <div className="page-loading"><LoadingSpinner size={24} /></div>;
  if (!prospect) return <div className="page-error">Prospect not found.</div>;

  const qualScore = calcQualificationScore(prospect);

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/crm/${id}`)}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="page-title">Convert to deal</div>
            <div className="page-sub">{prospect.company_name}</div>
          </div>
        </div>
      </div>

      {/* Prospect summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--coral-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--coral)', fontSize: 16, fontWeight: 700 }}>
            {prospect.company_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{prospect.company_name}</div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{prospect.contact_name} · {prospect.contact_email}</div>
          </div>
        </div>
        {[
          ['Product interest', prospect.product_interest || '—'],
          ['Estimated value', prospect.estimated_value ? `£${prospect.estimated_value.toLocaleString()}` : '—'],
          ['Industry', prospect.industry || '—'],
          ['Stage', prospect.pipeline_stage],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 7, borderBottom: '1px solid var(--bdr)', marginBottom: 7 }}>
            <span style={{ color: 'var(--tx3)' }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Qualification score */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Qualification score</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: qualScore >= 70 ? 'var(--green)' : qualScore >= 40 ? 'var(--amber)' : 'var(--red)', fontFamily: "'DM Mono', monospace" }}>
              {qualScore}
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx4)' }}>out of 100</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${qualScore}%`, background: qualScore >= 70 ? 'var(--green)' : qualScore >= 40 ? 'var(--amber)' : 'var(--red)', transition: '.4s' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: qualScore >= 70 ? 'var(--green)' : qualScore >= 40 ? 'var(--amber)' : 'var(--red)' }}>
              {qualScore >= 70 ? 'Strong lead — ready to convert' : qualScore >= 40 ? 'Moderate — proceed with care' : 'Weak lead — gather more info first'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {getQualChecks(prospect).map(check => (
            <div key={check.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <CheckCircle size={13} style={{ color: check.ok ? 'var(--green)' : 'var(--tx4)', flexShrink: 0 }} />
              <span style={{ color: check.ok ? 'var(--tx)' : 'var(--tx4)' }}>{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What happens next */}
      <div className="info-banner blue" style={{ marginBottom: 20 }}>
        <Building2 size={14} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Converting this prospect will pre-fill the deal wizard with <strong>{prospect.company_name}</strong>'s details.
          You can review and adjust everything before submission.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(`/crm/${id}`)}>
          Cancel
        </button>
        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handleConvert}>
          Convert &amp; start deal <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function mapProductType(interest) {
  const map = {
    'Asset Finance':       'Asset Finance — Hire Purchase',
    'Equipment Leasing':   'Asset Finance — Finance Lease',
    'Vehicle Finance':     'Vehicle Finance — Hire Purchase',
    'Working Capital':     'Working Capital Loan',
    'Invoice Finance':     'Invoice Finance',
  };
  return map[interest] || 'Asset Finance — Hire Purchase';
}

function calcQualificationScore(p) {
  let score = 0;
  if (p.company_name)      score += 15;
  if (p.contact_name)      score += 10;
  if (p.contact_email)     score += 10;
  if (p.contact_phone)     score += 10;
  if (p.product_interest)  score += 15;
  if (p.estimated_value)   score += 15;
  if (p.annual_turnover)   score += 10;
  if (p.notes)             score += 5;
  if (['Qualified', 'Proposal', 'Negotiation', 'Won'].includes(p.pipeline_stage)) score += 10;
  return Math.min(score, 100);
}

function getQualChecks(p) {
  return [
    { label: 'Company name on record',   ok: !!p.company_name },
    { label: 'Contact name provided',    ok: !!p.contact_name },
    { label: 'Email address provided',   ok: !!p.contact_email },
    { label: 'Phone number on file',     ok: !!p.contact_phone },
    { label: 'Product interest defined', ok: !!p.product_interest },
    { label: 'Estimated deal value set', ok: !!p.estimated_value },
    { label: 'Turnover data available',  ok: !!p.annual_turnover },
    { label: 'Stage beyond New lead',    ok: ['Qualified','Proposal','Negotiation','Won'].includes(p.pipeline_stage) },
  ];
}
