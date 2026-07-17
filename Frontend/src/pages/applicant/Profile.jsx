import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { NIGERIAN_STATES, OLEVEL_TYPES } from '../../lib/constants';

function VerifiedTag({ ok }) {
  return ok ? (
    <Badge className="bg-green-50 text-success">Verified</Badge>
  ) : (
    <Badge className="bg-amber-50 text-warning">Not verified</Badge>
  );
}

export default function Profile() {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get('/profile');
      setProfile(data.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (loading) return <PageLoader />;
  const p = profile?.profile || {};

  return (
    <div>
      <PageHeader title="Profile & verification" subtitle="Verify your identity and results to unlock applications." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Biodata p={p} onSaved={load} />
        <Photo p={p} onSaved={load} />
        <Nin p={p} onSaved={load} />
        <Jamb p={p} onSaved={load} />
        <Olevel p={p} onSaved={load} />
      </div>
    </div>
  );
}

function Biodata({ p, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    entryMode: p.entryMode || 'utme',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
    gender: p.gender || '',
    stateOfOrigin: p.stateOfOrigin || '',
    lga: p.lga || '',
    address: p.address || '',
    location: p.location || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      await api.put('/profile', form);
      toast.success('Biodata saved');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-ink">Biodata</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select label="Entry mode" value={form.entryMode} onChange={set('entryMode')}>
          <option value="utme">UTME</option>
          <option value="direct_entry">Direct Entry</option>
        </Select>
        <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        <Select label="Gender" value={form.gender} onChange={set('gender')}>
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>
        <Select label="State of origin" value={form.stateOfOrigin} onChange={set('stateOfOrigin')}>
          <option value="">Select</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Input label="LGA" value={form.lga} onChange={set('lga')} />
        <Input label="Location" value={form.location} onChange={set('location')} placeholder="City / area" />
        <div className="col-span-2">
          <Input label="Address" value={form.address} onChange={set('address')} />
        </div>
      </div>
      <Button onClick={save} loading={saving} className="mt-4">Save biodata</Button>
    </Card>
  );
}

function Photo({ p, onSaved }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(p.profileImageUrl || null);
  const [saving, setSaving] = useState(false);

  function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return toast.error('Choose an image first');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post('/profile/image', fd);
      toast.success('Photo uploaded');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Passport photograph</h3>
        <VerifiedTag ok={!!p.profileImageUrl} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-border bg-primary-surface">
          {preview ? (
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted">No photo</span>
          )}
        </div>
        <div className="flex-1">
          <input type="file" accept="image/*" onChange={pick} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-2 file:text-primary" />
          <Button onClick={upload} loading={saving} size="sm" className="mt-3">Upload photo</Button>
        </div>
      </div>
    </Card>
  );
}

function Nin({ p, onSaved }) {
  const toast = useToast();
  const [nin, setNin] = useState('');
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      await api.post('/profile/verify-nin', { nin: nin.trim() });
      toast.success('NIN verified');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">NIN verification</h3>
        <VerifiedTag ok={p.ninVerified} />
      </div>
      {p.ninVerified ? (
        <p className="mt-3 text-sm text-muted">Your NIN is verified{p.nin ? ` (${p.nin})` : ''}.</p>
      ) : (
        <div className="mt-4 flex items-end gap-3">
          <Input label="NIN" value={nin} onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="11 digits" className="flex-1" />
          <Button onClick={verify} loading={loading}>Verify</Button>
        </div>
      )}
    </Card>
  );
}

function Jamb({ p, onSaved }) {
  const toast = useToast();
  const [reg, setReg] = useState('');
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      await api.post('/profile/verify-jamb', { jambRegNo: reg.trim() });
      toast.success('JAMB verified');
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">JAMB verification</h3>
        <VerifiedTag ok={p.jambVerified} />
      </div>
      {p.jambVerified ? (
        <p className="mt-3 text-sm text-muted">
          Verified · {p.jambRegNo} {p.jambScore != null ? `· score ${p.jambScore}` : ''}
        </p>
      ) : (
        <div className="mt-4 flex items-end gap-3">
          <Input label="JAMB reg number" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="e.g. 202512345678AB" className="flex-1" />
          <Button onClick={verify} loading={loading}>Verify</Button>
        </div>
      )}
    </Card>
  );
}

function Olevel({ p, onSaved }) {
  const toast = useToast();
  const [examType, setExamType] = useState('waec');
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      const { data } = await api.post('/profile/verify-olevel', { examType, regNo: regNo.trim() });
      toast.success(`O-Level verified · ${data.data?.credits ?? ''} credits`);
      onSaved();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">O-Level verification</h3>
        <VerifiedTag ok={p.olevelVerified} />
      </div>
      {p.olevelVerified ? (
        <div className="mt-3">
          <p className="text-sm text-muted">Verified · {p.olevelExamType?.toUpperCase()} · {p.olevelRegNo}</p>
          {Array.isArray(p.olevelResults) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.olevelResults.map((r, i) => (
                <span key={i} className="rounded-lg bg-primary-surface px-2.5 py-1 text-xs text-ink">
                  {r.subject}: <b>{r.grade}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-end gap-3">
          <Select label="Exam" value={examType} onChange={(e) => setExamType(e.target.value)} className="w-40">
            {OLEVEL_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Input label="Registration number" value={regNo} onChange={(e) => setRegNo(e.target.value)} className="flex-1" />
          <Button onClick={verify} loading={loading}>Verify</Button>
        </div>
      )}
    </Card>
  );
}
