import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Spinner, Button } from './Primitives';
import { statusMeta, PAYMENT_STATUS_META } from '../../lib/constants';

export function StatusBadge({ status }) {
  const m = statusMeta(status);
  return <Badge className={m.cls}>{m.label}</Badge>;
}

export function PaymentBadge({ status }) {
  const m = PAYMENT_STATUS_META[status] || { label: status, cls: 'bg-primary-surface text-muted' };
  return <Badge className={m.cls}>{m.label}</Badge>;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted">
      <Spinner className="h-6 w-6 text-primary" />
      <span className="ml-3 text-sm">{label}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-primary-surface hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-primary-surface/50 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-muted">
      <span>Page <span className="font-semibold text-ink">{page}</span> of {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
