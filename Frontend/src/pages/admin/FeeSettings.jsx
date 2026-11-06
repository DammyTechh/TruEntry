import { useEffect, useState } from 'react';
import { Wallet, Info, Save, Receipt, Layers } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button } from '../../components/ui/Primitives';
import { Input } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { naira } from '../../lib/constants';
import TestModeCard from '../../components/admin/TestModeCard';

const LABELS = {
  university: 'University',
  polytechnic: 'Polytechnic',
  college_of_education: 'College of Education',
};

export default function FeeSettings() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [platform, setPlatform] = useState(null);
  const [platformDraft, setPlatformDraft] = useState({ examProcessingFeeNaira: '', secondSittingFeeNaira: '' });
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [savingType, setSavingType] = useState(null);

  async function load() {
    try {
      const [typeRes, platformRes] = await Promise.all([
        api.get('/admin/fee-settings'),
        api.get('/admin/platform-fees'),
      ]);

      setRows(typeRes.data.data || []);
      const d = {};
      (typeRes.data.data || []).forEach((r) => {
        d[r.institutionType] = {
          applicationFeeNaira: r.applicationFeeNaira,
          secondSittingFeeNaira: r.secondSittingFeeNaira,
        };
      });
      setDraft(d);

      const p = platformRes.data.data || null;
      setPlatform(p);
      if (p) {
        setPlatformDraft({
          examProcessingFeeNaira: p.examProcessingFeeNaira,
          secondSittingFeeNaira: p.secondSittingFeeNaira,
        });
      }
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
      await api.patch(`/admin/fee-settings/${type}`, {
        applicationFeeNaira: Number(draft[type].applicationFeeNaira),
        secondSittingFeeNaira: Number(draft[type].secondSittingFeeNaira),
      });
      toast.success(`${LABELS[type]} fees updated`);
      load();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingType(null);
    }
  }

  async function savePlatform() {
    setSavingPlatform(true);
    try {
      const { data } = await api.patch('/admin/platform-fees', {
        examProcessingFeeNaira: Number(platformDraft.examProcessingFeeNaira),
        secondSittingFeeNaira: Number(platformDraft.secondSittingFeeNaira),
      });
      setPlatform(data.data);
      toast.success('Applicant checkout fees updated');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingPlatform(false);
    }
  }

  if (loading) return <PageLoader />;

  const examFee = Number(platformDraft.examProcessingFeeNaira) || 0;
  const secondFee = Number(platformDraft.secondSittingFeeNaira) || 0;
  const platformDirty =
    platform &&
    (examFee !== platform.examProcessingFeeNaira || secondFee !== platform.secondSittingFeeNaira);

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle="Set what applicants are charged at checkout and what each institution type costs to apply to."
      />

      <TestModeCard />

      {/* ---------------- Applicant checkout (platform-wide) ---------------- */}
      <Card className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Applicant checkout</h3>
            <p className="text-sm text-muted">
              What every applicant pays to complete onboarding. These amounts appear on the
              applicant&apos;s payment summary as soon as you save them.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Input
            label="Exam processing fee (₦)"
            type="number" min="0"
            value={platformDraft.examProcessingFeeNaira ?? ''}
            onChange={(e) => setPlatformDraft((d) => ({ ...d, examProcessingFeeNaira: e.target.value }))}
            hint="Charged on every application, one sitting or two"
          />
          <Input
            label="Second-sitting fee (₦)"
            type="number" min="0"
            value={platformDraft.secondSittingFeeNaira ?? ''}
            onChange={(e) => setPlatformDraft((d) => ({ ...d, secondSittingFeeNaira: e.target.value }))}
            hint="Added when the applicant records two O'Level sittings"
          />
          <Button
            className="h-[44px] lg:w-44"
            onClick={savePlatform}
            loading={savingPlatform}
            disabled={!platformDirty}
          >
            <Save className="h-4 w-4" /> {platformDirty ? 'Save fees' : 'Saved'}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <PreviewTile label="One sitting — applicant pays" value={naira(examFee)} />
          <PreviewTile label="Two sittings — applicant pays" value={naira(examFee + secondFee)} highlight />
        </div>

        {platform?.updatedAt && (
          <p className="mt-3 text-xs text-muted">
            Last changed {new Date(platform.updatedAt).toLocaleString('en-NG')}
          </p>
        )}
      </Card>

      {/* ---------------- Application fee per institution type -------------- */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">Institution application fees</h3>
          <p className="text-sm text-muted">Charged when an applicant applies to an institution of that type.</p>
        </div>
      </div>

      <div className="mb-6 flex gap-3 rounded-xl border border-border bg-white p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted">
          Applicants pay the base fee for the institution type they apply to. Choosing{' '}
          <strong className="text-ink">two O&apos;Level sittings</strong> adds the second-sitting charge,
          which covers the extra result verification.
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
                <span className="font-semibold text-ink">{naira(total)}</span>
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

function PreviewTile({ label, value, highlight = false }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
        highlight ? 'bg-primary-light' : 'bg-primary-surface'
      }`}
    >
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-primary' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
