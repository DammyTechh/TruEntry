import { Link } from 'react-router-dom';
import { useFetch } from '../../lib/hooks';
import { PageHeader, ProgressRing } from '../../components/ui/PageHeader';
import { Card, Button, EmptyState } from '../../components/ui/Primitives';
import { StatusBadge, PageLoader } from '../../components/ui/Misc';
import { useAuth } from '../../context/AuthContext';

const CHECK_LABELS = {
  ninVerified: 'NIN verified',
  jambVerified: 'JAMB verified',
  olevelVerified: 'O-Level verified',
  hasImage: 'Passport photo',
  hasBiodata: 'Biodata complete',
  hasLocation: 'Location set',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: completion, loading: cLoading } = useFetch('/profile/completion');
  const { data: apps, loading: aLoading } = useFetch('/applications/mine', { params: { limit: 5 } });

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.fullName?.split(' ')[0] || 'there'}`} subtitle="Here's where your admissions stand." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Completion */}
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-ink">Profile completion</h3>
          {cLoading ? (
            <PageLoader />
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                <ProgressRing value={completion?.percentage || 0} />
                <div className="text-sm text-muted">
                  {completion?.canApply ? 'You can apply now.' : 'Finish these to apply.'}
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {Object.entries(CHECK_LABELS).map(([k, label]) => {
                  const done = completion?.checks?.[k];
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-success text-white' : 'bg-primary-surface text-muted'}`}>
                        {done ? '✓' : ''}
                      </span>
                      <span className={done ? 'text-ink' : 'text-muted'}>{label}</span>
                    </li>
                  );
                })}
              </ul>
              <Button to="/app/profile" variant="secondary" className="mt-5 w-full">
                {completion?.complete ? 'View profile' : 'Complete profile'}
              </Button>
            </>
          )}
        </Card>

        {/* Applications */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Recent applications</h3>
            <Link to="/app/applications" className="text-sm link">
              View all
            </Link>
          </div>
          {aLoading ? (
            <PageLoader />
          ) : !apps || apps.length === 0 ? (
            <EmptyState
              title="No applications yet"
              message="Once your profile is ready, apply to an institution to get started."
              action={<Button to="/app/apply">Start an application</Button>}
            />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {apps.map((a) => (
                <Link key={a.id} to={`/app/applications/${a.id}`} className="flex items-center justify-between py-3 hover:bg-primary-surface">
                  <div>
                    <div className="font-medium text-ink">{a.institutionName}</div>
                    <div className="text-xs text-muted">{a.departmentName} · {a.reference}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
