import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge } from '../../components/ui/Primitives';
import { Input, Select, PasswordInput } from '../../components/ui/Field';
import { Modal, PageLoader, Pagination } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

const strongPw = (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptModal, setDeptModal] = useState(null); // null | {} | department
  const [facModal, setFacModal] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 8;

  async function loadAll() {
    try {
      const [f, d] = await Promise.all([
        api.get('/workspace/faculties'),
        api.get('/workspace/departments'),
      ]);
      setFaculties(f.data.data || []);
      setDepartments(d.data.data || []);

      if (user?.institutionId) {
        try {
          const inst = await api.get(`/institutions/${user.institutionId}`);
          setProfile({ name: inst.data.data?.name || '', email: inst.data.data?.email || '' });
        } catch { /* profile is optional here */ }
      }
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api.put(`/institutions/${user.institutionId}`, { name: profile.name, email: profile.email });
      toast.success('Organisation profile updated');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (!strongPw(pw.newPassword)) {
      return toast.error('New password needs 8+ characters with upper, lower and a number');
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingPw(false);
    }
  }

  async function removeDepartment(d) {
    if (!window.confirm(`Delete ${d.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/workspace/departments/${d.id}`);
      toast.success('Department deleted');
      loadAll();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  if (loading) return <PageLoader />;

  const totalPages = Math.max(1, Math.ceil(departments.length / perPage));
  const pageRows = departments.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your organisation profile, security and departments." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Organisation profile */}
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-primary">Organisation profile</h2>
          <p className="mt-0.5 text-sm text-muted">Update the basic details shown across your institution workspace.</p>
          <div className="mt-5 space-y-4">
            <Input label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Input label="Email" type="email" required value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <div className="flex justify-end">
              <Button onClick={saveProfile} loading={savingProfile}><Save className="h-4 w-4" /> Save changes</Button>
            </div>
          </div>
        </Card>

        {/* Change password */}
        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-primary">Change password</h2>
          <p className="mt-0.5 text-sm text-muted">Change your current password.</p>
          <div className="mt-5 space-y-4">
            <PasswordInput
              label="Current password" required
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              placeholder="Enter current password"
            />
            <PasswordInput
              label="New password" required
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              placeholder="Enter new password"
              hint="8+ characters, with upper, lower and a number"
            />
            <div className="flex justify-end">
              <Button onClick={savePassword} loading={savingPw}><Save className="h-4 w-4" /> Save changes</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Departments */}
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-primary">Departments</h2>
            <p className="mt-0.5 text-sm text-muted">Group departments under a faculty and set their cut-offs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setFacModal(true)}>
              <Building2 className="h-4 w-4" /> Add faculty
            </Button>
            <Button onClick={() => setDeptModal({})}>
              <Plus className="h-4 w-4" /> Add department
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">JAMB cut-off</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 && (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-muted">No departments yet.</td></tr>
              )}
              {pageRows.map((d) => (
                <tr key={d.id} className="hover:bg-primary-surface">
                  <td className="px-4 py-3 text-muted">{d.facultyName || '—'}</td>
                  <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                  <td className="px-4 py-3">{d.jambCutoff || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={d.isActive ? 'bg-green-50 text-success' : 'bg-primary-surface text-muted'}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setDeptModal(d)} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => removeDepartment(d)} className="inline-flex items-center gap-1 text-danger hover:underline">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="mt-4 text-sm text-muted">{departments.length} department(s)</p>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </Card>

      <DepartmentModal
        open={!!deptModal}
        department={deptModal}
        faculties={faculties}
        onClose={() => setDeptModal(null)}
        onSaved={() => { setDeptModal(null); loadAll(); }}
      />
      <FacultyModal
        open={facModal}
        onClose={() => setFacModal(false)}
        onSaved={() => { setFacModal(false); loadAll(); }}
      />
    </div>
  );
}

function FacultyModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error('Enter a faculty name');
    setSaving(true);
    try {
      await api.post('/workspace/faculties', { name: name.trim() });
      toast.success('Faculty created');
      setName('');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Add a faculty"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Create faculty</Button></>}
    >
      <Input label="Faculty" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Medical sciences" required />
    </Modal>
  );
}

function DepartmentModal({ open, department, faculties, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!department?.id;
  const [form, setForm] = useState({ name: '', code: '', facultyId: '', jambCutoff: '', admissionQuota: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: department?.name || '',
      code: department?.code || '',
      facultyId: department?.facultyId || '',
      jambCutoff: department?.jambCutoff ?? '',
      admissionQuota: department?.admissionQuota ?? '',
    });
  }, [open, department]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    if (!form.name.trim()) return toast.error('Enter a department name');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        facultyId: form.facultyId || undefined,
        jambCutoff: form.jambCutoff === '' ? undefined : Number(form.jambCutoff),
        admissionQuota: form.admissionQuota === '' ? undefined : Number(form.admissionQuota),
      };
      if (isEdit) await api.put(`/workspace/departments/${department.id}`, payload);
      else await api.post('/workspace/departments', payload);
      toast.success(isEdit ? 'Department updated' : 'Department created');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? 'Edit department' : 'Add a department'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{isEdit ? 'Save changes' : 'Create department'}</Button></>}
    >
      <div className="space-y-4">
        <Select label="Faculty" value={form.facultyId} onChange={set('facultyId')}>
          <option value="">No faculty</option>
          {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
        <Input label="Department name (course)" value={form.name} onChange={set('name')} placeholder="e.g. Civil Engineering" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Code" value={form.code} onChange={set('code')} placeholder="e.g. CVE" />
          <Input label="JAMB cut-off" type="number" min="0" max="400" value={form.jambCutoff} onChange={set('jambCutoff')} />
        </div>
        <Input label="Admission quota" type="number" min="0" value={form.admissionQuota} onChange={set('admissionQuota')} hint="Default seats for this department" />
      </div>
    </Modal>
  );
}
