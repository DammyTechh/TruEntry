import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button } from '../../components/ui/Primitives';
import { Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function Apply() {
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [completion, setCompletion] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState(params.get('institution') || '');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [policy, setPolicy] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, inst] = await Promise.all([
          api.get('/profile/completion'),
          api.get('/institutions', { params: { limit: 100 } }),
        ]);
        setCompletion(c.data.data);
        setInstitutions(inst.data.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!institutionId) {
      setDepartments([]);
      setPolicy(null);
      return;
    }
    (async () => {
      try {
        const [d, pol] = await Promise.all([
          api.get(`/institutions/${institutionId}/departments`),
          api.get('/policies/active', { params: { institutionId } }).catch(() => null),
        ]);
        setDepartments(d.data.data || []);
        setPolicy(pol?.data?.data || null);
      } catch {
        setDepartments([]);
      }
    })();
    setDepartmentId('');
    setAccepted(false);
  }, [institutionId]);

  async function submit() {
    if (!institutionId || !departmentId) return toast.error('Pick an institution and department');
    if (!accepted) return toast.error('You must accept the admission policy');
    setSubmitting(true);
    try {
      const { data } = await api.post('/applications', {
        institutionId,
        departmentId,
        policyId: policy?.id,
        policyAccepted: true,
      });
      const appId = data.data.id;
      toast.success('Application created. Redirecting to payment…');
      // Initialize payment and redirect to Paystack.
      const pay = await api.post('/payments/initialize', { applicationId: appId });
      const url = pay.data?.data?.authorizationUrl;
      if (url) {
        window.location.href = url;
      } else {
        nav(`/app/applications/${appId}`);
      }
    } catch (err) {
      toast.error(errMessage(err));
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;

  if (!completion?.canApply) {
    return (
      <div>
        <PageHeader title="Apply" />
        <Card>
          <h3 className="font-semibold text-ink">Finish your profile first</h3>
          <p className="mt-1 text-sm text-muted">
            You need a verified NIN, complete biodata and a passport photo before you can apply.
          </p>
          <Button to="/app/profile" className="mt-4">Complete profile</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Apply" subtitle="Choose where you'd like to study." />
      <Card className="max-w-2xl">
        <div className="space-y-4">
          <Select label="Institution" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} required>
            <option value="">Select institution</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </Select>

          <Select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required disabled={!institutionId}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.jambCutoff ? ` (cutoff ${d.jambCutoff})` : ''}
              </option>
            ))}
          </Select>

          {policy && (
            <div className="rounded-xl border border-border bg-primary-surface p-4">
              <div className="text-sm font-semibold text-ink">{policy.title || 'Admission policy'}</div>
              {policy.contentHtml ? (
                <div className="prose prose-sm mt-2 max-h-40 overflow-y-auto text-sm text-muted" dangerouslySetInnerHTML={{ __html: policy.contentHtml }} />
              ) : policy.pdfUrl ? (
                <a href={policy.pdfUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm link">
                  View policy document (PDF)
                </a>
              ) : null}
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                I have read and accept the admission policy.
              </label>
            </div>
          )}

          <Button onClick={submit} loading={submitting} disabled={!departmentId || (policy && !accepted)} className="w-full">
            Continue to payment
          </Button>
        </div>
      </Card>
    </div>
  );
}
