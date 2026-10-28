import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, X, BookOpen, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, EmptyState } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

const GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

// A sensible starting point an institution can edit or remove — every
// Nigerian course requires these two, so nobody has to type them every time.
const DEFAULT_REQUIREMENTS = [
  { subject: 'English Language', minimumGrade: 'C6', isCompulsory: true },
  { subject: 'Mathematics', minimumGrade: 'C6', isCompulsory: true },
];

const emptyForm = {
  name: '',
  code: '',
  admissionQuota: '',
  jambCutoff: '',
  aggregateCutoff: '',
  minCredits: 5,
  maxSittings: 2,
  olevelNotes: '',
  olevelRequirements: DEFAULT_REQUIREMENTS,
};

function toForm(department) {
  return {
    name: department.name || '',
    code: department.code || '',
    admissionQuota: department.admissionQuota ?? '',
    jambCutoff: department.jambCutoff ?? '',
    aggregateCutoff: department.aggregateCutoff ?? '',
    minCredits: department.minCredits ?? 5,
    maxSittings: department.maxSittings ?? 2,
    olevelNotes: department.olevelNotes || '',
    olevelRequirements: department.olevelRequirements?.length
      ? department.olevelRequirements
      : DEFAULT_REQUIREMENTS,
  };
}

export default function Departments() {
  const { user } = useAuth();
  const toast = useToast();

  const [departments, setDepartments] = useState([]);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null); // null | 'new' | department object
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null); // department pending confirmation
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([
        api.get('/workspace/departments'),
        api.get('/institutions/me/parameters').catch(() => null),
      ]);
      setDepartments(d.data.data || []);
      setParams(p?.data?.data || null);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [user?.institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function openCreate() {
    setForm(emptyForm);
    setEditing('new');
  }

  function openEdit(department) {
    setForm(toForm(department));
    setEditing(department);
  }

  /* ---------------------- O'Level requirement rows ---------------------- */

  function addRequirement() {
    setForm((f) => ({
      ...f,
      olevelRequirements: [...f.olevelRequirements, { subject: '', minimumGrade: 'C6', isCompulsory: true }],
    }));
  }

  function changeRequirement(index, key, value) {
    setForm((f) => ({
      ...f,
      olevelRequirements: f.olevelRequirements.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    }));
  }

  function removeRequirement(index) {
    setForm((f) => ({
      ...f,
      olevelRequirements: f.olevelRequirements.filter((_, i) => i !== index),
    }));
  }

  /* -------------------------------- Save -------------------------------- */

  async function save() {
    if (!form.name.trim()) return toast.error('Department name is required');

    const requirements = form.olevelRequirements
      .filter((r) => r.subject.trim())
      .map((r) => ({
        subject: r.subject.trim(),
        minimumGrade: r.minimumGrade || 'C6',
        isCompulsory: r.isCompulsory !== false,
      }));

    const duplicate = requirements
      .map((r) => r.subject.toLowerCase())
      .find((s, i, arr) => arr.indexOf(s) !== i);
    if (duplicate) return toast.error(`"${duplicate}" is listed twice — each subject can only appear once.`);

    const body = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      admissionQuota: form.admissionQuota === '' ? undefined : Number(form.admissionQuota),
      jambCutoff: form.jambCutoff === '' ? undefined : Number(form.jambCutoff),
      aggregateCutoff: form.aggregateCutoff === '' ? undefined : Number(form.aggregateCutoff),
      minCredits: Number(form.minCredits),
      maxSittings: Number(form.maxSittings),
      olevelNotes: form.olevelNotes.trim(),
      olevelRequirements: requirements,
    };

    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post('/workspace/departments', body);
        toast.success('Department created');
      } else {
        await api.put(`/workspace/departments/${editing.id}`, body);
        toast.success('Department updated');
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setRemoving(true);
    try {
      await api.delete(`/workspace/departments/${deleting.id}`);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  async function toggleActive(department) {
    try {
      await api.put(`/workspace/departments/${department.id}`, { isActive: !department.isActive });
      toast.success(department.isActive ? `${department.name} deactivated` : `${department.name} reopened`);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Manage the programmes applicants can apply to, and the O-Level requirements for each."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add department</Button>}
      />

      {params && (
        <Card className="mb-6">
          <h3 className="font-semibold text-ink">Admission parameters</h3>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Badge className={params.admissionOpen ? 'bg-green-50 text-success' : 'bg-amber-50 text-warning'}>
              {params.admissionOpen ? 'Admissions open' : 'Admissions closed'}
            </Badge>
            {params.admissionCriteria && (
              <Badge className="bg-primary-light text-primary">
                Criteria: {params.admissionCriteria.replace(/_/g, ' ')}
              </Badge>
            )}
            {params.postUtmeWeight != null && (
              <Badge className="bg-primary-light text-primary">Post-UTME weight: {params.postUtmeWeight}</Badge>
            )}
          </div>
        </Card>
      )}

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          message="Add your first department to start receiving applications."
          action={<Button onClick={openCreate}>Add department</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <DepartmentCard
              key={d.id}
              department={d}
              onEdit={() => openEdit(d)}
              onDelete={() => setDeleting(d)}
              onToggle={() => toggleActive(d)}
            />
          ))}
        </div>
      )}

      {/* ----------------------- Create / edit modal ----------------------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing === 'new' ? 'Add department' : `Edit ${editing?.name || 'department'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>
              {editing === 'new' ? 'Create department' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Name" required value={form.name} onChange={set('name')} placeholder="e.g. Computer Science" />
            </div>
            <Input label="Code" value={form.code} onChange={set('code')} placeholder="CSC" />
            <Input label="Quota (seats)" type="number" min="0" value={form.admissionQuota} onChange={set('admissionQuota')} />
            <Input label="JAMB cutoff" type="number" min="0" max="400" value={form.jambCutoff} onChange={set('jambCutoff')} />
            <Input label="Aggregate cutoff" type="number" min="0" value={form.aggregateCutoff} onChange={set('aggregateCutoff')} />
          </div>

          {/* ------------------- O'Level requirements ------------------- */}
          <div className="rounded-xl border border-border bg-primary-surface/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-ink">O-Level requirements</h4>
                <p className="text-sm text-muted">
                  Type in the subjects this course requires. Applicants are checked against these before they
                  can apply, and again when admissions are processed.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {form.olevelRequirements.map((req, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-end gap-2.5">
                  <Input
                    label={index === 0 ? 'Subject' : undefined}
                    value={req.subject}
                    onChange={(e) => changeRequirement(index, 'subject', e.target.value)}
                    placeholder="e.g. Physics"
                  />
                  <Select
                    label={index === 0 ? 'Minimum' : undefined}
                    value={req.minimumGrade}
                    onChange={(e) => changeRequirement(index, 'minimumGrade', e.target.value)}
                  >
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    aria-label={`Remove ${req.subject || 'subject'}`}
                    className="mb-0.5 flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-border bg-white text-muted transition hover:border-danger/40 hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRequirement}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-white px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary-light"
              >
                <Plus className="h-4 w-4" /> Add subject
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Minimum credits"
                type="number" min="0" max="9"
                value={form.minCredits}
                onChange={set('minCredits')}
                hint="Passes at C6 or better"
              />
              <Select label="Sittings accepted" value={form.maxSittings} onChange={set('maxSittings')}>
                <option value={1}>One sitting only</option>
                <option value={2}>Up to two sittings</option>
              </Select>
            </div>

            <div className="mt-3">
              <Input
                label="Notes (optional)"
                value={form.olevelNotes}
                onChange={set('olevelNotes')}
                placeholder="e.g. Physics may be substituted with Further Mathematics"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* -------------------------- Delete confirm -------------------------- */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete department"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={removing}>Delete</Button>
          </>
        }
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="text-ink">
              <strong>{deleting?.name}</strong> and its O-Level requirements will be removed permanently.
            </p>
            {deleting?.applicationCount > 0 ? (
              <p className="mt-2 text-muted">
                This course already has {deleting.applicationCount} application(s), so it cannot be deleted.
                Deactivate it instead to stop new applications while keeping the records.
              </p>
            ) : (
              <p className="mt-2 text-muted">This cannot be undone.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DepartmentCard({ department, onEdit, onDelete, onToggle }) {
  const requirements = department.olevelRequirements || [];
  const shown = useMemo(() => requirements.slice(0, 4), [requirements]);

  return (
    <Card className={department.isActive ? '' : 'opacity-70'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{department.name}</h3>
          <p className="text-xs text-muted">
            {department.code || '—'}
            {department.facultyName ? ` · ${department.facultyName}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label={`Edit ${department.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Delete ${department.name}`} danger onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <Row label="Quota" value={department.admissionQuota} />
        <Row label="JAMB cutoff" value={department.jambCutoff} />
        <Row label="Minimum credits" value={department.minCredits} />
        <Row label="Sittings" value={department.maxSittings === 1 ? 'One only' : 'Up to two'} />
      </dl>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">O-Level requirements</p>
        {requirements.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted">None set — only the institution-wide rules apply.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shown.map((r) => (
              <Badge key={r.subject} className="bg-primary-surface text-ink">
                {r.subject} · {r.minimumGrade}
              </Badge>
            ))}
            {requirements.length > shown.length && (
              <Badge className="bg-primary-surface text-muted">+{requirements.length - shown.length} more</Badge>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition hover:border-primary/40 hover:text-primary"
      >
        {department.isActive ? 'Deactivate' : 'Reopen'}
      </button>
    </Card>
  );
}

function IconButton({ children, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-muted transition ${
        danger ? 'hover:border-danger/40 hover:text-danger' : 'hover:border-primary/40 hover:text-primary'
      }`}
    >
      {children}
    </button>
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
