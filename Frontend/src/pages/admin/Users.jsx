import { useEffect, useState } from 'react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const ROLE_FILTERS = ['', 'applicant', 'officer', 'registrar', 'jamb', 'admin'];
const emptyStaff = { fullName: '', email: '', phone: '', role: 'officer', institutionId: '' };

export default function Users() {
  const toast = useToast();
  const [role, setRole] = useState('');
  const { items, page, setPage, totalPages, loading, refetch } = usePaged('/admin/users', role ? { role } : {});
  const [institutions, setInstitutions] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyStaff);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.get('/institutions', { params: { limit: 100 } }).then((r) => setInstitutions(r.data.data || [])).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function createStaff() {
    if (!form.fullName.trim() || !form.email.trim()) return toast.error('Name and email are required');
    if ((form.role === 'officer' || form.role === 'registrar') && !form.institutionId)
      return toast.error('Officers and registrars need an institution');
    setSaving(true);
    try {
      const { data } = await api.post('/admin/users/staff', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        institutionId: form.institutionId || undefined,
      });
      toast.success('Staff account created');
      setOpen(false);
      setForm(emptyStaff);
      if (data.data?.temporaryPassword) setCreated(data.data);
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    try {
      await api.patch(`/admin/users/${u.id}/active`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  const columns = [
    { key: 'fullName', header: 'Name', render: (r) => <span className="font-medium text-ink">{r.fullName}</span> },
    { key: 'email', header: 'Email', render: (r) => <span className="text-muted">{r.email}</span> },
    { key: 'role', header: 'Role', render: (r) => <Badge className="bg-primary-light text-primary capitalize">{r.role}</Badge> },
    { key: 'institutionName', header: 'Institution', render: (r) => r.institutionName ?? '—' },
    { key: 'isActive', header: 'Status', render: (r) => (
      <Badge className={r.isActive ? 'bg-green-50 text-success' : 'bg-red-50 text-danger'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', header: '', render: (r) => (
      <button onClick={() => toggleActive(r)} className="text-sm link">{r.isActive ? 'Deactivate' : 'Activate'}</button>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        action={
          <div className="flex items-center gap-3">
            <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-40">
              <option value="">All roles</option>
              {ROLE_FILTERS.filter(Boolean).map((r) => (<option key={r} value={r} className="capitalize">{r}</option>))}
            </Select>
            <Button onClick={() => setOpen(true)}>Add staff</Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No users', message: 'No users match this filter.' }}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add staff account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createStaff} loading={saving}>Create account</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Input label="Full name" required value={form.fullName} onChange={set('fullName')} /></div>
          <div className="col-span-2"><Input label="Email" type="email" required value={form.email} onChange={set('email')} /></div>
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
          <Select label="Role" value={form.role} onChange={set('role')}>
            <option value="officer">Admission Officer</option>
            <option value="registrar">Registrar</option>
            <option value="jamb">JAMB Regulator</option>
            <option value="admin">Administrator</option>
          </Select>
          {(form.role === 'officer' || form.role === 'registrar') && (
            <div className="col-span-2">
              <Select label="Institution" required value={form.institutionId} onChange={set('institutionId')}>
                <option value="">Select institution</option>
                {institutions.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
              </Select>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">A temporary password will be generated and emailed to the new staff member.</p>
      </Modal>

      {/* Show the temporary password once, after creation. */}
      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Staff account created"
        footer={<Button onClick={() => setCreated(null)}>Done</Button>}
      >
        <p className="text-sm text-muted">Share these credentials securely. The temporary password is shown only once.</p>
        <div className="mt-3 rounded-xl bg-primary-surface p-4 text-sm">
          <div><span className="text-muted">Email:</span> <b className="text-ink">{created?.user?.email}</b></div>
          <div className="mt-1"><span className="text-muted">Temporary password:</span> <b className="text-ink">{created?.temporaryPassword}</b></div>
        </div>
      </Modal>
    </div>
  );
}
