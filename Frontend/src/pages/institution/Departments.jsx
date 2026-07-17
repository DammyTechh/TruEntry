import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, EmptyState } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

const emptyDept = { name: '', code: '', admissionQuota: '', jambCutoff: '', aggregateCutoff: '' };

export default function Departments() {
  const { user } = useAuth();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyDept);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user?.institutionId) return;
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        api.get(`/institutions/${user.institutionId}/departments`),
        api.get('/institutions/me/parameters').catch(() => null),
      ]);
      setDepartments(d.data.data || []);
      setParams(p?.data?.data || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [user]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    if (!form.name.trim()) return toast.error('Department name is required');
    setSaving(true);
    try {
      await api.post('/institutions/me/departments', {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        admissionQuota: form.admissionQuota ? Number(form.admissionQuota) : undefined,
        jambCutoff: form.jambCutoff ? Number(form.jambCutoff) : undefined,
        aggregateCutoff: form.aggregateCutoff ? Number(form.aggregateCutoff) : undefined,
      });
      toast.success('Department created');
      setOpen(false);
      setForm(emptyDept);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Manage the programmes applicants can apply to."
        action={<Button onClick={() => setOpen(true)}>Add department</Button>}
      />

      {params && (
        <Card className="mb-6">
          <h3 className="font-semibold text-ink">Admission parameters</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Badge className={params.admissionOpen ? 'bg-green-50 text-success' : 'bg-amber-50 text-warning'}>
              {params.admissionOpen ? 'Admissions open' : 'Admissions closed'}
            </Badge>
            {params.admissionCriteria && (
              <Badge className="bg-primary-light text-primary">Criteria: {params.admissionCriteria.replace(/_/g, ' ')}</Badge>
            )}
            {params.postUtmeWeight != null && (
              <Badge className="bg-primary-light text-primary">Post-UTME weight: {params.postUtmeWeight}</Badge>
            )}
          </div>
        </Card>
      )}

      {departments.length === 0 ? (
        <EmptyState title="No departments yet" message="Add your first department to start receiving applications." action={<Button onClick={() => setOpen(true)}>Add department</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.id}>
              <h3 className="font-semibold text-ink">{d.name}</h3>
              {d.code && <p className="text-xs text-muted">{d.code}</p>}
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Quota" value={d.admissionQuota} />
                <Row label="JAMB cutoff" value={d.jambCutoff} />
                <Row label="Aggregate cutoff" value={d.aggregateCutoff} />
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add department"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create department</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Name" required value={form.name} onChange={set('name')} placeholder="e.g. Computer Science" />
          </div>
          <Input label="Code" value={form.code} onChange={set('code')} placeholder="CSC" />
          <Input label="Quota" type="number" value={form.admissionQuota} onChange={set('admissionQuota')} />
          <Input label="JAMB cutoff" type="number" value={form.jambCutoff} onChange={set('jambCutoff')} />
          <Input label="Aggregate cutoff" type="number" value={form.aggregateCutoff} onChange={set('aggregateCutoff')} />
        </div>
      </Modal>
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
