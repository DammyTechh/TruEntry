import { useFetch } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard, Card, Button } from '../../components/ui/Primitives';
import { PageLoader } from '../../components/ui/Misc';
import { useAuth } from '../../context/AuthContext';

// The API scopes to the caller's institution automatically.
export default function Dashboard() {
  const { user } = useAuth();
  const { data, meta, loading } = useFetch('/applications/institution', { params: { limit: 1 } });
  const total = meta?.pagination?.total ?? 0;

  return (
    <div>
      <PageHeader title="Institution dashboard" subtitle="Overview of your admissions pipeline." />
      {loading ? (
        <PageLoader />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Applications" value={total} hint="Total received (excl. unpaid)" />
          <Card>
            <h3 className="font-semibold text-ink">Review queue</h3>
            <p className="mt-1 text-sm text-muted">Work through submitted applications.</p>
            <Button to="/institution/applications" variant="secondary" className="mt-4 w-full">Open applications</Button>
          </Card>
          <Card>
            <h3 className="font-semibold text-ink">Run decisioning</h3>
            <p className="mt-1 text-sm text-muted">Rank and select candidates against quota.</p>
            <Button to="/institution/decisioning" variant="secondary" className="mt-4 w-full">Open decisioning</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
