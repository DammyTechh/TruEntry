import { useEffect, useState } from 'react';
import { BookOpen, Gauge, Plus, X } from 'lucide-react';
import { Button } from '../ui/Primitives';
import { Input, Select } from '../ui/Field';
import { Modal } from '../ui/Misc';
import { useToast } from '../ui/Toast';
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
  facultyId: '',
  admissionQuota: '',
  jambCutoff: '',
  postUtmeCutoff: '',
  aggregateCutoff: '',
  minCredits: 5,
  maxSittings: 2,
  olevelNotes: '',
  olevelRequirements: DEFAULT_REQUIREMENTS,
};

const blankIfZero = (v) => (v === null || v === undefined || Number(v) === 0 ? '' : v);

function toForm(department) {
  if (!department?.id) return emptyForm;
  return {
    name: department.name || '',
    code: department.code || '',
    facultyId: department.facultyId || '',
    admissionQuota: department.admissionQuota ?? '',
    jambCutoff: blankIfZero(department.jambCutoff),
    postUtmeCutoff: blankIfZero(department.postUtmeCutoff),
    aggregateCutoff: blankIfZero(department.aggregateCutoff),
    minCredits: department.minCredits ?? 5,
    maxSittings: department.maxSittings ?? 2,
    olevelNotes: department.olevelNotes || '',
    olevelRequirements: department.olevelRequirements?.length
      ? department.olevelRequirements
      : DEFAULT_REQUIREMENTS,
  };
}

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

/**
 * Create or edit a department: its name, seats, SCORE REQUIREMENTS (JAMB,
 * Post-UTME, aggregate) and O'Level requirements. Used by both the Departments
 * page and Settings so the two can never drift apart again.
 *
 * Props:
 *   open, department (null/{} for new), faculties (optional list),
 *   hasPostUtme (shows the Post-UTME and aggregate fields), onClose, onSaved
 */
export default function DepartmentEditor({ open, department, faculties, hasPostUtme = true, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(department?.id);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(department));
    setErrors({});
  }, [open, department]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((cur) => ({ ...cur, [key]: undefined }));
  };

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
    setForm((f) => ({ ...f, olevelRequirements: f.olevelRequirements.filter((_, i) => i !== index) }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = 'Department name is required.';
    const range = (key, max, label) => {
      const v = num(form[key]);
      if (v !== undefined && (Number.isNaN(v) || v < 0 || v > max)) next[key] = `${label} must be between 0 and ${max}.`;
    };
    range('jambCutoff', 400, 'JAMB score');
    range('postUtmeCutoff', 100, 'Post-UTME score');
    range('aggregateCutoff', 100, 'Aggregate');
    if (num(form.admissionQuota) !== undefined && num(form.admissionQuota) < 0) next.admissionQuota = 'Seats cannot be negative.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;

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

    // An emptied score field means "no minimum", which is stored as 0.
    const body = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      admissionQuota: num(form.admissionQuota),
      jambCutoff: num(form.jambCutoff) ?? 0,
      postUtmeCutoff: num(form.postUtmeCutoff) ?? 0,
      aggregateCutoff: num(form.aggregateCutoff) ?? 0,
      minCredits: Number(form.minCredits),
      maxSittings: Number(form.maxSittings),
      olevelNotes: form.olevelNotes.trim(),
      olevelRequirements: requirements,
    };
    if (faculties) body.facultyId = form.facultyId || (isEdit ? null : undefined);

    setSaving(true);
    try {
      if (isEdit) await api.put(`/workspace/departments/${department.id}`, body);
      else await api.post('/workspace/departments', body);
      toast.success(isEdit ? 'Department updated' : 'Department created');
      onSaved?.();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${department?.name || 'department'}` : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{isEdit ? 'Save changes' : 'Create department'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Name" required value={form.name} onChange={set('name')} placeholder="e.g. Computer Science" error={errors.name} />
          </div>
          <Input label="Code" value={form.code} onChange={set('code')} placeholder="CSC" />
          <Input label="Seats (quota)" type="number" min="0" value={form.admissionQuota} onChange={set('admissionQuota')} error={errors.admissionQuota} />
          {faculties && (
            <div className="sm:col-span-2">
              <Select label="Faculty" value={form.facultyId} onChange={set('facultyId')}>
                <option value="">No faculty</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
          )}
        </div>

        {/* ---------------------- Score requirements ---------------------- */}
        <section className="rounded-xl border border-border bg-primary-surface/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
              <Gauge className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-ink">Score requirements</h4>
              <p className="text-sm text-muted">
                The minimum scores for this course. Applicants below them cannot apply, and are never admitted
                when admissions are processed. Leave a field empty for no minimum. Post-UTME and aggregate
                minimums apply to admission cycles that rank on JAMB + Post-UTME.
              </p>
            </div>
          </div>
          <div className={`mt-4 grid grid-cols-1 gap-3 ${hasPostUtme ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
            <Input
              label="Minimum JAMB score"
              type="number" min="0" max="400"
              value={form.jambCutoff}
              onChange={set('jambCutoff')}
              placeholder="e.g. 200"
              hint="Out of 400"
              error={errors.jambCutoff}
            />
            {hasPostUtme && (
              <>
                <Input
                  label="Minimum Post-UTME score"
                  type="number" min="0" max="100"
                  value={form.postUtmeCutoff}
                  onChange={set('postUtmeCutoff')}
                  placeholder="e.g. 50"
                  hint="Out of 100"
                  error={errors.postUtmeCutoff}
                />
                <Input
                  label="Minimum aggregate"
                  type="number" min="0" max="100"
                  value={form.aggregateCutoff}
                  onChange={set('aggregateCutoff')}
                  placeholder="e.g. 60"
                  hint="(JAMB ÷ 4 + Post-UTME) ÷ 2"
                  error={errors.aggregateCutoff}
                />
              </>
            )}
          </div>
        </section>

        {/* -------------------- O'Level requirements -------------------- */}
        <section className="rounded-xl border border-border bg-primary-surface/40 p-4">
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
        </section>
      </div>
    </Modal>
  );
}
