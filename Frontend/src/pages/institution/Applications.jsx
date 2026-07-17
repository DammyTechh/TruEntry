import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Misc';
import { Select } from '../../components/ui/Field';

const STATUSES = ['', 'submitted', 'under_review', 'qualified_post_utme', 'post_utme_completed', 'recommended', 'approved', 'forwarded_jamb', 'admitted'];

export default function Applications() {
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const { items, page, setPage, totalPages, loading } = usePaged('/applications/institution', status ? { status } : {});

  const columns = [
    { key: 'applicantName', header: 'Applicant', render: (r) => <span className="font-medium text-ink">{r.applicantName}</span> },
    { key: 'departmentName', header: 'Department' },
    { key: 'jambScore', header: 'JAMB', render: (r) => r.jambScore ?? '—' },
    { key: 'aggregateScore', header: 'Aggregate', render: (r) => r.aggregateScore ?? '—' },
    { key: 'state', header: 'State', render: (r) => r.state ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Applications"
        action={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-56">
            <option value="">All statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        }
      />
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onRowClick={(r) => nav(`/institution/applications/${r.id}`)}
        empty={{ title: 'No applications', message: 'Applications appear here once submitted.' }}
      />
    </div>
  );
}
