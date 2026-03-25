import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export default function Modal() {
  const { modal, closeModal } = useAppContext();
  const [note, setNote] = useState('');

  const handleConfirm = async () => {
    if (modal.onConfirm) await modal.onConfirm(note);
    setNote('');
    closeModal();
  };

  const handleBgClick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };

  const isConfirm = modal.type === 'confirm';

  return (
    <div className={`modal-bg ${modal.visible ? 'show' : ''}`} onClick={handleBgClick}>
      <div className="modal">
        <div className="modal-title">
          {modal.title || (isConfirm ? 'Confirm' : 'Action')}
        </div>
        {modal.body && <div className="modal-desc">{modal.body}</div>}

        {/* Show note field for non-confirm modals */}
        {!isConfirm && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx2)', marginBottom: 6 }}>Note (optional)</div>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Add a note…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button
            className="btn btn-primary"
            style={modal.type === 'reject' ? { background: 'var(--red)', border: 'none' } : undefined}
            onClick={handleConfirm}
          >
            {modal.confirmLabel || (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}
