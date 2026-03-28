import { useState, useEffect } from 'react';
import { X, Download, FileText, ChevronLeft, ChevronRight, Loader, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { getDocumentSignedUrl, downloadDocumentBlob } from '../../lib/backendClient';

function FilePreview({ url, fileName, mimeType, filePath }) {
  if (!url) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--tx4)', gap: 12 }}>
      <FileText size={48} />
      <span style={{ fontSize: 13 }}>Preview unavailable</span>
    </div>
  );

  const previewName = fileName || filePath || '';
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(previewName) || String(mimeType || '').startsWith('image/');
  const isPdf   = /\.pdf$/i.test(previewName) || mimeType === 'application/pdf';

  if (isImage) return (
    <img src={url} alt={fileName} style={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 6 }} />
  );

  if (isPdf) return (
    <iframe src={url} title={fileName} style={{ width: '100%', height: 560, border: 'none', borderRadius: 6 }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--tx3)', gap: 12 }}>
      <FileText size={48} />
      <div style={{ fontSize: 13 }}>{fileName}</div>
      <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize: 12 }}>
        <Download size={13} /> Open file
      </a>
    </div>
  );
}

export default function DocumentViewer({ documents, initialIndex = 0, onClose }) {
  const [current, setCurrent] = useState(initialIndex);
  const [signedUrls, setSignedUrls] = useState({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const doc = documents[current];

  // Fetch signed URL for current doc eagerly + neighbours
  useEffect(() => {
    let cancelled = false;
    async function fetchUrls() {
      setLoadingUrls(true);
      const toFetch = [...new Set([current, current - 1, current + 1])]
        .filter(i => i >= 0 && i < documents.length)
        .filter(i => !signedUrls[documents[i]?.file_path]);

      await Promise.all(toFetch.map(async (i) => {
        const d = documents[i];
        if (!d?.file_path) return;
        const url = await getDocumentSignedUrl(d.file_path);
        if (!cancelled) setSignedUrls(prev => ({ ...prev, [d.file_path]: url }));
      }));
      if (!cancelled) setLoadingUrls(false);
    }
    fetchUrls();
    return () => { cancelled = true; };
  }, [current, signedUrls, documents, onClose]);

  const handleDownloadCurrent = () => {
    const url = signedUrls[doc?.file_path];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name || 'document';
    a.click();
  };

  const handleDownloadAll = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      await Promise.all(documents.map(async (d) => {
        if (!d.file_path) return;
        try {
          const blob = await downloadDocumentBlob(d.file_path);
          zip.file(d.file_name || d.document_type, blob);
        } catch (e) { console.warn('Could not download', d.file_name, e); }
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documents.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft'  && current > 0) setCurrent(c => c - 1);
      if (e.key === 'ArrowRight' && current < documents.length - 1) setCurrent(c => c + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, documents.length, onClose]);

  const currentUrl = signedUrls[doc?.file_path];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 800,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc?.display_name || doc?.document_type}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 2 }}>
              {current + 1} of {documents.length} · {doc?.file_name}
              {doc?.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={handleDownloadCurrent} disabled={!currentUrl}>
              <Download size={12} /> Download
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={handleDownloadAll} disabled={downloadingZip}>
              {downloadingZip
                ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Zipping…</>
                : <><Archive size={12} /> Download all ({documents.length})</>}
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', minHeight: 0 }}>
          {loadingUrls && !currentUrl
            ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--tx4)' }}>
                <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--coral)' }} />
                <span style={{ fontSize: 12 }}>Loading document…</span>
              </div>
            : <FilePreview url={currentUrl} fileName={doc?.file_name} mimeType={doc?.mime_type} filePath={doc?.file_path} />
          }
        </div>

        {/* Thumbnail strip + navigation */}
        {documents.length > 1 && (
          <div style={{ borderTop: '1px solid var(--bdr)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'auto' }}>
              {documents.map((d, i) => (
                <button key={d.id} onClick={() => setCurrent(i)} style={{
                  all: 'unset', cursor: 'pointer', flexShrink: 0,
                  padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: i === current ? 'var(--coral-l)' : 'var(--bg)',
                  color: i === current ? 'var(--coral)' : 'var(--tx3)',
                  border: `1px solid ${i === current ? 'var(--coral-m)' : 'var(--bdr)'}`,
                  whiteSpace: 'nowrap',
                }}>
                  {d.display_name || d.document_type}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setCurrent(c => Math.min(documents.length - 1, c + 1))} disabled={current === documents.length - 1}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
