import { useFetch } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard, Card, EmptyState } from '../../components/ui/Primitives';
import { StatusBadge, PageLoader } from '../../components/ui/Misc';
import { naira } from '../../lib/constants';

export default function Dashboard() {
  const { data, loading } = useFetch('/admin/dashboard');
  if (loading) return <PageLoader />;
  const d = data || {};
  const apps = d.applications || {};
  const inst = d.institutions || {};
  const fin = d.finance || {};

  return (
    <div>
      <PageHeader title="Admin dashboard" subtitle="Platform-wide overview." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={apps.total ?? 0} hint={`${apps.admitted ?? 0} admitted`} />
        <StatCard label="Institutions" value={inst.total ?? 0} hint={`${inst.active ?? 0} active`} />
        <StatCard label="Revenue" value={naira(fin.revenueNaira ?? 0)} accent="text-success" hint={`${fin.successfulPayments ?? 0} payments`} />
        <StatCard label="Forwarded to JAMB" value={apps.forwarded_jamb ?? 0} accent="text-primary" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-ink">Applications by stage</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ['Submitted', apps.submitted],
              ['Under review', apps.under_review],
              ['Recommended', apps.recommended],
              ['Approved', apps.approved],
              ['Forwarded to JAMB', apps.forwarded_jamb],
              ['Admitted', apps.admitted],
            ].map(([label, v]) => (
              <li key={label} className="flex items-center justify-between">
                <span className="text-muted">{label}</span>
                <span className="font-semibold text-ink">{v ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold text-ink">Recent applications</h3>
          {!d.recentApplications || d.recentApplications.length === 0 ? (
            <EmptyState title="No activity yet" message="Recent applications will show here." />
          ) : (
            <div className="mt-3 divide-y divide-border">
              {d.recentApplications.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium text-ink">{a.full_name}</div>
                    <div className="text-xs text-muted">{a.institution} · {a.reference}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
