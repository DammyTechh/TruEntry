import { useEffect, useState } from 'react';
import {
  FileSpreadsheet, FileText, Filter, ShieldCheck, AlertTriangle, CheckCircle2, Download,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge, StatCard } from '../../components/ui/Primitives';
import { Select, Input } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const STATUSES = [
  'submitted', 'under_review', 'recommended', 'approved',
  'forwarded_jamb', 'admitted', 'not_admitted', 'rejected',
];

export default function JambAudit() {
  const toast = useToast();
  const [institutions, setInstitutions] = useState([]);
  const [filters, setFilters] = useState({ institutionId: '', status: '', from: '', to: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    api.get('/institutions', { params: { limit: 100 } })
      .then((r) => setInstitutions(r.data.data || []))
      .catch(() => {});
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function params() {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }

  async function run() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/reports/jamb-audit', { params: params() });
      setReport(data.data);
    } catch (err) {
      setReport(null);
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** Streams the binary export and triggers a browser download. */
  async function download(format) {
    setExporting(format);
    try {
      const res = await api.get('/admin/reports/jamb-audit/export', {
        params: { ...params(), format },
        responseType: 'blob',
      });

      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `jamb-audit.${format}`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format === 'xlsx' ? 'Excel' : 'PDF'} report downloaded`);
    } catch (err) {
      // A blob error body has to be read back as text before it can be parsed.
      let message = 'Export failed';
      try {
        const text = await err?.response?.data?.text?.();
        if (text) message = JSON.parse(text).message || message;
      } catch { message = errMessage(err); }
      toast.error(message);
    } finally {
      setExporting(null);
    }
  }

  const s = report?.summary;

  return (
    <div>
      <PageHeader
        title="JAMB audit report"
        subtitle="Regulatory audit of admission exercises, exportable for JAMB."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => download('xlsx')} loading={exporting === 'xlsx'} disabled={!report}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button onClick={() => download('pdf')} loading={exporting === 'pdf'} disabled={!report}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <Filter className="h-4 w-4 text-primary" /> Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Institution"
            value={filters.institutionId}
            onChange={(e) => setFilters({ ...filters, institutionId: e.target.value })}
          >
            <option value="">All institutions</option>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
          </Select>
          <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          <div className="flex items-end">
            <Button className="w-full" onClick={run}>Run report</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <PageLoader label="Building report…" />
      ) : !report ? (
        <Card className="p-10 text-center">
          <p className="text-muted">No records match these filters.</p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Applications" value={s.totalApplications.toLocaleString()} icon={FileText} />
            <StatCard label="Fully verified" value={s.verified.toLocaleString()} icon={ShieldCheck} tone="success" accent="text-success" hint="NIN, JAMB & O'Level" />
            <StatCard label="Admitted" value={s.admitted.toLocaleString()} icon={CheckCircle2} tone="success" accent="text-success" />
            <StatCard label="JAMB cut-off" value={s.jambCutoff ?? '—'} icon={Filter} />
          </div>

          {/* Regulatory compliance */}
          <Card className="mb-6 p-6">
            <h2 className="font-display text-base font-bold text-primary">Regulatory allocation compliance</h2>
            <p className="mt-0.5 text-sm text-muted">
              How the admissions made compare with the mandated National Merit / Catchment / ELDS split.
            </p>
            <div className="mt-5 space-y-4">
              {s.compliance.map((c) => {
                const deviating = Math.abs(c.variancePct) > 5;
                return (
                  <div key={c.category}>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-ink">{c.category}</span>
                      <span className="flex items-center gap-2 text-muted">
                        <span>{c.admitted} admitted</span>
                        <Badge className={deviating ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'}>
                          {deviating && <AlertTriangle className="h-3.5 w-3.5" />}
                          {c.actualPct}% of {c.mandatedPct}%
                        </Badge>
                      </span>
                    </div>
                    {/* actual against the mandated marker */}
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-primary-100">
                      <div
                        className={`h-full rounded-full ${deviating ? 'bg-danger' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, c.actualPct)}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-ink/50"
                        style={{ left: `${Math.min(100, c.mandatedPct)}%` }}
                        title={`Mandated ${c.mandatedPct}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted">
              The dark marker shows the mandated share. A variance beyond 5 percentage points is highlighted.
            </p>
          </Card>

          {/* Records */}
          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="font-display text-base font-bold text-primary">Applicant records</h2>
              <span className="text-sm text-muted">
                {report.truncated
                  ? `Showing first 100 — export for all ${s.totalApplications.toLocaleString()}`
                  : `${report.applicants.length} record(s)`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">JAMB reg</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Institution / Dept</th>
                    <th className="px-4 py-3">JAMB</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.applicants.map((r) => (
                    <tr key={r.reference} className="hover:bg-primary-surface">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{r.reference}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{r.full_name}</div>
                        <div className="text-xs text-muted">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{r.jamb_reg_no || '—'}</td>
                      <td className="px-4 py-3 text-muted">{r.state_of_origin || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-ink">{r.institution_name}</div>
                        <div className="text-xs text-muted">{r.department_name}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{r.jamb_score ?? '—'}</td>
                      <td className="px-4 py-3 text-muted">{LABELS[r.admission_category] || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={r.status === 'admitted' ? 'bg-green-50 text-success' : 'bg-primary-light text-primary'}>
                          {String(r.status).replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4">
            <Download className="h-5 w-5 text-primary" />
            <p className="flex-1 text-sm text-muted">
              Export the full record set for JAMB: <strong className="text-ink">Excel</strong> for analysis
              (summary + all applicants with filters), <strong className="text-ink">PDF</strong> for filing.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => download('xlsx')} loading={exporting === 'xlsx'}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button size="sm" onClick={() => download('pdf')} loading={exporting === 'pdf'}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const LABELS = {
  national_merit: 'National Merit',
  catchment: 'Catchment',
  elds: 'ELDS',
};
