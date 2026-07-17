import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, EmptyState } from '../../components/ui/Primitives';
import { Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

const TYPES = [
  { value: 'audit_ready', label: 'Audit-ready report' },
  { value: 'admitted_list', label: 'Admitted list' },
  { value: 'applicants_list', label: 'Applicants list' },
];

export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('audit_ready');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function loadReports() {
    const { data } = await api.get('/reports');
    setReports(data.data || []);
  }

  useEffect(() => {
    (async () => {
      try {
        const tasks = [loadReports()];
        if (user?.institutionId) {
          tasks.push(
            api.get(`/institutions/${user.institutionId}/departments`).then((r) => setDepartments(r.data.data || []))
          );
        }
        await Promise.all(tasks);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.post(
        '/reports/generate',
        { type, departmentId: departmentId || undefined },
        { responseType: 'blob' }
      );
      const blob = res.data;
      if (blob.type.includes('application/json')) {
        const parsed = JSON.parse(await blob.text());
        const url = parsed?.data?.pdfUrl;
        toast.success('Report generated');
        if (url) window.open(url, '_blank');
      } else {
        // Streamed PDF.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      }
      await loadReports();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and download audit-ready admission reports." />

      <Card className="mb-6 max-w-3xl">
        <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
          <Select label="Report type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Select label="Department (optional)" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Button onClick={generate} loading={generating}>Generate</Button>
        </div>
      </Card>

      <h3 className="mb-3 font-semibold text-ink">Generated reports</h3>
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" message="Generate your first report above." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-primary-surface">
                  <td className="px-4 py-3 font-medium text-ink">{r.title}</td>
                  <td className="px-4 py-3 capitalize text-muted">{r.type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-muted">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {r.pdfUrl ? (
                      <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="link">Download</a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
