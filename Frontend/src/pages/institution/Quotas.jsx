import { useNavigate } from 'react-router-dom';
import { Plus, Users, CheckCircle2 } from 'lucide-react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Badge } from '../../components/ui/Primitives';

const STATUS_META = {
  draft: { label: 'Draft', cls: 'bg-primary-surface text-muted' },
  open: { label: 'Open', cls: 'bg-amber-50 text-warning' },
  closed: { label: 'Closed', cls: 'bg-primary-light text-primary' },
  processing: { label: 'Processing', cls: 'bg-primary-light text-primary' },
  finished: { label: 'Finished', cls: 'bg-green-50 text-success' },
};

export default function Quotas() {
  const nav = useNavigate();
  const { items, page, setPage, totalPages, total, loading } = usePaged('/quotas');

  const columns = [
    {
      key: 'name',
      header: 'Quota',
      render: (r) => (
        <div>
          <div className="font-medium text-ink">{r.name}</div>
          {r.sessionLabel && <div className="text-xs text-muted">{r.sessionLabel}</div>}
        </div>
      ),
    },
    { key: 'allocatedSeats', header: 'Size', render: (r) => (r.allocatedSeats ?? 0).toLocaleString() },
    { key: 'appliedCount', header: 'Applied', render: (r) => (r.appliedCount ?? 0).toLocaleString() },
    { key: 'admittedCount', header: 'Admitted', render: (r) => (r.admittedCount ? r.admittedCount.toLocaleString() : '—') },
    {
      key: 'window',
      header: 'Window',
      render: (r) =>
        r.applicationStart
          ? `${fmt(r.applicationStart)} → ${r.applicationEnd ? fmt(r.applicationEnd) : '—'}`
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const m = STATUS_META[r.status] || STATUS_META.draft;
        return <Badge className={m.cls}>{m.label}</Badge>;
      },
    },
    {
      key: 'open',
      header: '',
      render: (r) => (
        <button onClick={() => nav(`/institution/quotas/${r.id}`)} className="text-sm link">
          Open
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotas"
        subtitle="Create application quotas for the academic session."
        action={
          <Button onClick={() => nav('/institution/quotas/new')}>
            <Plus className="h-4 w-4" /> Create a quota
          </Button>
        }
      />

      {!loading && total > 0 && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <MiniStat icon={Users} label="Total cycles" value={total} />
          <MiniStat
            icon={CheckCircle2}
            label="Open now"
            value={items.filter((i) => i.status === 'open').length}
            tone="success"
          />
          <MiniStat
            icon={Users}
            label="Seats allocated"
            value={items.reduce((s, i) => s + (i.allocatedSeats || 0), 0).toLocaleString()}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onRowClick={(r) => nav(`/institution/quotas/${r.id}`)}
        empty={{
          title: 'No quotas yet',
          message: 'Create a quota to set this session’s admission parameters.',
          action: <Button onClick={() => nav('/institution/quotas/new')}>Create a quota</Button>,
        }}
      />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone = 'primary' }) {
  const tones = { primary: 'bg-primary-light text-primary', success: 'bg-green-50 text-success' };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="text-lg font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

function fmt(d) {
  try {
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}
