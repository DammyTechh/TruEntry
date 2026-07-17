import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, EmptyState, Badge } from '../../components/ui/Primitives';
import { PageLoader, Modal } from '../../components/ui/Misc';
import { Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function Forwarded() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null); // { row, admit }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/jamb/forwarded', { params: { limit: 50 } });
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openDecision(row, admit) {
    setDecision({ row, admit });
    setNote('');
  }

  async function confirm() {
    setBusy(true);
    try {
      await api.post(`/jamb/applicants/${decision.row.id}/decide`, {
        admit: decision.admit,
        note: note.trim() || undefined,
      });
      toast.success(decision.admit ? 'Applicant admitted' : 'Applicant not admitted');
      setRows((xs) => xs.filter((r) => r.id !== decision.row.id));
      setDecision(null);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Awaiting decision" subtitle="Applicants forwarded by institutions for final admission." />

      {loading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing awaiting decision" message="Forwarded applicants will appear here for admission." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{r.applicantName}</span>
                  {r.rank != null && <Badge className="bg-primary-light text-primary">Rank #{r.rank}</Badge>}
                </div>
                <div className="mt-0.5 text-sm text-muted">
                  {r.institutionName} · {r.departmentName}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  JAMB {r.jambScore ?? '—'}
                  {r.aggregateScore != null ? ` · Aggregate ${r.aggregateScore}` : ''}
                  {r.olevelCredits != null ? ` · ${r.olevelCredits} O-Level credits` : ''}
                  {r.state ? ` · ${r.state}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => openDecision(r, false)}>Not admit</Button>
                <Button size="sm" onClick={() => openDecision(r, true)}>Admit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.admit ? 'Admit applicant' : 'Do not admit applicant'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>Cancel</Button>
            <Button variant={decision?.admit ? 'primary' : 'danger'} onClick={confirm} loading={busy}>
              {decision?.admit ? 'Confirm admission' : 'Confirm decision'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          {decision?.admit
            ? `Admit ${decision?.row.applicantName} to ${decision?.row.departmentName}?`
            : `Mark ${decision?.row.applicantName} as not admitted?`}
        </p>
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the record" />
      </Modal>
    </div>
  );
}
