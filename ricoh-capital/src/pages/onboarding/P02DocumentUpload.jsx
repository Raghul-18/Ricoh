import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, MapPin, Building2, CreditCard, Shield, ShieldCheck,
  Upload, CheckCircle, XCircle, ArrowRight, ArrowLeft, Info, AlertTriangle,
} from 'lucide-react';
import { useRedirectWhenApproved } from '../../hooks/useRedirectWhenApproved';
import { useSubmitApplication, useUploadDocument } from '../../hooks/useOnboarding';
import { useOnboardingStore, DOC_CONFIG } from '../../store/onboardingStore';
import { useAppContext } from '../../context/AppContext';
import { LoadingSpinner } from '../../components/shared/FormField';

const MAX_SIZE = 10 * 1024 * 1024;

const DOC_ICONS = {
  certificate_of_incorporation: <FileText size={18} />,
  proof_of_address:             <MapPin size={18} />,
  bank_statements:              <Building2 size={18} />,
  director_photo_id:            <CreditCard size={18} />,
  aml_kyc_policy:               <Shield size={18} />,
  pi_insurance:                 <ShieldCheck size={18} />,
};

function DocRow({ config, doc, onUpload }) {
  const inputRef = useRef();
  const status = doc?.status || 'pending';

  const statusConfig = {
    pending:   { icon: null,                      label: 'Not uploaded', color: 'var(--tx4)' },
    uploading: { icon: <LoadingSpinner size={12}/>,label: 'Uploading…',   color: 'var(--blue)' },
    uploaded:  { icon: <CheckCircle size={12} />, label: 'Ready',        color: 'var(--green)' },
    verified:  { icon: <CheckCircle size={12} />, label: 'Verified',     color: 'var(--green)' },
    failed:    { icon: <XCircle size={12} />,     label: doc?.failureReason || 'Upload failed', color: 'var(--red)' },
  };
  const sc = statusConfig[status] || statusConfig.pending;

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${status === 'failed' ? 'var(--red-m)' : status === 'uploaded' ? 'var(--green-m)' : 'var(--bdr)'}`,
      borderRadius: 'var(--rl)', padding: '14px 16px',
    }}>
      <input
        ref={inputRef} type="file" style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png,.heic"
        onChange={e => {
          const f = e.target.files[0];
          if (!f) return;
          if (f.size > MAX_SIZE) { alert('Maximum file size is 10 MB'); return; }
          onUpload(f);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div style={{ color: status === 'uploaded' ? 'var(--green)' : status === 'failed' ? 'var(--red)' : 'var(--tx4)', flexShrink: 0 }}>
            {DOC_ICONS[config.key]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {config.label}
              {!config.required && <span style={{ fontSize: 10, color: 'var(--tx4)', fontWeight: 400 }}>Optional</span>}
            </div>
            {doc?.fileName ? (
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.fileName} {doc.fileSize ? `· ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 2 }}>PDF, JPEG or PNG · max 10 MB</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: sc.color, fontWeight: 500 }}>
            {sc.icon} {sc.label}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '5px 12px', height: 30 }}
            onClick={() => status !== 'uploading' && inputRef.current?.click()}
            disabled={status === 'uploading'}
          >
            <Upload size={11} /> {(status === 'uploaded' || status === 'failed') ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function P02DocumentUpload() {
  const navigate = useNavigate();
  useRedirectWhenApproved();
  const { showToast } = useAppContext();
  const { registration, documents, uploadProgress } = useOnboardingStore();

  const uploadMutation = useUploadDocument();
  const submitMutation = useSubmitApplication();

  // Guard: if registration not filled, send back
  if (!registration.companyName) {
    return (
      <div className="page">
        <div className="info-banner amber" style={{ marginTop: 24 }}>
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>Complete registration first</div>
            <div style={{ fontSize: 11, marginTop: 3 }}>Fill in your company details before uploading documents.</div>
          </div>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate('/onboarding/registration')}>
            Go to registration
          </button>
        </div>
      </div>
    );
  }

  const uploadedCount = Object.values(documents).filter(d => d.status === 'uploaded' || d.status === 'verified').length;
  const allRequiredUploaded = DOC_CONFIG.filter(d => d.required).every(d => {
    const doc = documents[d.key];
    return doc?.status === 'uploaded' || doc?.status === 'verified';
  });

  const handleUpload = async (docType, file) => {
    try {
      await uploadMutation.mutateAsync({ documentType: docType, displayName: docType, file });
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!allRequiredUploaded) {
      showToast('Please upload all required documents first', 'warning');
      return;
    }
    try {
      await submitMutation.mutateAsync();
      showToast('Application submitted — a compliance officer will review it shortly', 'success');
      navigate('/onboarding/verification');
    } catch (err) {
      showToast(err.message || 'Submission failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Document Upload</div>
          <div className="page-sub">
            Upload your firm's compliance documents — required docs marked with *
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/onboarding/registration')}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="steps-row" style={{ marginBottom: 24 }}>
        {['Registration', 'Documents', 'Verification', 'Review', 'Welcome'].map((s, i) => (
          <div key={s} className={`step ${i === 1 ? 'active' : i < 1 ? 'done' : ''}`}>
            <div className="step-dot">{i < 1 ? <CheckCircle size={14} /> : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      {/* Company summary */}
      <div style={{ background: 'var(--blue-l)', border: '1px solid var(--blue-m)', borderRadius: 'var(--rl)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--blue-d)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        Uploading documents for <strong style={{ marginLeft: 3 }}>{registration.companyName}</strong>
        &nbsp;·&nbsp;
        <button style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }} onClick={() => navigate('/onboarding/registration')}>
          Edit details
        </button>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Upload progress</div>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{uploadedCount} of {DOC_CONFIG.length}</span>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: allRequiredUploaded ? 'var(--green)' : 'var(--coral)',
            width: `${Math.max(3, (uploadedCount / DOC_CONFIG.length) * 100)}%`,
            transition: 'width .4s',
          }} />
        </div>
      </div>

      {/* Doc rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {DOC_CONFIG.map(config => (
          <DocRow
            key={config.key}
            config={config}
            doc={documents[config.key]}
            onUpload={(file) => handleUpload(config.key, file)}
          />
        ))}
      </div>

      <div className="info-banner blue" style={{ marginBottom: 20 }}>
        <Info size={15} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <strong>Note:</strong> Files are uploaded to secure storage. Your application and all document records are created together only when you click <strong>Submit application</strong>.
          Accepted formats: PDF, JPEG, PNG, HEIC · Max 10 MB per file.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/onboarding/registration')}>
          <ArrowLeft size={14} /> Edit registration
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!allRequiredUploaded || submitMutation.isPending}
        >
          {submitMutation.isPending
            ? <><LoadingSpinner /> Submitting…</>
            : <>Submit application <ArrowRight size={14} /></>}
        </button>
      </div>
    </div>
  );
}
