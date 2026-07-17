import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, EmptyState } from '../../components/ui/Primitives';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const TABS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'approved', label: 'Ready to forward' },
];

export default function Approvals() {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState('recommended');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/applications/institution', { params: { status: tab, limit: 50 } });
      setRows(data.data || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [tab]);

  async function act(id, path, msg) {
    setBusyId(id);
    try {
      await api.post(`/applications/institution/${id}/${path}`, {});
      toast.success(msg);
      setRows((xs) => xs.filter((r) => r.id !== id));
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Approve recommended candidates and forward them to JAMB." />

      <div className="mb-5 inline-flex rounded-xl border border-border bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? 'bg-primary text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState
          title={tab === 'recommended' ? 'Nothing to approve' : 'Nothing to forward'}
          message={tab === 'recommended' ? 'Recommended candidates will appear here.' : 'Approved candidates ready for JAMB will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="cursor-pointer" onClick={() => nav(`/institution/applications/${r.id}`)}>
                <div className="font-semibold text-ink">{r.applicantName}</div>
                <div className="text-sm text-muted">
                  {r.departmentName} · JAMB {r.jambScore ?? '—'}
                  {r.aggregateScore != null ? ` · Aggregate ${r.aggregateScore}` : ''}
                  {r.rank != null ? ` · Rank #${r.rank}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {tab === 'recommended' ? (
                  <>
                    <Button size="sm" variant="danger" loading={busyId === r.id} onClick={() => act(r.id, 'reject', 'Rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" loading={busyId === r.id} onClick={() => act(r.id, 'approve', 'Approved')}>
                      Approve
                    </Button>
                  </>
                ) : (
                  <Button size="sm" loading={busyId === r.id} onClick={() => act(r.id, 'forward-jamb', 'Forwarded to JAMB')}>
                    Forward to JAMB
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
