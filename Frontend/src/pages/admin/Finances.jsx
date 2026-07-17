import { useState } from 'react';
import { useFetch } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/Primitives';
import { PaymentBadge, PageLoader, Pagination } from '../../components/ui/Misc';
import { EmptyState } from '../../components/ui/Primitives';
import { naira } from '../../lib/constants';

export default function Finances() {
  const [page, setPage] = useState(1);
  const { data, meta, loading } = useFetch('/admin/finances', { params: { page, limit: 20 } });
  const rows = data || [];
  const revenue = meta?.revenueNaira ?? 0;
  const totalPages = meta?.pagination?.totalPages ?? 1;

  return (
    <div>
      <PageHeader title="Finances" subtitle="Application fee payments across the platform." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total revenue" value={naira(revenue)} accent="text-success" />
        <StatCard label="Records" value={meta?.pagination?.total ?? 0} />
        <StatCard label="This page" value={rows.length} />
      </div>

      {loading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="No payments yet" message="Payments will appear here once applicants pay." />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Application</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-primary-surface">
                    <td className="px-4 py-3 text-muted">{r.reference}</td>
                    <td className="px-4 py-3 font-medium text-ink">{r.user}</td>
                    <td className="px-4 py-3 text-muted">{r.applicationRef ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-ink">{naira(r.amountNaira)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{r.channel ?? '—'}</td>
                    <td className="px-4 py-3"><PaymentBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-muted">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
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
