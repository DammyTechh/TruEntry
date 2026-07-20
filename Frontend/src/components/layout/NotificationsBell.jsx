import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../../lib/api';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function loadCount() {
    try { const { data } = await api.get('/notifications/unread-count'); setUnread(data.data.unread || 0); } catch { /* silent */ }
  }
  async function loadList() {
    try { const { data } = await api.get('/notifications', { params: { limit: 8 } }); setItems(data.data || []); } catch { /* silent */ }
  }
  useEffect(() => { loadCount(); const t = setInterval(loadCount, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  async function toggle() { const next = !open; setOpen(next); if (next) await loadList(); }
  async function markAll() {
    try { await api.patch('/notifications/read-all'); setUnread(0); setItems((xs) => xs.map((x) => ({ ...x, read: true }))); } catch { /* silent */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-xl p-2.5 text-muted transition hover:bg-primary-surface hover:text-ink" aria-label="Notifications">
        <Bell className="h-5 w-5" strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-scale-in absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            <button onClick={markAll} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">You're all caught up.</p>
            ) : items.map((n) => (
              <div key={n.id} className={`border-b border-border px-4 py-3 transition ${!n.read ? 'bg-primary-surface' : ''}`}>
                <div className="text-sm font-medium text-ink">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
