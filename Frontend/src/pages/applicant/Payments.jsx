import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Primitives';
import { PaymentBadge, PageLoader, Pagination } from '../../components/ui/Misc';
import { naira } from '../../lib/constants';

export default function Payments() {
  const { items, page, setPage, totalPages, loading } = usePaged('/payments/mine');
  return (
    <div>
      <PageHeader title="Payments" subtitle="Your TruEntry payments." />
      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState title="No payments yet" message="Payments appear here after you make a payment." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-primary-surface">
                    <td className="px-4 py-3 text-muted">{p.reference}</td>
                    <td className="px-4 py-3 capitalize text-ink">{p.purpose?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-medium text-ink">{naira(p.amountNaira)}</td>
                    <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
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
