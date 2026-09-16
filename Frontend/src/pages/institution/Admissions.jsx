import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Lock, Users, Search,
  AlertTriangle, ShieldCheck, Shuffle,
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

  const params = {};
  if (filters.departmentId) params.departmentId = filters.departmentId;
  if (filters.status) params.status = filters.status;
  if (search.trim()) params.search = search.trim();

  const { items, page, setPage, totalPages, total, loading: listLoading, refetch } =
    usePaged(`/quotas/${id}/admissions/applicants`, params);

  async function loadSummary() {
    try {
      const [s, d] = await Promise.all([
        api.get(`/quotas/${id}/admissions/summary`),
        api.get('/workspace/departments'),
      ]);
      setSummary(s.data.data);
      setDepartments(d.data.data || []);
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
