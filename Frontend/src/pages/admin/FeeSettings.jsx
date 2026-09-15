import { useEffect, useState } from 'react';
import { Wallet, Info, Save } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const LABELS = {
  university: 'University',
  polytechnic: 'Polytechnic',
  college_of_education: 'College of Education',
};

export default function FeeSettings() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [savingType, setSavingType] = useState(null);

  async function load() {
    try {
      const { data } = await api.get('/admin/fee-settings');
      setRows(data.data || []);
      const d = {};
      (data.data || []).forEach((r) => {
        d[r.institutionType] = {
          applicationFeeNaira: r.applicationFeeNaira,
          secondSittingFeeNaira: r.secondSittingFeeNaira,
        };
      });
      setDraft(d);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function edit(type, key, value) {
    setDraft((d) => ({ ...d, [type]: { ...d[type], [key]: value } }));
  }

  async function save(type) {
    setSavingType(type);
    try {
      const body = {
        applicationFeeNaira: Number(draft[type].applicationFeeNaira),
        secondSittingFeeNaira: Number(draft[type].secondSittingFeeNaira),
      };
      await api.patch(`/admin/fee-settings/${type}`, body);
      toast.success(`${LABELS[type]} fees updated`);
      load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingType(null);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Application fees" subtitle="Set the application fee charged per institution type." />

      <div className="mb-6 flex gap-3 rounded-xl border border-border bg-white p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted">
          Applicants pay the base fee for the institution type they apply to. Choosing <strong className="text-ink">two O'Level sittings</strong> adds
          the second-sitting charge, which covers the extra result verification.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {rows.map((r) => {
          const d = draft[r.institutionType] || {};
          const total = (Number(d.applicationFeeNaira) || 0) + (Number(d.secondSittingFeeNaira) || 0);
          const dirty =
            Number(d.applicationFeeNaira) !== r.applicationFeeNaira ||
            Number(d.secondSittingFeeNaira) !== r.secondSittingFeeNaira;

          return (
            <Card key={r.institutionType} className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-ink">{LABELS[r.institutionType]}</h3>
              </div>

              <div className="mt-5 space-y-3">
                <Input
                  label="Application fee (₦)"
                  type="number" min="0"
                  value={d.applicationFeeNaira ?? ''}
                  onChange={(e) => edit(r.institutionType, 'applicationFeeNaira', e.target.value)}
                />
                <Input
                  label="Second-sitting surcharge (₦)"
                  type="number" min="0"
                  value={d.secondSittingFeeNaira ?? ''}
                  onChange={(e) => edit(r.institutionType, 'secondSittingFeeNaira', e.target.value)}
                  hint="Added when an applicant submits two O'Level sittings"
                />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary-surface px-3.5 py-3 text-sm">
                <span className="text-muted">Two-sitting total</span>
                <span className="font-semibold text-ink">₦{total.toLocaleString()}</span>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() => save(r.institutionType)}
                loading={savingType === r.institutionType}
                disabled={!dirty}
              >
                <Save className="h-4 w-4" /> {dirty ? 'Save changes' : 'Saved'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
