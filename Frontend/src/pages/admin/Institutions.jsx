import { useEffect, useState } from 'react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { NIGERIAN_STATES } from '../../lib/constants';
import api, { errMessage } from '../../lib/api';

const empty = { name: '', code: '', state: '', email: '', hasPostUtme: false, categoryId: '' };

export default function Institutions() {
  const toast = useToast();
  const { items, page, setPage, totalPages, loading, refetch } = usePaged('/institutions');
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/institutions/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    if (!form.name.trim() || !form.code.trim()) return toast.error('Name and code are required');
    setSaving(true);
    try {
      await api.post('/institutions', {
        name: form.name.trim(),
        code: form.code.trim(),
        state: form.state || undefined,
        email: form.email.trim() || undefined,
        hasPostUtme: form.hasPostUtme,
        categoryId: form.categoryId || undefined,
      });
      toast.success('Institution created');
      setOpen(false);
      setForm(empty);
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'name', header: 'Institution', render: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'code', header: 'Code' },
    { key: 'state', header: 'State', render: (r) => r.state ?? '—' },
    { key: 'categoryName', header: 'Category', render: (r) => r.categoryName ?? '—' },
    { key: 'hasPostUtme', header: 'Post-UTME', render: (r) => r.hasPostUtme ? <Badge className="bg-primary-light text-primary">Yes</Badge> : <span className="text-muted">No</span> },
  ];

  return (
    <div>
      <PageHeader title="Institutions" action={<Button onClick={() => setOpen(true)}>Add institution</Button>} />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No institutions', message: 'Add the first institution to get started.' }}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add institution"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create institution</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Input label="Name" required value={form.name} onChange={set('name')} /></div>
          <Input label="Code" required value={form.code} onChange={set('code')} placeholder="e.g. UNILAG" />
          <Select label="State" value={form.state} onChange={set('state')}>
            <option value="">Select</option>
            {NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} />
          <Select label="Category" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">None</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
          <label className="col-span-2 mt-1 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.hasPostUtme} onChange={(e) => setForm({ ...form, hasPostUtme: e.target.checked })} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            This institution runs a Post-UTME screening
          </label>
        </div>
      </Modal>
    </div>
  );
}
