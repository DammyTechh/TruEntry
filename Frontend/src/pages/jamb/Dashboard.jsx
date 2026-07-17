import { useFetch } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard, Card, Button, EmptyState } from '../../components/ui/Primitives';
import { PageLoader } from '../../components/ui/Misc';

export default function Dashboard() {
  const { data, loading } = useFetch('/jamb/stats');
  if (loading) return <PageLoader />;
  const s = data || {};

  return (
    <div>
      <PageHeader
        title="JAMB regulator dashboard"
        subtitle="Audit applicants across institutions and issue admissions."
        action={<Button to="/jamb/forwarded">Review pending</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total applications" value={s.total_applications ?? 0} />
        <StatCard label="Awaiting decision" value={s.awaiting_decision ?? 0} accent="text-warning" />
        <StatCard label="Admitted" value={s.admitted ?? 0} accent="text-success" />
        <StatCard label="Not admitted" value={s.not_admitted ?? 0} accent="text-danger" />
      </div>

      <h3 className="mb-3 mt-8 font-semibold text-ink">By institution</h3>
      {!s.byInstitution || s.byInstitution.length === 0 ? (
        <EmptyState title="No data yet" message="Institution breakdowns appear once applications are forwarded." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Admitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {s.byInstitution.map((r, i) => (
                <tr key={i} className="hover:bg-primary-surface">
                  <td className="px-4 py-3 font-medium text-ink">{r.institution}</td>
                  <td className="px-4 py-3 text-muted">{r.total}</td>
                  <td className="px-4 py-3 text-success">{r.admitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
