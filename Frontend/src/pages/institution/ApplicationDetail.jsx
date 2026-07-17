import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button } from '../../components/ui/Primitives';
import { StatusBadge, PageLoader } from '../../components/ui/Misc';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

export default function ApplicationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState('');

  async function load() {
    try {
      const { data } = await api.get(`/applications/institution/${id}`);
      setApp(data.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function act(fn, okMsg) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!app) return <p className="text-muted">Application not found.</p>;

  const isOfficer = user.role === 'officer';
  const isRegistrar = user.role === 'registrar';
  const base = `/applications/institution/${id}`;

  return (
    <div>
      <Link to="/institution/applications" className="text-sm text-muted hover:text-primary">← Applications</Link>
      <PageHeader title={app.applicantName} subtitle={`${app.departmentName} · ${app.reference}`} action={<StatusBadge status={app.status} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Officer actions */}
          {isOfficer && app.status === 'submitted' && (
            <Card>
              <h3 className="font-semibold text-ink">Post-UTME consideration</h3>
              <p className="text-sm text-muted">Qualify or disqualify this applicant for Post-UTME.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => act(() => api.post(`${base}/consider-post-utme`, { qualified: true }), 'Marked qualified')} loading={busy}>
                  Qualify
                </Button>
                <Button variant="danger" onClick={() => act(() => api.post(`${base}/consider-post-utme`, { qualified: false }), 'Marked not qualified')} loading={busy}>
                  Disqualify
                </Button>
              </div>
            </Card>
          )}
          {isOfficer && app.status === 'qualified_post_utme' && (
            <Card>
              <h3 className="font-semibold text-ink">Record Post-UTME score</h3>
              <div className="mt-4 flex items-end gap-3">
                <Input label="Score (out of 100)" type="number" value={score} onChange={(e) => setScore(e.target.value)} className="w-48" />
                <Button
                  onClick={() => act(() => api.post(`${base}/post-utme-score`, { score: Number(score), maxScore: 100 }), 'Score recorded')}
                  loading={busy}
                  disabled={score === ''}
                >
                  Save score
                </Button>
              </div>
            </Card>
          )}
          {isOfficer && app.status === 'post_utme_completed' && (
            <Card>
              <h3 className="font-semibold text-ink">Recommend</h3>
              <p className="text-sm text-muted">Recommend this applicant for the registrar's approval.</p>
              <Button className="mt-4" onClick={() => act(() => api.post(`${base}/recommend`, {}), 'Recommended')} loading={busy}>
                Recommend for approval
              </Button>
            </Card>
          )}

          {/* Registrar actions */}
          {isRegistrar && app.status === 'recommended' && (
            <Card>
              <h3 className="font-semibold text-ink">Approval decision</h3>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => act(() => api.post(`${base}/approve`, {}), 'Approved')} loading={busy}>Approve</Button>
                <Button variant="danger" onClick={() => act(() => api.post(`${base}/reject`, {}), 'Rejected')} loading={busy}>Reject</Button>
              </div>
            </Card>
          )}
          {isRegistrar && app.status === 'approved' && (
            <Card>
              <h3 className="font-semibold text-ink">Forward to JAMB</h3>
              <Button className="mt-4" onClick={() => act(() => api.post(`${base}/forward-jamb`, {}), 'Forwarded to JAMB')} loading={busy}>
                Forward to JAMB
              </Button>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <h3 className="font-semibold text-ink">History</h3>
            <ol className="mt-4 space-y-3">
              {(app.history || []).map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div>
                    <StatusBadge status={h.to_status} />
                    {h.note && <p className="mt-1 text-sm text-muted">{h.note}</p>}
                    <p className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="h-fit">
          <h3 className="font-semibold text-ink">Applicant</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Email">{app.applicantEmail}</Row>
            <Row label="State">{app.state ?? '—'}</Row>
            <Row label="Age">{app.age ?? '—'}</Row>
            <Row label="JAMB">{app.jambScore ?? '—'}</Row>
            {app.postUtmeScore != null && <Row label="Post-UTME">{app.postUtmeScore}</Row>}
            {app.aggregateScore != null && <Row label="Aggregate">{app.aggregateScore}</Row>}
            {app.rank != null && <Row label="Rank">#{app.rank}</Row>}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  );
}
