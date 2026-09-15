import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Info, Plus, Trash2, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { Modal, PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'];

const CATEGORY_HELP = {
  nationalMerit: 'Allocated strictly to the highest-performing candidates, regardless of state of origin, tribe or religion.',
  catchment: 'Reserved for candidates originating from the geographical states surrounding the institution.',
  elds: 'Reserved for candidates from states designated educationally less developed, ensuring equitable national representation.',
};

const SUBJECT_GROUP_LABEL = {
  core: 'Core subjects (Maths, English, Civic)',
  trade: 'Trade subjects',
  field: 'Field subjects',
};

const blank = {
  name: '',
  sessionLabel: '',
  totalApplicants: '',
  jambCutoff: '',
  applicationStart: '',
  applicationEnd: '',
  admissionRule: 'jamb_only',
  allocation: { nationalMerit: 45, catchment: 35, elds: 20 },
  distributionMode: 'auto',
  choicePositions: [1],
  olevelRequirements: [],
  departments: [],
};

export default function QuotaBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState(blank);
  const [allDepartments, setAllDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reqModal, setReqModal] = useState(false);
  const [status, setStatus] = useState('draft');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    (async () => {
      try {
        const depts = user?.institutionId
          ? (await api.get(`/institutions/${user.institutionId}/departments`)).data.data || []
          : [];
        setAllDepartments(depts);

        if (!isNew) {
          const { data } = await api.get(`/quotas/${id}`);
          const q = data.data;
          setStatus(q.status);
          setForm({
            name: q.name || '',
            sessionLabel: q.sessionLabel || '',
            totalApplicants: q.totalApplicants ?? '',
            jambCutoff: q.jambCutoff ?? '',
            applicationStart: q.applicationStart ? String(q.applicationStart).slice(0, 10) : '',
            applicationEnd: q.applicationEnd ? String(q.applicationEnd).slice(0, 10) : '',
            admissionRule: q.admissionRule || 'jamb_only',
            allocation: q.allocation || blank.allocation,
            distributionMode: q.distributionMode || 'auto',
            choicePositions: q.choicePositions?.length ? q.choicePositions : [1],
            olevelRequirements: q.olevelRequirements || [],
            departments: (q.departments || []).map((d) => ({
              departmentId: d.departmentId,
              allocated: d.allocated,
              isSelected: d.isSelected,
            })),
          });
        } else {
          // Default: every department selected.
          setForm((f) => ({
            ...f,
            departments: depts.map((d) => ({ departmentId: d.id, allocated: 0, isSelected: true })),
          }));
        }
      } catch (err) {
        toast.error(errMessage(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const allocationTotal = useMemo(
    () =>
      Number(form.allocation.nationalMerit || 0) +
      Number(form.allocation.catchment || 0) +
      Number(form.allocation.elds || 0),
    [form.allocation]
  );

  const selectedDeptIds = form.departments.filter((d) => d.isSelected).map((d) => d.departmentId);

  // Mirror the server's even split so the preview matches what will be saved.
  const autoPreview = useMemo(() => {
    const total = Number(form.totalApplicants) || 0;
    const n = selectedDeptIds.length;
    if (!n || total <= 0) return {};
    const base = Math.floor(total / n);
    let rem = total - base * n;
    const out = {};
    selectedDeptIds.forEach((idv) => {
      out[idv] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    });
    return out;
  }, [form.totalApplicants, selectedDeptIds.join(',')]);

  function allocationFor(deptId) {
    if (form.distributionMode === 'auto') return autoPreview[deptId] ?? 0;
    return form.departments.find((d) => d.departmentId === deptId)?.allocated ?? 0;
  }

  function toggleDept(deptId) {
    setForm((f) => {
      const exists = f.departments.find((d) => d.departmentId === deptId);
      if (exists) {
        return {
          ...f,
          departments: f.departments.map((d) =>
            d.departmentId === deptId ? { ...d, isSelected: !d.isSelected } : d
          ),
        };
      }
      return { ...f, departments: [...f.departments, { departmentId: deptId, allocated: 0, isSelected: true }] };
    });
  }

  function setManualAllocation(deptId, value) {
    setForm((f) => ({
      ...f,
      departments: f.departments.map((d) =>
        d.departmentId === deptId ? { ...d, allocated: Number(value) || 0 } : d
      ),
    }));
  }

  function toggleChoice(pos) {
    setForm((f) => ({
      ...f,
      choicePositions: f.choicePositions.includes(pos)
        ? f.choicePositions.filter((p) => p !== pos)
        : [...f.choicePositions, pos].sort(),
    }));
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Give this quota a name');
    if (allocationTotal !== 100) return toast.error(`Admission categories must total 100% (currently ${allocationTotal}%)`);

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sessionLabel: form.sessionLabel.trim() || undefined,
        totalApplicants: Number(form.totalApplicants) || 0,
        jambCutoff: Number(form.jambCutoff) || 0,
        applicationStart: form.applicationStart || undefined,
        applicationEnd: form.applicationEnd || undefined,
        admissionRule: form.admissionRule,
        allocation: {
          nationalMerit: Number(form.allocation.nationalMerit),
          catchment: Number(form.allocation.catchment),
          elds: Number(form.allocation.elds),
        },
        distributionMode: form.distributionMode,
        choicePositions: form.choicePositions,
        olevelRequirements: form.olevelRequirements,
        departments: form.departments.filter((d) => d.isSelected),
      };

      if (isNew) {
        const { data } = await api.post('/quotas', payload);
        toast.success('Quota created');
        nav(`/institution/quotas/${data.data.id}`, { replace: true });
      } else {
        await api.put(`/quotas/${id}`, payload);
        toast.success('Quota updated');
      }
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next) {
    try {
      await api.patch(`/quotas/${id}/status`, { status: next });
      setStatus(next);
      toast.success(`Quota ${next}`);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  if (loading) return <PageLoader />;

  const locked = status === 'finished';

  return (
    <div>
      <button onClick={() => nav('/institution/quotas')} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Quotas
      </button>

      <PageHeader
        title={isNew ? 'Create Quota' : 'Edit Quota'}
        subtitle="Create application quotas for the academic session."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => nav('/institution/quotas')}>Cancel</Button>
            {!isNew && status === 'draft' && <Button variant="subtle" onClick={() => changeStatus('open')}>Open cycle</Button>}
            {!isNew && status === 'open' && <Button variant="secondary" onClick={() => changeStatus('closed')}>Close cycle</Button>}
            <Button onClick={save} loading={saving} disabled={locked}>
              <Save className="h-4 w-4" /> {isNew ? 'Create Quota' : 'Update quota'}
            </Button>
          </div>
        }
      />

      {locked && (
        <div className="mb-5 flex gap-3 rounded-xl border border-warning/30 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-ink">This cycle is finished and can no longer be edited.</p>
        </div>
      )}

      <div className="space-y-6">
        {/* -------------------- Quota settings -------------------- */}
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-primary">Quota settings</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Input label="Quota name" value={form.name} onChange={set('name')} placeholder="e.g. Admissions 2026" required />
            <Input label="Total applicants" type="number" min="0" value={form.totalApplicants} onChange={set('totalApplicants')} placeholder="e.g. 2340" />
            <Input label="Cut-off mark (JAMB)" type="number" min="0" max="400" value={form.jambCutoff} onChange={set('jambCutoff')} placeholder="e.g. 200" />
            <Input label="Application start date" type="date" value={form.applicationStart} onChange={set('applicationStart')} />
            <Input label="Application end date" type="date" value={form.applicationEnd} onChange={set('applicationEnd')} />
            <Select label="Admission rule" value={form.admissionRule} onChange={set('admissionRule')}
                    hint="Ranking basis, in descending order">
              <option value="jamb_only">JAMB score only</option>
              <option value="jamb_postutme_average">Average of JAMB &amp; Post-UTME</option>
            </Select>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {/* Choices */}
            <div>
              <div className="flex gap-2.5 rounded-xl border border-border bg-primary-surface p-3.5">
                <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
                <p className="text-sm text-muted">Only students who selected your institution at the chosen position(s) may apply.</p>
              </div>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => toggleChoice(pos)}
                    className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${
                      form.choicePositions.includes(pos)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-white text-ink hover:border-primary/40'
                    }`}
                  >
                    {['1st', '2nd', '3rd', '4th'][pos - 1]}
                  </button>
                ))}
              </div>
            </div>

            {/* O'Level requirements */}
            <div>
              <div className="flex gap-2.5 rounded-xl border border-border bg-primary-surface p-3.5">
                <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
                <p className="text-sm text-muted">Set the minimum grade acceptable for applicants’ O'Level result(s).</p>
              </div>
              <Button variant="primary" className="mt-3 w-full" onClick={() => setReqModal(true)}>
                Add O'Level requirements <Plus className="h-4 w-4" />
              </Button>
              {form.olevelRequirements.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {form.olevelRequirements.map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-sm">
                      <span className="text-ink">
                        {SUBJECT_GROUP_LABEL[r.subjectGroup]} — min <strong>{r.minimumGrade}</strong>, {r.minCredits} credits
                      </span>
                      <button
                        onClick={() => setForm((f) => ({ ...f, olevelRequirements: f.olevelRequirements.filter((_, x) => x !== i) }))}
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* -------------------- Admission criteria -------------------- */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">Admission criteria</h2>
              <p className="mt-0.5 text-sm text-muted">Applicants will be distributed automatically or manually.</p>
            </div>
            <Badge className={allocationTotal === 100 ? 'bg-green-50 text-success' : 'bg-red-50 text-danger'}>
              Total {allocationTotal}%
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {[
              ['nationalMerit', 'National Merit (%)'],
              ['catchment', 'Catchment Area (%)'],
              ['elds', 'Educationally Less Developed States (%)'],
            ].map(([key, label]) => (
              <div key={key}>
                <Input
                  label={label}
                  type="number" min="0" max="100"
                  value={form.allocation[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, allocation: { ...f.allocation, [key]: e.target.value } }))
                  }
                />
                <p className="mt-2 rounded-xl bg-primary-surface p-3 text-xs leading-relaxed text-muted">
                  {CATEGORY_HELP[key]}
                </p>
              </div>
            ))}
          </div>
          {allocationTotal !== 100 && (
            <p className="mt-3 text-sm text-danger">These three categories must add up to exactly 100%.</p>
          )}
        </Card>

        {/* -------------------- Department distribution -------------------- */}
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">Department distribution</h2>
              <p className="mt-0.5 text-sm text-muted">Applicants will be distributed automatically or manually.</p>
            </div>
            <div className="flex rounded-xl border border-border p-1">
              {['auto', 'manual'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setForm((f) => ({ ...f, distributionMode: mode }))}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold capitalize transition ${
                    form.distributionMode === mode ? 'bg-primary text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {mode} distribute
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              checked={allDepartments.length > 0 && selectedDeptIds.length === allDepartments.length}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  departments: allDepartments.map((d) => ({
                    departmentId: d.id,
                    allocated: f.departments.find((x) => x.departmentId === d.id)?.allocated || 0,
                    isSelected: e.target.checked,
                  })),
                }))
              }
            />
            Select all departments
          </label>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[1fr,auto] bg-primary-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <span>Department</span><span>Allocated</span>
            </div>
            <div className="divide-y divide-border">
              {allDepartments.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  No departments yet — add them in Settings first.
                </p>
              )}
              {allDepartments.map((d) => {
                const selected = form.departments.find((x) => x.departmentId === d.id)?.isSelected;
                return (
                  <div key={d.id} className="grid grid-cols-[1fr,auto] items-center gap-3 px-4 py-2.5">
                    <label className="flex items-center gap-2.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleDept(d.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      {d.name}
                    </label>
                    {form.distributionMode === 'auto' ? (
                      <span className={`text-sm font-semibold ${selected ? 'text-ink' : 'text-muted'}`}>
                        {selected ? allocationFor(d.id) : 0}
                      </span>
                    ) : (
                      <input
                        type="number" min="0"
                        disabled={!selected}
                        value={allocationFor(d.id)}
                        onChange={(e) => setManualAllocation(d.id, e.target.value)}
                        className="input w-24 py-1.5 text-right"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-primary-surface px-4 py-3 text-sm">
              <span className="text-muted">{selectedDeptIds.length} department(s) selected</span>
              <span className="font-semibold text-ink">
                {selectedDeptIds.reduce((s, idv) => s + allocationFor(idv), 0).toLocaleString()} seats
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* -------------------- O'Level requirement modal -------------------- */}
      <RequirementModal
        open={reqModal}
        onClose={() => setReqModal(false)}
        onAdd={(req) =>
          setForm((f) => ({
            ...f,
            olevelRequirements: [...f.olevelRequirements.filter((r) => r.subjectGroup !== req.subjectGroup), req],
          }))
        }
      />
    </div>
  );
}

function RequirementModal({ open, onClose, onAdd }) {
  const [req, setReq] = useState({ subjectGroup: 'core', minimumGrade: 'C6', minCredits: 5, maxSittings: 2 });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add O'Level requirement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onAdd({ ...req, minCredits: Number(req.minCredits), maxSittings: Number(req.maxSittings) });
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Subject group"
          value={req.subjectGroup}
          onChange={(e) => setReq({ ...req, subjectGroup: e.target.value })}
        >
          <option value="core">Core subjects (Maths, English, Civic)</option>
          <option value="trade">Trade subjects</option>
          <option value="field">Field subjects</option>
        </Select>
        <Select
          label="Minimum grade"
          value={req.minimumGrade}
          onChange={(e) => setReq({ ...req, minimumGrade: e.target.value })}
        >
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Minimum credits" type="number" min="0" max="9"
            value={req.minCredits}
            onChange={(e) => setReq({ ...req, minCredits: e.target.value })}
          />
          <Select
            label="Maximum sittings"
            value={req.maxSittings}
            onChange={(e) => setReq({ ...req, maxSittings: e.target.value })}
          >
            <option value={1}>One sitting</option>
            <option value={2}>Two sittings</option>
          </Select>
        </div>
      </div>
    </Modal>
  );
}
