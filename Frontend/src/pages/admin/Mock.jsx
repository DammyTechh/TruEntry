import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, EmptyState } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { NIGERIAN_STATES } from '../../lib/constants';
import api, { errMessage } from '../../lib/api';

const KINDS = [
  { key: 'nin', label: 'NIN' },
  { key: 'jamb', label: 'JAMB' },
  { key: 'olevel', label: 'O-Level' },
];

// Which columns to surface per kind (keys are snake_case from the DB).
const COLUMNS = {
  nin: ['nin', 'first_name', 'last_name', 'date_of_birth', 'gender', 'state_of_origin'],
  jamb: ['jamb_reg_no', 'full_name', 'jamb_score', 'state_of_origin', 'exam_year'],
  olevel: ['exam_type', 'reg_no', 'full_name', 'exam_year'],
};

export default function Mock() {
  const toast = useToast();
  const [kind, setKind] = useState('nin');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/mock/${kind}`, { params: { limit: 50 } });
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    setForm({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create() {
    setSaving(true);
    try {
      const body = buildBody(kind, form);
      await api.post(`/admin/mock/${kind}`, body);
      toast.success('Mock record added');
      setOpen(false);
      setForm({});
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const cols = COLUMNS[kind];

  return (
    <div>
      <PageHeader
        title="Mock data"
        subtitle="Seeded NIN, JAMB and O-Level records used to verify applicants in test mode."
        action={<Button onClick={() => setOpen(true)}>Add record</Button>}
      />

      <div className="mb-5 inline-flex rounded-xl border border-border bg-white p-1">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${kind === k.key ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="No records" message="Add a mock record to test verification." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>{cols.map((c) => (<th key={c} className="px-4 py-3">{c.replace(/_/g, ' ')}</th>))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-primary-surface">
                  {cols.map((c) => (
                    <td key={c} className="px-4 py-3 text-ink">
                      {c === 'date_of_birth' && r[c] ? new Date(r[c]).toLocaleDateString() : (r[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Add mock ${kind.toUpperCase()} record`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={saving}>Add record</Button>
          </>
        }
      >
        <MockForm kind={kind} form={form} set={set} setForm={setForm} />
      </Modal>
    </div>
  );
}

function buildBody(kind, f) {
  if (kind === 'nin') {
    return {
      nin: (f.nin || '').trim(),
      firstName: f.firstName || undefined,
      lastName: f.lastName || undefined,
      dateOfBirth: f.dateOfBirth || undefined,
      gender: f.gender || undefined,
      stateOfOrigin: f.stateOfOrigin || undefined,
    };
  }
  if (kind === 'jamb') {
    return {
      jambRegNo: (f.jambRegNo || '').trim(),
      fullName: (f.fullName || '').trim(),
      jambScore: f.jambScore ? Number(f.jambScore) : undefined,
      dateOfBirth: f.dateOfBirth || undefined,
      gender: f.gender || undefined,
      stateOfOrigin: f.stateOfOrigin || undefined,
    };
  }
  // olevel
  const results = (f.resultsText || '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [subject, grade] = pair.split(':').map((s) => s.trim());
      return { subject, grade };
    });
  return {
    examType: f.examType || 'waec',
    regNo: (f.regNo || '').trim(),
    fullName: (f.fullName || '').trim(),
    results: results.length ? results : undefined,
  };
}

function MockForm({ kind, form, set, setForm }) {
  if (kind === 'nin') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Input label="NIN (11 digits)" value={form.nin || ''} onChange={(e) => setForm({ ...form, nin: e.target.value.replace(/\D/g, '').slice(0, 11) })} required /></div>
        <Input label="First name" value={form.firstName || ''} onChange={set('firstName')} />
        <Input label="Last name" value={form.lastName || ''} onChange={set('lastName')} />
        <Input label="Date of birth" type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} />
        <Select label="Gender" value={form.gender || ''} onChange={set('gender')}>
          <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
        </Select>
        <div className="col-span-2">
          <Select label="State of origin" value={form.stateOfOrigin || ''} onChange={set('stateOfOrigin')}>
            <option value="">—</option>{NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
        </div>
      </div>
    );
  }
  if (kind === 'jamb') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Input label="JAMB reg number" value={form.jambRegNo || ''} onChange={set('jambRegNo')} required placeholder="202512345678AB" /></div>
        <div className="col-span-2"><Input label="Full name" value={form.fullName || ''} onChange={set('fullName')} required /></div>
        <Input label="JAMB score" type="number" value={form.jambScore || ''} onChange={set('jambScore')} />
        <Input label="Date of birth" type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} />
        <Select label="Gender" value={form.gender || ''} onChange={set('gender')}>
          <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
        </Select>
        <Select label="State of origin" value={form.stateOfOrigin || ''} onChange={set('stateOfOrigin')}>
          <option value="">—</option>{NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Exam" value={form.examType || 'waec'} onChange={set('examType')}>
        <option value="waec">WAEC</option><option value="neco">NECO</option><option value="nabteb">NABTEB</option>
      </Select>
      <Input label="Registration number" value={form.regNo || ''} onChange={set('regNo')} required />
      <div className="col-span-2"><Input label="Full name" value={form.fullName || ''} onChange={set('fullName')} required /></div>
      <div className="col-span-2">
        <Input
          label="Results"
          value={form.resultsText || ''}
          onChange={set('resultsText')}
          placeholder="English:A1, Maths:B2, Physics:B3"
          hint="Comma-separated subject:grade pairs"
        />
      </div>
    </div>
  );
}
