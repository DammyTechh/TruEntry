import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function loadCount() {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.data.unread || 0);
    } catch {
      /* silent */
    }
  }

  async function loadList() {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 8 } });
      setItems(data.data || []);
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  }

  async function markAll() {
    try {
      await api.patch('/notifications/read-all');
      setUnread(0);
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    } catch {
      /* silent */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-lg p-2 text-muted hover:bg-primary-surface hover:text-ink" aria-label="Notifications">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-scale-in absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            <button onClick={markAll} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className={`border-b border-border px-4 py-3 ${!n.read ? 'bg-primary-surface' : ''}`}>
                  <div className="text-sm font-medium text-ink">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
