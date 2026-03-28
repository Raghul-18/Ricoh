import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLocale } from '../../context/LocaleContext';

export default function Modal() {
  const { modal, closeModal } = useAppContext();
  const { t } = useLocale();
  const [note, setNote] = useState('');

  const handleClose = () => {
    setNote('');
    closeModal();
  };

  const handleConfirm = async () => {
    if (modal.onConfirm) await modal.onConfirm(note);
    handleClose();
  };

  const isConfirm = modal.type === 'confirm';

  return (
    <div className={`modal-bg ${modal.visible ? 'show' : ''}`} onClick={(event) => event.target === event.currentTarget && handleClose()}>
      <div className="modal">
        <div className="modal-title">
          {modal.title || (isConfirm ? t('admin.confirm') : t('common.close'))}
        </div>
        {modal.body && <div className="modal-desc">{modal.body}</div>}

        {!isConfirm && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>
              {t('deals.notes')} (optional)
            </div>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Add a note..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={handleClose}>{t('admin.cancel')}</button>
          <button
            className="btn btn-primary"
            style={modal.type === 'reject' ? { background: 'var(--red)', border: 'none' } : undefined}
            onClick={handleConfirm}
          >
            {modal.confirmLabel || (isConfirm ? t('admin.confirm') : t('common.close'))}
          </button>
        </div>
      </div>
    </div>
  );
}
