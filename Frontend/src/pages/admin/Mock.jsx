import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X, GraduationCap } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, EmptyState } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { NIGERIAN_STATES } from '../../lib/constants';
import api, { errMessage, fieldErrors } from '../../lib/api';

const KINDS = [
  { key: 'jamb', label: 'JAMB' },
  { key: 'olevel', label: 'O-Level' },
];

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

const EMPTY = {
  jamb: {
    regNo: '', fullName: '', jambScore: '', dateOfBirth: '', gender: '', stateOfOrigin: '', examYear: '',
    choices: [{ position: 1, institutionId: '', departmentId: '' }],
  },
  olevel: {
    examType: 'waec', regNo: '', fullName: '', examYear: '',
    resultsText: 'English Language:C4, Mathematics:B3, Physics:B3, Chemistry:C4, Biology:B2',
  },
};

/**
 * Demo JAMB and O'Level records, used while those exam APIs are unavailable.
 *
 * A JAMB record carries the candidate's institution + course CHOICES, picked
 * from institutions and departments that exist on TruEntry. After the
 * applicant pays and verifies, those choices are what they see and apply to,
 * so a tester can walk the whole flow into a real institution's admissions.
 */
export default function Mock() {
  const toast = useToast();
  const [kind, setKind] = useState('jamb');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY.jamb);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/mock/${kind}`, { params: { limit: 100 } });
      setRows(data.data || []);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function openCreate() {
    setForm(EMPTY[kind]);
    setEditingId(null);
    setErrors({});
    setOpen(true);
  }

  function openEdit(row) {
    setForm(kind === 'jamb' ? jambRowToForm(row) : olevelRowToForm(row));
    setEditingId(row.id);
    setErrors({});
    setOpen(true);
  }

  async function save() {
    const { body, problems } = buildBody(kind, form);
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/mock/${kind}`, body);
      toast.success(editingId ? 'Record updated' : 'Record added');
      setOpen(false);
      await load();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/admin/mock/${kind}/${deleting.id}`);
      toast.success('Record deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Mock data"
        subtitle="Demo JAMB and O’Level records used while those exam APIs are unavailable. A JAMB record’s choices decide which institutions and courses the applicant can apply to."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add record</Button>}
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
        <EmptyState
          title="No records"
          message={kind === 'jamb'
            ? 'Add a JAMB record with the institution and course the applicant chose.'
            : 'Add the O’Level result an applicant will verify.'}
          action={<Button onClick={openCreate}>Add record</Button>}
        />
      ) : kind === 'jamb' ? (
        <JambTable rows={rows} onEdit={openEdit} onDelete={setDeleting} />
      ) : (
        <OlevelTable rows={rows} onEdit={openEdit} onDelete={setDeleting} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size={kind === 'jamb' ? 'lg' : 'md'}
        title={`${editingId ? 'Edit' : 'Add'} ${kind === 'jamb' ? 'JAMB' : 'O’Level'} record`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editingId ? 'Save changes' : 'Add record'}</Button>
          </>
        }
      >
        {kind === 'jamb'
          ? <JambForm form={form} setForm={setForm} errors={errors} lockRegNo={!!editingId} />
          : <OlevelForm form={form} setForm={setForm} errors={errors} lockRegNo={!!editingId} />}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink">
          Delete <strong>{deleting?.full_name}</strong> ({deleting?.jamb_reg_no || deleting?.reg_no})? Applicants
          who have not verified yet will no longer find this record.
        </p>
      </Modal>
    </div>
  );
}

/* --------------------------------- Tables --------------------------------- */

function RowActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-3">
      <button onClick={() => onEdit(row)} className="inline-flex items-center gap-1 text-primary hover:underline">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
      <button onClick={() => onDelete(row)} className="inline-flex items-center gap-1 text-danger hover:underline">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </div>
  );
}

function JambTable({ rows, onEdit, onDelete }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Reg number</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Institution &amp; course choices</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const choices = Array.isArray(r.choices) ? r.choices : [];
            return (
              <tr key={r.id} className="align-top hover:bg-primary-surface">
                <td className="px-4 py-3 font-mono text-xs text-ink">{r.jamb_reg_no}</td>
                <td className="px-4 py-3 text-ink">{r.full_name}</td>
                <td className="px-4 py-3 text-ink">{r.jamb_score != null ? Number(r.jamb_score) : '—'}</td>
                <td className="px-4 py-3 text-muted">{r.state_of_origin || '—'}</td>
                <td className="px-4 py-3">
                  {choices.length === 0 ? (
                    <span className="text-xs text-warning">No choices — the applicant will have nothing to apply to</span>
                  ) : (
                    <ul className="space-y-1">
                      {choices.map((c) => (
                        <li key={c.position} className="text-xs">
                          <Badge className="mr-1.5 bg-primary-light text-primary">{ORDINAL[c.position] || c.position}</Badge>
                          <span className="text-ink">{c.institution}</span>
                          <span className="text-muted"> · {c.course || 'no course'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3"><RowActions row={r} onEdit={onEdit} onDelete={onDelete} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OlevelTable({ rows, onEdit, onDelete }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Exam</th>
            <th className="px-4 py-3">Reg number</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Results</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="align-top hover:bg-primary-surface">
              <td className="px-4 py-3 uppercase text-ink">{r.exam_type}</td>
              <td className="px-4 py-3 font-mono text-xs text-ink">{r.reg_no}</td>
              <td className="px-4 py-3 text-ink">{r.full_name}</td>
              <td className="px-4 py-3 text-xs text-muted">
                {(r.results || []).map((x) => `${x.subject} ${x.grade}`).join(', ') || '—'}
              </td>
              <td className="px-4 py-3"><RowActions row={r} onEdit={onEdit} onDelete={onDelete} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- Forms --------------------------------- */

function jambRowToForm(r) {
  const choices = Array.isArray(r.choices) && r.choices.length
    ? r.choices.map((c) => ({
        position: Number(c.position) || 1,
        institutionId: c.institutionId || '',
        departmentId: c.departmentId || '',
        // Records from before choices were picked from the platform only have
        // names; keep them visible so the admin knows to re-pick.
        legacy: !c.institutionId ? `${c.institution || ''}${c.course ? ` · ${c.course}` : ''}` : '',
      }))
    : [{ position: 1, institutionId: '', departmentId: '' }];
  return {
    regNo: r.jamb_reg_no || '',
    fullName: r.full_name || '',
    jambScore: r.jamb_score != null ? String(Number(r.jamb_score)) : '',
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : '',
    gender: r.gender || '',
    stateOfOrigin: r.state_of_origin || '',
    examYear: r.exam_year ? String(r.exam_year) : '',
    choices,
  };
}

function olevelRowToForm(r) {
  return {
    examType: r.exam_type || 'waec',
    regNo: r.reg_no || '',
    fullName: r.full_name || '',
    examYear: r.exam_year ? String(r.exam_year) : '',
    resultsText: (r.results || []).map((x) => `${x.subject}:${x.grade}`).join(', '),
  };
}

function buildBody(kind, f) {
  const problems = {};
  if ((f.regNo || '').trim().length < 6) problems.regNo = 'Registration number must be at least 6 characters.';
  if ((f.fullName || '').trim().length < 2) problems.fullName = 'Enter the candidate’s full name.';

  if (kind === 'jamb') {
    const score = Number(f.jambScore);
    if (f.jambScore === '' || Number.isNaN(score) || score < 0 || score > 400) {
      problems.jambScore = 'Enter a JAMB score between 0 and 400.';
    }
    const choices = (f.choices || []).filter((c) => c.institutionId);
    if (!choices.length) problems.choices = 'Pick at least one institution the candidate chose.';
    const positions = choices.map((c) => Number(c.position));
    if (new Set(positions).size !== positions.length) problems.choices = 'Each choice position can only be used once.';

    return {
      problems,
      body: {
        regNo: f.regNo.trim(),
        fullName: f.fullName.trim(),
        jambScore: score,
        dateOfBirth: f.dateOfBirth || undefined,
        gender: f.gender || undefined,
        stateOfOrigin: f.stateOfOrigin || undefined,
        examYear: f.examYear ? Number(f.examYear) : undefined,
        choices: choices.map((c) => ({
          position: Number(c.position),
          institutionId: c.institutionId,
          departmentId: c.departmentId || undefined,
        })),
      },
    };
  }

  const results = (f.resultsText || '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [subject, grade] = pair.split(':').map((s) => (s || '').trim());
      return { subject, grade: (grade || '').toUpperCase() };
    });
  if (!results.length || results.some((r) => !r.subject || !r.grade)) {
    problems.resultsText = 'Enter results as subject:grade pairs, e.g. English Language:C4, Mathematics:B3';
  }
  return {
    problems,
    body: {
      examType: f.examType || 'waec',
      regNo: (f.regNo || '').trim(),
      fullName: (f.fullName || '').trim(),
      results,
      examYear: f.examYear ? Number(f.examYear) : undefined,
    },
  };
}

function JambForm({ form, setForm, errors, lockRegNo }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState({}); // institutionId -> list

  useEffect(() => {
    api.get('/institutions', { params: { limit: 100 } })
      .then((r) => setInstitutions(r.data?.data || []))
      .catch(() => setInstitutions([]));
  }, []);

  // Load the departments of every institution that has been picked.
  const picked = useMemo(
    () => [...new Set((form.choices || []).map((c) => c.institutionId).filter(Boolean))],
    [form.choices]
  );
  useEffect(() => {
    picked.forEach((id) => {
      if (departments[id]) return;
      api.get(`/institutions/${id}/departments`)
        .then((r) => setDepartments((cur) => ({ ...cur, [id]: (r.data?.data || []).filter((d) => d.isActive !== false) })))
        .catch(() => setDepartments((cur) => ({ ...cur, [id]: [] })));
    });
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

  function setChoice(index, key, value) {
    setForm((f) => ({
      ...f,
      choices: f.choices.map((c, i) => {
        if (i !== index) return c;
        // Changing institution clears the course, which belonged to the old one.
        return key === 'institutionId' ? { ...c, institutionId: value, departmentId: '', legacy: '' } : { ...c, [key]: value };
      }),
    }));
  }

  function addChoice() {
    setForm((f) => {
      const used = new Set(f.choices.map((c) => Number(c.position)));
      const next = [1, 2, 3, 4].find((p) => !used.has(p));
      if (!next) return f;
      return { ...f, choices: [...f.choices, { position: next, institutionId: '', departmentId: '' }] };
    });
  }

  function removeChoice(index) {
    setForm((f) => ({ ...f, choices: f.choices.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="JAMB reg number" required value={form.regNo} onChange={set('regNo')}
          placeholder="202512345678AB" error={errors.regNo} disabled={lockRegNo}
          hint={lockRegNo ? 'Delete and re-add to change the number' : undefined}
        />
        <Input label="Full name" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
        <Input label="JAMB score" type="number" min="0" max="400" required value={form.jambScore} onChange={set('jambScore')} error={errors.jambScore} />
        <Input label="Exam year" type="number" value={form.examYear} onChange={set('examYear')} placeholder="2026" />
        <Input label="Date of birth" type="date" style={{ minWidth: 0 }} value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        <Select label="Gender" value={form.gender} onChange={set('gender')}>
          <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
        </Select>
        <div className="sm:col-span-2">
          <Select label="State of origin" value={form.stateOfOrigin} onChange={set('stateOfOrigin')} hint="Used for catchment / ELDS categories">
            <option value="">—</option>{NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </Select>
        </div>
      </div>

      <Card className="border border-border bg-primary-surface/40 p-4 shadow-none">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="font-semibold text-ink">Institution &amp; course choices</h4>
            <p className="text-sm text-muted">
              What the candidate chose on JAMB. After verification these are the only places they can apply to.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {form.choices.map((c, index) => {
            const depts = departments[c.institutionId] || [];
            return (
              <div key={index} className="rounded-xl border border-border bg-white p-3">
                <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <Select label="Choice" value={c.position} onChange={(e) => setChoice(index, 'position', Number(e.target.value))}>
                    {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{ORDINAL[p]}</option>)}
                  </Select>
                  <Select label="Institution" value={c.institutionId} onChange={(e) => setChoice(index, 'institutionId', e.target.value)}>
                    <option value="">Select institution…</option>
                    {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </Select>
                  <Select
                    label="Course (department)"
                    value={c.departmentId}
                    onChange={(e) => setChoice(index, 'departmentId', e.target.value)}
                    disabled={!c.institutionId}
                  >
                    <option value="">
                      {!c.institutionId ? 'Pick an institution first' : depts.length ? 'Select course…' : 'No departments yet'}
                    </option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeChoice(index)}
                    disabled={form.choices.length === 1}
                    aria-label="Remove choice"
                    className="mb-0.5 flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-border bg-white text-muted transition hover:text-danger disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {c.legacy && (
                  <p className="mt-2 text-xs text-warning">Previously saved as “{c.legacy}” — pick it from the list to link it.</p>
                )}
              </div>
            );
          })}
          {errors.choices && <p className="text-xs text-danger">{errors.choices}</p>}
          {form.choices.length < 4 && (
            <button
              type="button"
              onClick={addChoice}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-white px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary-light"
            >
              <Plus className="h-4 w-4" /> Add another choice
            </button>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted">
        The applicant also needs a matching O’Level record (O-Level tab) for the registration number they enter at onboarding.
      </p>
    </div>
  );
}

function OlevelForm({ form, setForm, errors, lockRegNo }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Exam" value={form.examType} onChange={set('examType')} disabled={lockRegNo}>
        <option value="waec">WAEC</option><option value="neco">NECO</option><option value="nabteb">NABTEB</option>
      </Select>
      <Input label="Registration number" value={form.regNo} onChange={set('regNo')} required error={errors.regNo} disabled={lockRegNo} />
      <Input label="Full name" value={form.fullName} onChange={set('fullName')} required error={errors.fullName} />
      <Input label="Exam year" type="number" value={form.examYear} onChange={set('examYear')} placeholder="2025" />
      <div className="col-span-2">
        <Input
          label="Results"
          value={form.resultsText}
          onChange={set('resultsText')}
          placeholder="English Language:C4, Mathematics:B3, Physics:B3"
          hint="Comma-separated subject:grade pairs. Use the same subject names as the department’s requirements."
          error={errors.resultsText}
        />
      </div>
    </div>
  );
}
