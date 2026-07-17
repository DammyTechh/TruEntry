import { Link } from 'react-router-dom';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, EmptyState } from '../../components/ui/Primitives';
import { StatusBadge, PaymentBadge, PageLoader, Pagination } from '../../components/ui/Misc';

export default function Applications() {
  const { items, page, setPage, totalPages, loading } = usePaged('/applications/mine');

  return (
    <div>
      <PageHeader title="My applications" action={<Button to="/app/apply">New application</Button>} />
      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState title="No applications yet" message="Apply to an institution to see it here." action={<Button to="/app/apply">Start an application</Button>} />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-primary-surface">
                    <td className="px-4 py-3 font-medium text-ink">{a.institutionName}</td>
                    <td className="px-4 py-3 text-muted">{a.departmentName}</td>
                    <td className="px-4 py-3 text-muted">{a.reference}</td>
                    <td className="px-4 py-3"><PaymentBadge status={a.paymentStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/applications/${a.id}`} className="link">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
