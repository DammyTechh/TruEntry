import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Primitives';

export default function Admitted() {
  const { items, page, setPage, totalPages, loading } = usePaged('/jamb/admitted');

  const columns = [
    { key: 'applicantName', header: 'Applicant', render: (r) => <span className="font-medium text-ink">{r.applicantName}</span> },
    { key: 'institutionName', header: 'Institution' },
    { key: 'departmentName', header: 'Department' },
    { key: 'jambScore', header: 'JAMB', render: (r) => r.jambScore ?? '—' },
    { key: 'aggregateScore', header: 'Aggregate', render: (r) => r.aggregateScore ?? '—' },
    { key: 'admitted', header: '', render: () => <Badge className="bg-green-50 text-success">Admitted</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Admitted" subtitle="Applicants issued final admission." />
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No admitted applicants yet', message: 'Admitted applicants will appear here.' }}
      />
    </div>
  );
}
