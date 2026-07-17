import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaged, useFetch } from '../../lib/hooks';
import { Pagination, PageLoader } from '../../components/ui/Misc';
import { EmptyState, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { NIGERIAN_STATES } from '../../lib/constants';

export default function Institutions() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [q, setQ] = useState({});
  const { items, page, setPage, totalPages, total, loading } = usePaged('/institutions', q);
  const { data: categories } = useFetch('/institutions/categories');

  function applyFilters(e) {
    e?.preventDefault();
    const next = {};
    if (search.trim()) next.search = search.trim();
    if (state) next.state = state;
    setPage(1);
    setQ(next);
  }

  return (
    <div className="container-tru py-12">
      <h1 className="text-3xl font-bold text-primary-dark">Institutions</h1>
      <p className="mt-1 text-muted">Browse accredited institutions and their departments.</p>

      <form onSubmit={applyFilters} className="mt-6 grid gap-3 sm:grid-cols-[1fr,220px,auto]">
        <Input placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All states</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <button className="rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover">
          Search
        </button>
      </form>

      <div className="mt-6">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState title="No institutions found" message="Try a different search or clear the filters." />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{total} institutions</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <Link key={i.id} to={`/institutions/${i.id}`} className="card p-5 transition hover:shadow-pop">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light font-bold text-primary">
                      {i.code?.slice(0, 2) || 'IN'}
                    </div>
                    {i.hasPostUtme && <Badge className="bg-primary-light text-primary">Post-UTME</Badge>}
                  </div>
                  <h3 className="mt-3 font-semibold text-ink">{i.name}</h3>
                  <p className="text-sm text-muted">
                    {i.code}
                    {i.state ? ` · ${i.state}` : ''}
                  </p>
                  {i.categoryName && <p className="mt-2 text-xs text-muted">{i.categoryName}</p>}
                  {i.departmentCount != null && (
                    <p className="mt-3 text-xs font-medium text-primary">{i.departmentCount} departments</p>
                  )}
                </Link>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
