import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, EmptyState } from '../../components/ui/Primitives';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';
import DepartmentEditor from '../../components/institution/DepartmentEditor';

export default function Departments() {
  const { user } = useAuth();
  const toast = useToast();

  const [departments, setDepartments] = useState([]);
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null); // null | 'new' | department object
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

  function openCreate() {
    setEditing('new');
  }

  function openEdit(department) {
    setEditing(department);
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
        subtitle="Manage the programmes applicants can apply to: seats, minimum scores and O-Level requirements."
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
      <DepartmentEditor
        open={!!editing}
        department={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />

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
        <Row label="Min. JAMB score" value={department.jambCutoff || 'None'} />
        {department.postUtmeCutoff > 0 && <Row label="Min. Post-UTME" value={department.postUtmeCutoff} />}
        {department.aggregateCutoff > 0 && <Row label="Min. aggregate" value={department.aggregateCutoff} />}
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
