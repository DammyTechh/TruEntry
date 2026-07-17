import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';

export default function Audit() {
  const { items, page, setPage, totalPages, loading } = usePaged('/admin/audit-logs');

  const columns = [
    { key: 'action', header: 'Action', render: (r) => <span className="font-medium text-ink">{r.action}</span> },
    { key: 'entity', header: 'Entity', render: (r) => <span className="text-muted">{r.entity}{r.entityId ? ` · ${String(r.entityId).slice(0, 8)}` : ''}</span> },
    { key: 'user', header: 'By', render: (r) => r.user ?? '—' },
    { key: 'ip', header: 'IP', render: (r) => <span className="text-muted">{r.ip ?? '—'}</span> },
    { key: 'createdAt', header: 'When', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : '—' },
  ];

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Every privileged action, recorded." />
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No audit records', message: 'Actions will be logged here as they happen.' }}
      />
    </div>
  );
}
