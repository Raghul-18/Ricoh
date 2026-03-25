import { createContext, useContext, useState, useRef, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, message: '', variant: 'info' });
  const [modal, setModal] = useState({ visible: false, type: '', title: '', body: '', onConfirm: null });
  const [confettiItems, setConfettiItems] = useState([]);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, variant = 'info') => {
    setToast({ visible: true, message, variant });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  const openModal = useCallback((options) => {
    if (typeof options === 'string') {
      // Legacy usage: openModal('approve', fn)
      setModal({ visible: true, type: options, title: '', body: '', onConfirm: null });
    } else {
      setModal({ visible: true, ...options });
    }
  }, []);

  const closeModal = useCallback(() => {
    setModal({ visible: false, type: '', title: '', body: '', onConfirm: null });
  }, []);

  const fireConfetti = useCallback(() => {
    const colors = ['#BF4528', '#2C7A4B', '#1A5FA8', '#A86410', '#F2C0AC', '#A3D4B4'];
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 1.5 + Math.random() * 2,
      delay: Math.random() * 0.8,
      width: 6 + Math.random() * 8,
      height: 6 + Math.random() * 8,
      round: Math.random() > 0.5,
    }));
    setConfettiItems(items);
    setTimeout(() => setConfettiItems([]), 4000);
  }, []);

  return (
    <AppContext.Provider value={{
      showToast, openModal, closeModal, modal, setModal,
      fireConfetti, confettiItems, toast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}

// Legacy alias
export const useApp = useAppContext;
