import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Lock, Users, Search,
  AlertTriangle, ShieldCheck, Shuffle, X, ListChecks, Download,
} from 'lucide-react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, StatCard } from '../../components/ui/Primitives';
import { DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Field';
import { Modal, PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const CYCLE_STATUS = {
  draft: { label: 'Draft', cls: 'bg-primary-surface text-muted' },
  open: { label: 'Accepting', cls: 'bg-amber-50 text-warning' },
  closed: { label: 'Closed', cls: 'bg-primary-light text-primary' },
  processing: { label: 'Processing', cls: 'bg-primary-light text-primary' },
  finished: { label: 'Finished', cls: 'bg-green-50 text-success' },
};

const CATEGORY = {
  national_merit: 'National Merit',
  catchment: 'Catchment',
  elds: 'ELDS',
};

/* ------------------------- List of admission cycles ------------------------ */

export default function Admissions() {
  const nav = useNavigate();
  const { items, page, setPage, totalPages, loading } = usePaged('/quotas');

  const columns = [
    { key: 'name', header: 'Quota', render: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { key: 'allocatedSeats', header: 'Size', render: (r) => (r.allocatedSeats ?? 0).toLocaleString() },
    { key: 'appliedCount', header: 'Applied', render: (r) => (r.appliedCount ?? 0).toLocaleString() },
    { key: 'admittedCount', header: 'Admitted', render: (r) => (r.admittedCount ? r.admittedCount.toLocaleString() : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const m = CYCLE_STATUS[r.status] || CYCLE_STATUS.draft;
        return <Badge className={m.cls}>{m.label}</Badge>;
      },
    },
    {
      key: 'open',
      header: '',
      render: (r) => <button onClick={() => nav(`/institution/admissions/${r.id}`)} className="text-sm link">Open</button>,
    },
  ];

  return (
    <div>
      <PageHeader title="Admissions" subtitle="Review and process admissions for each cycle." />
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onRowClick={(r) => nav(`/institution/admissions/${r.id}`)}
        empty={{ title: 'No admission cycles', message: 'Create a quota first, then process admissions here.' }}
      />
    </div>
  );
}

/* --------------------- Applicant review for one cycle --------------------- */

export function AdmissionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ departmentId: '', status: '' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [switchFor, setSwitchFor] = useState(null);
  const [changeOffers, setChangeOffers] = useState([]);

  const params = {};
  if (filters.departmentId) params.departmentId = filters.departmentId;
  if (filters.status) params.status = filters.status;
  if (search.trim()) params.search = search.trim();

  const { items, page, setPage, totalPages, total, loading: listLoading, refetch } =
    usePaged(`/quotas/${id}/admissions/applicants`, params);

  async function loadSummary() {
    try {
      const [s, d, o] = await Promise.all([
        api.get(`/quotas/${id}/admissions/summary`),
        api.get('/workspace/departments'),
        api.get(`/quotas/${id}/admissions/change-offers`).catch(() => null),
      ]);
      setSummary(s.data.data);
      setDepartments(d.data.data || []);
      setChangeOffers(o?.data?.data || []);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [id]);

  async function runPreview() {
    setBusy(true);
    try {
      const { data } = await api.post(`/quotas/${id}/admissions/process`, { commit: false });
      setPreview(data.data);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const { data } = await api.post(`/quotas/${id}/admissions/process`, { commit: true });
      toast.success(data.message);
      setPreview(null);
      loadSummary();
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(application, admit) {
    try {
      await api.post(`/quotas/applications/${application.id}/decide`, {
        admit,
        note: admit ? 'Added to admission list' : 'Not admitted this cycle',
      });
      toast.success(`${application.applicantName} ${admit ? 'admitted' : 'rejected'}`);
      loadSummary();
      refetch();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function closeCycle() {
    if (!window.confirm('Finish this admission cycle? No further processing will be possible.')) return;
    try {
      await api.post(`/quotas/${id}/admissions/close`);
      toast.success('Admission cycle finished');
      loadSummary();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  if (loading) return <PageLoader />;
  const finished = summary?.quota?.status === 'finished';

  const columns = [
    {
      key: 'applicantName',
      header: 'Applicant',
      render: (r) => (
        <div>
          <div className="font-medium text-ink">{r.applicantName}</div>
          <div className="text-xs text-muted">{r.applicantEmail}</div>
        </div>
      ),
    },
    { key: 'departmentName', header: 'Department' },
    { key: 'stateOfOrigin', header: 'State', render: (r) => r.stateOfOrigin || '—' },
    { key: 'jambScore', header: 'JAMB', render: (r) => <span className="font-semibold text-ink">{r.jambScore ?? '—'}</span> },
    // Editable, because an institution runs its own Post-UTME and needs the
    // scores in before a cycle ranked on the JAMB + Post-UTME average can be
    // processed. Only shown when the cycle actually uses it.
    ...(summary?.quota?.admissionRule === 'jamb_postutme_average'
      ? [{
          key: 'postUtmeScore',
          header: 'Post-UTME',
          render: (r) => <PostUtmeCell row={r} quotaId={id} onSaved={() => { refetch(); loadSummary(); }} />,
        }]
      : []),
    { key: 'rankingScore', header: 'Rank score', render: (r) => r.rankingScore ?? '—' },
    {
      key: 'admissionCategory',
      header: 'Category',
      render: (r) => (r.admissionCategory ? <Badge className="bg-primary-light text-primary">{CATEGORY[r.admissionCategory]}</Badge> : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge className={r.status === 'admitted' ? 'bg-green-50 text-success' : r.status === 'rejected' ? 'bg-red-50 text-danger' : 'bg-primary-surface text-muted'}>
          {String(r.status).replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-2.5 text-sm">
          {r.status !== 'admitted' && !finished && (
            <button onClick={() => decide(r, true)} className="inline-flex items-center gap-1 text-success hover:underline">
              <CheckCircle2 className="h-3.5 w-3.5" /> Admit
            </button>
          )}
          {r.status !== 'rejected' && !finished && (
            <button onClick={() => decide(r, false)} className="inline-flex items-center gap-1 text-danger hover:underline">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          )}
          {!finished && (
            <button onClick={() => setSwitchFor(r)} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Shuffle className="h-3.5 w-3.5" /> Move
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <button onClick={() => nav('/institution/admissions')} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Admissions
      </button>

      <PageHeader
        title={summary?.quota?.name || 'Admissions'}
        subtitle={
          summary?.quota?.admissionRule === 'jamb_postutme_average'
            ? 'Ranked on the average of JAMB and Post-UTME, in descending order.'
            : 'Ranked on JAMB score, in descending order.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Badge className={(CYCLE_STATUS[summary?.quota?.status] || CYCLE_STATUS.draft).cls}>
              {(CYCLE_STATUS[summary?.quota?.status] || CYCLE_STATUS.draft).label}
            </Badge>
            {!finished && (
              <>
                <Button variant="secondary" onClick={runPreview} loading={busy}>
                  <Play className="h-4 w-4" /> Preview admissions
                </Button>
                <Button variant="danger" onClick={closeCycle}>
                  <Lock className="h-4 w-4" /> Close admission
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applicants" value={(summary?.total ?? 0).toLocaleString()} icon={Users} />
        <StatCard label="Seats" value={(summary?.allocatedSeats ?? 0).toLocaleString()} icon={ShieldCheck} />
        <StatCard label="Admitted" value={(summary?.admitted ?? 0).toLocaleString()} icon={CheckCircle2} tone="success" accent="text-success" />
        <StatCard label="Pending" value={(summary?.pending ?? 0).toLocaleString()} icon={AlertTriangle} tone="warning" accent="text-warning" />
      </div>

      <AdmissionListPanel quotaId={id} />

      <ChangeOffersPanel offers={changeOffers} />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr,200px,200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input
            className="input pl-11"
            placeholder="Search by name, email or reference"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={filters.departmentId} onChange={(e) => { setFilters({ ...filters, departmentId: e.target.value }); setPage(1); }}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="change_offered">Course change offered</option>
          <option value="admitted">Admitted</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {!listLoading && <p className="mb-3 text-sm text-muted">{total} applicant(s)</p>}

      <DataTable
        columns={columns}
        rows={items}
        loading={listLoading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No applicants', message: 'Applicants appear here once they apply to this cycle.' }}
      />

      {/* Preview of the ranked exercise */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Admission preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
            <Button onClick={commit} loading={busy}>
              <CheckCircle2 className="h-4 w-4" /> Admit all selected
            </Button>
          </>
        }
      >
        {preview && (
          <div className="max-h-[55vh] space-y-5 overflow-y-auto">
            <p className="text-sm text-muted">
              Nothing has been saved yet. Candidates are ranked in descending order and placed against each
              department's seats, honouring the regulatory split.
            </p>
            {preview.changeOffers?.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-amber-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 px-4 py-2.5">
                  <span className="font-semibold text-ink">Change-of-course offers</span>
                  <span className="text-xs text-muted">{preview.changeOffers.length} candidate(s)</span>
                </div>
                <p className="px-4 pt-3 text-xs text-muted">
                  Seats still open after everyone was considered against the course they applied for. These
                  candidates meet the requirements, so they will be asked to change course — nobody is moved
                  until they accept.
                </p>
                <ul className="mt-2 divide-y divide-warning/20">
                  {preview.changeOffers.map((o) => (
                    <li key={o.applicationId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="text-ink">{o.applicantName}</span>
                      <span className="text-muted">
                        {o.fromDepartmentId ? '' : ''}→ <strong className="text-ink">{o.toDepartmentName}</strong>
                        <span className="ml-2">score {o.rankingScore}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.results.map((r) => (
              <div key={r.departmentId} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary-surface px-4 py-2.5">
                  <span className="font-semibold text-ink">{r.departmentName}</span>
                  <span className="text-xs text-muted">
                    {r.selected.length} of {r.allocated} seat(s)
                    {r.alreadyAdmitted > 0 && ` · ${r.alreadyAdmitted} already admitted`}
                  </span>
                </div>
                {r.selected.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">No new candidates qualify.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {r.selected.map((s) => (
                      <li key={s.applicationId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-ink">#{s.rank} {s.applicantName}</span>
                        <span className="flex items-center gap-2 text-muted">
                          JAMB {s.jambScore}
                          <Badge className="bg-primary-light text-primary">{CATEGORY[s.category]}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {r.waitlisted.length > 0 && (
                  <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
                    {r.waitlisted.length} not selected — {r.waitlisted[0].reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Move to another department */}
      <SwitchDepartmentModal
        application={switchFor}
        departments={departments}
        onClose={() => setSwitchFor(null)}
        onDone={() => { setSwitchFor(null); refetch(); loadSummary(); }}
      />
    </div>
  );
}

/**
 * The candidate's Post-UTME score, editable in place.
 *
 * An institution runs its own Post-UTME, so the scores have to get in before a
 * cycle ranked on the JAMB + Post-UTME average means anything. A score typed
 * here outranks any demo value and is never overwritten by one.
 */
function PostUtmeCell({ row, quotaId, onSaved }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.postUtmeScore ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    const score = Number(value);
    if (value === '' || Number.isNaN(score) || score < 0) {
      return toast.error('Enter a Post-UTME score');
    }
    setSaving(true);
    try {
      await api.patch(`/quotas/${quotaId}/admissions/${row.id}/post-utme`, { score, maxScore: 100 });
      toast.success(`Post-UTME recorded for ${row.applicantName}`);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(row.postUtmeScore ?? ''); setEditing(true); }}
        aria-label={`${row.postUtmeScore != null ? 'Change' : 'Set'} the Post-UTME score for ${row.applicantName}`}
        title={`Set a Post-UTME score for ${row.applicantName}`}
        className="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-left transition hover:border-border hover:bg-white"
      >
        <span className={row.postUtmeScore != null ? 'font-semibold text-ink' : 'text-muted'}>
          {row.postUtmeScore ?? 'Set'}
        </span>
        {row.postUtmeSource === 'mock' && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-warning">demo</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min="0" max="100" autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-16 rounded-lg border border-border px-2 py-1 text-sm"
        aria-label={`Post-UTME score for ${row.applicantName}`}
      />
      <Button size="sm" onClick={save} loading={saving}>Save</Button>
      <button type="button" onClick={() => setEditing(false)} className="px-1 text-muted hover:text-ink" aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Everyone admitted in this cycle, grouped by course and ranked within it —
 * the list an institution publishes and sends to JAMB after a run.
 *
 * Until now a run reported only how many were admitted, with no way to see
 * or export who they were.
 */
function AdmissionListPanel({ quotaId }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/quotas/${quotaId}/admissions/list`);
      setData(res.data.data);
      setOpen(true);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function download(type, label) {
    setDownloading(true);
    try {
      const res = await api.post('/reports/generate', { type }, { responseType: 'blob' });
      const blob = res.data;
      if (blob.type && blob.type.includes('application/json')) {
        const parsed = JSON.parse(await blob.text());
        const url = parsed?.data?.pdfUrl || parsed?.data?.url;
        if (url) window.open(url, '_blank', 'noopener');
        else throw new Error('No report was returned.');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(`${label} downloaded`);
    } catch (err) {
      // Errors arrive as a blob on this request, so read the body first.
      let message = errMessage(err);
      const d = err?.response?.data;
      if (d instanceof Blob) {
        try { message = JSON.parse(await d.text())?.message || message; } catch { /* keep */ }
      }
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Admission list</h3>
            <p className="text-sm text-muted">
              Everyone admitted in this cycle, by course and in rank order — ready to publish or send to JAMB.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={load} loading={loading}>
            {open ? 'Refresh' : 'View list'}
          </Button>
          <Button onClick={() => download('admitted_list', 'Admission list')} loading={downloading}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      {open && data && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-5 border-b border-border pb-3 text-sm">
            <span><strong className="text-ink">{data.totalAdmitted}</strong> <span className="text-muted">admitted</span></span>
            <span><strong className="text-ink">{data.allocatedSeats}</strong> <span className="text-muted">seats</span></span>
            {Object.entries(data.byCategory || {}).map(([k, v]) => (
              <span key={k} className="text-muted">
                {k.replace(/_/g, ' ')}: <strong className="text-ink">{v}</strong>
              </span>
            ))}
          </div>

          {data.departments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Nobody has been admitted in this cycle yet. Process the cycle and commit the run first.
            </p>
          ) : data.departments.map((d) => (
            <div key={d.departmentId} className="mt-5">
              <h4 className="font-semibold text-ink">
                {d.departmentName}{' '}
                <span className="font-normal text-muted">· {d.candidates.length} admitted</span>
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Candidate</th>
                      <th className="py-2 pr-3">JAMB no.</th>
                      <th className="py-2 pr-3">JAMB</th>
                      <th className="py-2 pr-3">Aggregate</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {d.candidates.map((c) => (
                      <tr key={c.applicationId}>
                        <td className="py-2 pr-3 text-muted">{c.rank}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-ink">{c.applicantName}</div>
                          <div className="text-xs text-muted">{c.reference}</div>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted">{c.jambRegNo || '—'}</td>
                        <td className="py-2 pr-3 text-ink">{c.jambScore ?? '—'}</td>
                        <td className="py-2 pr-3 text-ink">{c.aggregateScore ?? '—'}</td>
                        <td className="py-2 pr-3 text-muted">{(c.admissionCategory || '—').replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-3 text-muted">{c.stateOfOrigin || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const OFFER_STATUS = {
  offered: { label: 'Awaiting applicant', cls: 'bg-amber-50 text-warning' },
  accepted: { label: 'Accepted', cls: 'bg-green-50 text-success' },
  declined: { label: 'Declined', cls: 'bg-red-50 text-danger' },
  withdrawn: { label: 'Superseded', cls: 'bg-primary-surface text-muted' },
  expired: { label: 'Expired', cls: 'bg-primary-surface text-muted' },
};

/**
 * The second pass of processing: seats that were still empty once every
 * applicant had been judged against the course they actually applied to,
 * offered to candidates who meet the alternative course's requirements.
 */
function ChangeOffersPanel({ offers }) {
  if (!offers?.length) return null;

  const waiting = offers.filter((o) => o.status === 'offered').length;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-warning">
            <Shuffle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Change-of-course offers</h3>
            <p className="text-sm text-muted">
              Candidates who missed out on their own course but qualify for a seat still open elsewhere.
              Each has been asked to change course; their application only moves if they accept.
            </p>
          </div>
        </div>
        <Badge className="bg-amber-50 text-warning">{waiting} awaiting a reply</Badge>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2">Applicant</th>
              <th className="py-2">Applied for</th>
              <th className="py-2">Offered</th>
              <th className="py-2">Score</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {offers.map((o) => {
              const meta = OFFER_STATUS[o.status] || OFFER_STATUS.offered;
              return (
                <tr key={o.id}>
                  <td className="py-2.5">
                    <div className="font-medium text-ink">{o.applicantName}</div>
                    <div className="text-xs text-muted">{o.applicationReference}</div>
                  </td>
                  <td className="py-2.5 text-muted">{o.fromDepartmentName || '—'}</td>
                  <td className="py-2.5 font-medium text-ink">{o.toDepartmentName}</td>
                  <td className="py-2.5 text-muted">{o.rankingScore ?? '—'}</td>
                  <td className="py-2.5"><Badge className={meta.cls}>{meta.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SwitchDepartmentModal({ application, departments, onClose, onDone }) {
  const toast = useToast();
  const [departmentId, setDepartmentId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDepartmentId(''); }, [application]);

  async function save() {
    if (!departmentId) return toast.error('Choose a department');
    setBusy(true);
    try {
      const { data } = await api.post(`/quotas/applications/${application.id}/switch-department`, { departmentId });
      toast.success(data.message);
      onDone();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!application}
      onClose={onClose}
      title="Move to another department"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Move applicant</Button></>}
    >
      {application && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Moving <strong className="text-ink">{application.applicantName}</strong> from{' '}
            <strong className="text-ink">{application.departmentName}</strong>.
          </p>
          <Select label="New department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department</option>
            {departments
              .filter((d) => d.isActive && d.id !== application.departmentId)
              .map((d) => <option key={d.id} value={d.id}>{d.facultyName ? `${d.facultyName} — ` : ''}{d.name}</option>)}
          </Select>
        </div>
      )}
    </Modal>
  );
}
