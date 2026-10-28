import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Repeat2 } from 'lucide-react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button, Card, EmptyState } from '../../components/ui/Primitives';
import { StatusBadge, PaymentBadge, PageLoader, Pagination } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

export default function Applications() {
  const { items, page, setPage, totalPages, loading, refetch } = usePaged('/applications/mine');
  const [offers, setOffers] = useState([]);

  const loadOffers = useCallback(async () => {
    try {
      const { data } = await api.get('/applications/mine/change-offers');
      setOffers((data.data || []).filter((o) => o.status === 'offered'));
    } catch {
      setOffers([]); // never let an offer lookup block the applications list
    }
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  function onAnswered() {
    loadOffers();
    refetch?.();
  }

  return (
    <div>
      <PageHeader title="My applications" action={<Button to="/app/apply">New application</Button>} />

      {offers.map((offer) => (
        <ChangeOfferCard key={offer.id} offer={offer} onAnswered={onAnswered} />
      ))}

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState title="No applications yet" message="Apply to an institution to see it here." action={<Button to="/app/apply">Start an application</Button>} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a) => (
                  <tr key={a.id} className="hover:bg-primary-surface">
                    <td className="px-4 py-3 font-medium text-ink">{a.institutionName}</td>
                    <td className="px-4 py-3 text-muted">{a.departmentName}</td>
                    <td className="px-4 py-3 text-muted">{a.reference}</td>
                    <td className="px-4 py-3"><PaymentBadge status={a.paymentStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/app/applications/${a.id}`} className="link">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/**
 * Raised when the institution finished admitting into the course the applicant
 * applied for, had seats left in another course, and the applicant meets its
 * requirements. Nothing moves unless they accept.
 */
function ChangeOfferCard({ offer, onAnswered }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null); // 'accept' | 'decline'

  async function respond(action) {
    setBusy(action);
    try {
      const { data } = await api.post(`/applications/mine/change-offers/${offer.id}/${action}`);
      toast.success(data?.message || (action === 'accept' ? 'Course changed' : 'Offer declined'));
      onAnswered();
    } catch (err) {
      toast.error(errMessage(err));
      setBusy(null);
    }
  }

  return (
    <Card className="mb-5 border-warning/40 bg-amber-50/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-warning">
          <Repeat2 className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">A change of course is available</h3>
          <p className="mt-1 text-sm text-muted">
            {offer.institutionName} could not offer you a place in{' '}
            <strong className="text-ink">{offer.fromDepartmentName || 'the course you applied for'}</strong>, but
            a seat is open in <strong className="text-ink">{offer.toDepartmentName}</strong> and you meet its
            requirements.
          </p>
          {offer.reason && <p className="mt-2 text-sm text-muted">{offer.reason}</p>}
          <p className="mt-2 text-xs text-muted">
            Declining changes nothing — your original application stays as it is.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => respond('accept')} loading={busy === 'accept'} disabled={!!busy}>
              Change to {offer.toDepartmentName} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => respond('decline')}
              loading={busy === 'decline'}
              disabled={!!busy}
            >
              Keep my original choice
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
