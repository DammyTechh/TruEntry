import { useEffect, useState } from 'react';
import { Building2, Mail, MailCheck, KeyRound, ShieldCheck, Search, Plus, CheckCircle2, Clock } from 'lucide-react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { NIGERIAN_STATES } from '../../lib/constants';
import api, { errMessage, fieldErrors } from '../../lib/api';

const REGIONS = [
  'North Central', 'North East', 'North West',
  'South East', 'South South', 'South West',
];

const emptyForm = {
  name: '', code: '', email: '', phone: '',
  state: '', region: '', lga: '', address: '',
  categoryId: '', logoUrl: '', hasPostUtme: false,
};

export default function Institutions() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState({});
  const { items, page, setPage, totalPages, total, loading, refetch } = usePaged('/admin/institutions', query);

  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // post-onboarding confirmation

  useEffect(() => {
    api.get('/institutions/categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  function applyFilters(e) {
    e?.preventDefault();
    const q = {};
    if (search.trim()) q.search = search.trim();
    if (typeFilter) q.type = typeFilter;
    setPage(1);
    setQuery(q);
  }

  async function onboard() {
    const next = {};
    if (!form.name.trim()) next.name = 'Institution name is required';
    if (!form.code.trim()) next.code = 'A short code is required';
    if (!form.email.trim()) next.email = 'An official email is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        email: form.email.trim(),
        hasPostUtme: form.hasPostUtme,
      };
      ['phone', 'state', 'region', 'lga', 'address', 'categoryId', 'logoUrl'].forEach((k) => {
        if (form[k]) payload[k] = typeof form[k] === 'string' ? form[k].trim() : form[k];
      });

      const { data } = await api.post('/admin/institutions', payload);
      setResult(data.data);
      setOpen(false);
      setForm(emptyForm);
      refetch();
      toast.success(
        data.data.credentialsEmailed
          ? 'Institution onboarded — credentials emailed.'
          : 'Institution onboarded, but the email failed. Use "Resend credentials".'
      );
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function resend(inst) {
    try {
      await api.post(`/admin/institutions/${inst.id}/resend-credentials`);
      toast.success(`New credentials sent to ${inst.account?.email || inst.email}`);
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Institution',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.logoUrl ? (
            <img src={r.logoUrl} alt="" className="h-9 w-9 rounded-lg border border-border object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-xs font-bold text-primary">
              {r.code?.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{r.name}</div>
            <div className="text-xs text-muted">{r.code}{r.state ? ` · ${r.state}` : ''}</div>
          </div>
        </div>
      ),
    },
    { key: 'region', header: 'Region', render: (r) => r.region || '—' },
    {
      key: 'institutionType',
      header: 'Type',
      render: (r) => (r.institutionType ? <Badge className="bg-primary-light text-primary">{label(r.institutionType)}</Badge> : '—'),
    },
    { key: 'hasPostUtme', header: 'Post-UTME', render: (r) => (r.hasPostUtme ? 'Yes' : 'No') },
    {
      key: 'account',
      header: 'Account',
      render: (r) =>
        !r.account ? (
          <Badge className="bg-red-50 text-danger">No login</Badge>
        ) : r.account.hasSignedIn && !r.account.mustChangePassword ? (
          <Badge className="bg-green-50 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Active</Badge>
        ) : (
          <Badge className="bg-amber-50 text-warning"><Clock className="h-3.5 w-3.5" /> Awaiting first sign-in</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button onClick={() => resend(r)} className="inline-flex items-center gap-1.5 text-sm link" title="Issue a new temporary password and email it">
          <KeyRound className="h-4 w-4" /> Resend
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Institutions"
        subtitle="Onboard schools and manage their platform access."
        action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Onboard institution</Button>}
      />

      <form onSubmit={applyFilters} className="mb-5 grid gap-3 sm:grid-cols-[1fr,220px,auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input className="input pl-11" placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="university">University</option>
          <option value="polytechnic">Polytechnic</option>
          <option value="college_of_education">College of Education</option>
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      {!loading && <p className="mb-3 text-sm text-muted">{total} institution{total === 1 ? '' : 's'}</p>}

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{
          title: 'No institutions yet',
          message: 'Onboard a school to create its account and email their sign-in details.',
          action: <Button onClick={() => setOpen(true)}>Onboard institution</Button>,
        }}
      />

      {/* ---------------- Onboard modal ---------------- */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Onboard an institution"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onboard} loading={saving}>Create & email credentials</Button>
          </>
        }
      >
        <div className="mb-4 flex gap-3 rounded-xl border border-border bg-primary-surface p-3.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted">
            The system creates one login for this school, generates a secure password, and emails it to the
            address below. They will be required to change it on first sign-in.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Institution name" required value={form.name} onChange={set('name')} error={errors.name} placeholder="e.g. Bowen University" />
          </div>
          <Input label="Code" required value={form.code} onChange={set('code')} error={errors.code} placeholder="e.g. BOWEN" />
          <Select label="Category" value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="sm:col-span-2">
            <Input label="Official email" type="email" required value={form.email} onChange={set('email')} error={errors.email}
                   hint="Credentials are sent here" placeholder="registrar@school.edu.ng" />
          </div>
          <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="080…" />
          <Select label="Region" value={form.region} onChange={set('region')}>
            <option value="">Select region</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select label="State" value={form.state} onChange={set('state')}>
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input label="LGA" value={form.lga} onChange={set('lga')} />
          <div className="sm:col-span-2">
            <Input label="Logo URL" value={form.logoUrl} onChange={set('logoUrl')} error={errors.logoUrl}
                   placeholder="https://…/logo.png" hint="Optional — shown across the institution's workspace" />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm text-ink">
            <input type="checkbox" checked={form.hasPostUtme} onChange={set('hasPostUtme')}
                   className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
            This institution runs a Post-UTME screening
          </label>
        </div>
      </Modal>

      {/* ---------------- Success confirmation ---------------- */}
      <Modal
        open={!!result}
        onClose={() => setResult(null)}
        title="Institution onboarded"
        footer={<Button onClick={() => setResult(null)}>Done</Button>}
      >
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-success">
                <Building2 className="h-5.5 w-5.5" />
              </div>
              <div>
                <div className="font-semibold text-ink">{result.institution.name}</div>
                <div className="text-sm text-muted">{result.institution.code}</div>
              </div>
            </div>
            <div className={`flex gap-3 rounded-xl border p-3.5 ${result.credentialsEmailed ? 'border-border bg-primary-surface' : 'border-warning/30 bg-amber-50'}`}>
              {result.credentialsEmailed
                ? <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                : <Mail className="mt-0.5 h-5 w-5 shrink-0 text-warning" />}
              <p className="text-sm text-muted">
                {result.credentialsEmailed
                  ? <>Sign-in details were emailed to <strong className="text-ink">{result.account.email}</strong>. They must change the password on first sign-in.</>
                  : <>The account was created but the email failed to send. Use <strong className="text-ink">Resend</strong> on the list to try again.</>}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function label(type) {
  return { university: 'University', polytechnic: 'Polytechnic', college_of_education: 'College of Education' }[type] || type;
}
