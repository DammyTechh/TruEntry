import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, StatCard, EmptyState } from '../../components/ui/Primitives';
import { Select } from '../../components/ui/Field';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import api, { errMessage } from '../../lib/api';

export default function Decisioning() {
  const { user } = useAuth();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!user?.institutionId) return;
    api
      .get(`/institutions/${user.institutionId}/departments`)
      .then((r) => setDepartments(r.data.data || []))
      .catch(() => setDepartments([]));
  }, [user]);

  async function runPreview(id) {
    if (!id) return setPreview(null);
    setLoading(true);
    try {
      const { data } = await api.post('/decisioning/preview', { departmentId: id });
      setPreview(data.data);
    } catch (err) {
      toast.error(errMessage(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setRunning(true);
    try {
      const { data } = await api.post('/decisioning/run', { departmentId });
      toast.success(`Committed · ${data.data.selectedCount} recommended, ${data.data.ineligibleCount} not qualified`);
      setConfirm(false);
      await runPreview(departmentId);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader title="Decisioning" subtitle="Rank candidates against quota, then commit the run." />

      <Card className="max-w-md">
        <Select
          label="Department"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            runPreview(e.target.value);
          }}
        >
          <option value="">Select a department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <PageLoader label="Ranking candidates…" />
      ) : preview ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Quota" value={preview.quota || '—'} />
            <StatCard label="Selected" value={preview.selectedCount} accent="text-success" />
            <StatCard label="Waitlisted" value={preview.waitlistedCount} accent="text-warning" />
            <StatCard label="Ineligible" value={preview.ineligibleCount} accent="text-danger" />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setConfirm(true)} disabled={!preview.selectedCount}>
              Commit decision run
            </Button>
          </div>

          <CandidateTable title="Selected" tone="success" rows={preview.selected} />
          <CandidateTable title="Waitlisted" tone="warning" rows={preview.waitlisted} />
          <CandidateTable title="Ineligible" tone="danger" rows={preview.ineligible} showReasons />
        </div>
      ) : departmentId ? null : (
        <div className="mt-6">
          <EmptyState title="Pick a department" message="Choose a department above to preview ranked candidates." />
        </div>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Commit this decision run?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button onClick={commit} loading={running}>Commit run</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This will recommend the {preview?.selectedCount} selected candidates for registrar approval and mark
          ineligible candidates as not qualified. This action is recorded in the audit log.
        </p>
      </Modal>
    </div>
  );
}

const TONE = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function CandidateTable({ title, tone, rows, showReasons }) {
  if (!rows || rows.length === 0) return null;
  return (
    <Card>
      <h3 className={`font-semibold ${TONE[tone]}`}>
        {title} <span className="text-muted">· {rows.length}</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 pr-4">Rank</th>
              <th className="py-2 pr-4">Applicant</th>
              <th className="py-2 pr-4">JAMB</th>
              <th className="py-2 pr-4">Post-UTME</th>
              <th className="py-2 pr-4">Aggregate</th>
              <th className="py-2 pr-4">Score</th>
              {showReasons && <th className="py-2">Reason</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.applicationId}>
                <td className="py-2 pr-4 font-medium text-ink">{r.rank ?? '—'}</td>
                <td className="py-2 pr-4">{r.applicantName}</td>
                <td className="py-2 pr-4">{r.jambScore ?? '—'}</td>
                <td className="py-2 pr-4">{r.postUtmeScore ?? '—'}</td>
                <td className="py-2 pr-4">{r.aggregateScore ?? '—'}</td>
                <td className="py-2 pr-4 font-medium">{r.rankingScore ?? '—'}</td>
                {showReasons && <td className="py-2 text-xs text-danger">{(r.reasons || []).join(', ')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
