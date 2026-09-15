import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M12 8v4m0 4h.01',
};
const STYLES = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-primary',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message, type = 'info', ttl = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, message, type }]);
      if (ttl) setTimeout(() => remove(id), ttl);
    },
    [remove]
  );

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in flex w-full max-w-sm items-start gap-3 rounded-xl border border-border border-l-4 bg-white px-4 py-3 shadow-pop ${STYLES[t.type]}`}
          >
            <svg
              className={`mt-0.5 h-5 w-5 shrink-0 ${t.type === 'success' ? 'text-success' : t.type === 'error' ? 'text-danger' : 'text-primary'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d={ICONS[t.type]} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
