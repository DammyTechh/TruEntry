import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge } from '../../components/ui/Primitives';
import { StatusBadge, PaymentBadge, PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function ApplicationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/applications/mine/${id}`);
      setApp(data.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function pay() {
    setBusy(true);
    try {
      const { data } = await api.post('/payments/initialize', { applicationId: id });
      const url = data?.data?.authorizationUrl;
      if (url) window.location.href = url;
      else toast.error('Could not start payment');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadLetter() {
    setBusy(true);
    try {
      // The endpoint either returns JSON { url } or streams the PDF bytes.
      const res = await api.get(`/admission-letters/${id}`, { responseType: 'blob' });
      const blob = res.data;
      if (blob.type.includes('application/json')) {
        const parsed = JSON.parse(await blob.text());
        const url = parsed?.data?.url;
        if (url) window.open(url, '_blank');
        else toast.info('Your letter is being prepared. Try again shortly.');
      } else {
        // Streamed PDF — trigger a download.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admission-letter-${app.reference || id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (!app) return <p className="text-muted">Application not found.</p>;

  return (
    <div>
      <Link to="/app/applications" className="text-sm text-muted hover:text-primary">← My applications</Link>
      <PageHeader
        title={app.institutionName}
        subtitle={`${app.departmentName} · ${app.reference}`}
        action={<StatusBadge status={app.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Action banners */}
          {app.status === 'pending_payment' && (
            <Card className="border-l-4 border-l-warning">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-ink">Payment required</h3>
                  <p className="text-sm text-muted">Pay the application fee to submit your application.</p>
                </div>
                <Button onClick={pay} loading={busy}>Pay now</Button>
              </div>
            </Card>
          )}
          {app.status === 'qualified_post_utme' && <PostUtme id={id} onDone={load} />}
          {app.status === 'admitted' && (
            <Card className="border-l-4 border-l-success">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-ink">Congratulations — you're admitted! 🎉</h3>
                  <p className="text-sm text-muted">Download your provisional admission letter.</p>
                </div>
                <Button onClick={downloadLetter} loading={busy}>Download letter</Button>
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <h3 className="font-semibold text-ink">Progress</h3>
            <ol className="mt-4 space-y-4">
              {(app.history || []).map((h, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    {i < app.history.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-2">
                    <StatusBadge status={h.to_status} />
                    {h.note && <p className="mt-1 text-sm text-muted">{h.note}</p>}
                    <p className="mt-0.5 text-xs text-muted">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Summary */}
        <Card className="h-fit">
          <h3 className="font-semibold text-ink">Summary</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Payment"><PaymentBadge status={app.paymentStatus} /></Row>
            <Row label="JAMB score">{app.jambScore ?? '—'}</Row>
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
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

function PostUtme({ id, onDone }) {
  const toast = useToast();
  const [center, setCenter] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/applications/mine/${id}/post-utme`, { center: center.trim() || undefined });
      toast.success('Post-UTME details submitted');
      onDone();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <h3 className="font-semibold text-ink">You're qualified for Post-UTME</h3>
      <p className="text-sm text-muted">Submit your preferred details. The institution will schedule and score your Post-UTME.</p>
      <div className="mt-4 flex items-end gap-3">
        <input className="input flex-1" placeholder="Preferred centre (optional)" value={center} onChange={(e) => setCenter(e.target.value)} />
        <Button onClick={submit} loading={busy}>Submit</Button>
      </div>
    </Card>
  );
}
