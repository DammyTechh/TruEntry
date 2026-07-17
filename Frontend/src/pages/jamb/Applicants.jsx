import { useState } from 'react';
import { usePaged } from '../../lib/hooks';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Misc';
import { Input, Select } from '../../components/ui/Field';
import { NIGERIAN_STATES } from '../../lib/constants';

export default function Applicants() {
  const [draft, setDraft] = useState({ search: '', state: '', minJamb: '' });
  const [filters, setFilters] = useState({});
  const { items, page, setPage, totalPages, loading } = usePaged('/jamb/applicants', filters);

  function apply(e) {
    e?.preventDefault();
    const f = {};
    if (draft.search.trim()) f.search = draft.search.trim();
    if (draft.state) f.state = draft.state;
    if (draft.minJamb) f.minJamb = Number(draft.minJamb);
    setPage(1);
    setFilters(f);
  }

  const columns = [
    { key: 'applicantName', header: 'Applicant', render: (r) => <span className="font-medium text-ink">{r.applicantName}</span> },
    { key: 'institutionName', header: 'Institution' },
    { key: 'departmentName', header: 'Department' },
    { key: 'state', header: 'State', render: (r) => r.state ?? '—' },
    { key: 'jambScore', header: 'JAMB', render: (r) => r.jambScore ?? '—' },
    { key: 'aggregateScore', header: 'Aggregate', render: (r) => r.aggregateScore ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Applicants" subtitle="Every applicant across all institutions." />
      <form onSubmit={apply} className="mb-5 grid gap-3 sm:grid-cols-[1fr,180px,140px,auto]">
        <Input placeholder="Search name or reference" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        <Select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })}>
          <option value="">All states</option>
          {NIGERIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
        <Input type="number" placeholder="Min JAMB" value={draft.minJamb} onChange={(e) => setDraft({ ...draft, minJamb: e.target.value })} />
        <button className="rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover">Filter</button>
      </form>
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        empty={{ title: 'No applicants', message: 'Try adjusting your filters.' }}
      />
    </div>
  );
}
