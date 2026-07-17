import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../../lib/hooks';
import { PageLoader } from '../../components/ui/Misc';
import { Badge, Button, EmptyState } from '../../components/ui/Primitives';
import { useAuth } from '../../context/AuthContext';

export default function InstitutionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: inst, loading } = useFetch(`/institutions/${id}`);
  const { data: departments } = useFetch(`/institutions/${id}/departments`);

  if (loading) return <div className="container-tru py-12"><PageLoader /></div>;
  if (!inst)
    return (
      <div className="container-tru py-12">
        <EmptyState title="Institution not found" action={<Button to="/institutions">Back to institutions</Button>} />
      </div>
    );

  const open = inst.parameters?.admissionOpen;

  return (
    <div className="container-tru py-12">
      <Link to="/institutions" className="text-sm text-muted hover:text-primary">
        ← All institutions
      </Link>

      <div className="mt-4 card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-lg font-bold text-primary">
              {inst.code?.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">{inst.name}</h1>
              <p className="text-sm text-muted">
                {inst.code}
                {inst.state ? ` · ${inst.state}` : ''}
                {inst.categoryName ? ` · ${inst.categoryName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {inst.hasPostUtme && <Badge className="bg-primary-light text-primary">Post-UTME</Badge>}
            <Badge className={open ? 'bg-green-50 text-success' : 'bg-amber-50 text-warning'}>
              {open ? 'Admissions open' : 'Admissions closed'}
            </Badge>
          </div>
        </div>
        {inst.description && <p className="mt-4 max-w-2xl text-sm text-muted">{inst.description}</p>}
        <div className="mt-6">
          {user?.role === 'applicant' || !user ? (
            <Button to={user ? `/app/apply?institution=${id}` : '/register'}>
              {user ? 'Apply to this institution' : 'Sign in to apply'}
            </Button>
          ) : null}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-primary-dark">Departments</h2>
      {!departments || departments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No departments listed yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="card p-5">
              <h3 className="font-semibold text-ink">{d.name}</h3>
              {d.code && <p className="text-xs text-muted">{d.code}</p>}
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Quota" value={d.admissionQuota} />
                <Row label="JAMB cutoff" value={d.jambCutoff} />
                {inst.hasPostUtme && <Row label="Aggregate cutoff" value={d.aggregateCutoff} />}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value ?? '—'}</dd>
    </div>
  );
}
