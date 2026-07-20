import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, GraduationCap, Building2 } from 'lucide-react';
import { usePaged } from '../../lib/hooks';
import { Pagination, PageLoader } from '../../components/ui/Misc';
import { EmptyState, Badge } from '../../components/ui/Primitives';
import { Select } from '../../components/ui/Field';
import { NIGERIAN_STATES } from '../../lib/constants';

export default function Institutions() {
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [q, setQ] = useState({});
  const { items, page, setPage, totalPages, total, loading } = usePaged('/institutions', q);

  function applyFilters(e) {
    e?.preventDefault();
    const next = {};
    if (search.trim()) next.search = search.trim();
    if (state) next.state = state;
    setPage(1);
    setQ(next);
  }

  return (
    <div>
      {/* header band */}
      <div className="relative overflow-hidden bg-brand-soft">
        <div className="absolute inset-0 bg-mesh opacity-60" />
        <div className="container-tru relative py-14">
          <span className="chip bg-white text-primary shadow-xs"><Building2 className="h-3.5 w-3.5" /> Accredited institutions</span>
          <h1 className="mt-4 font-display text-3xl font-bold text-primary-dark sm:text-4xl">Find your institution</h1>
          <p className="mt-2 max-w-xl text-muted">Browse accredited institutions and their departments, cutoffs and quotas.</p>
          <form onSubmit={applyFilters} className="mt-7 grid gap-3 sm:grid-cols-[1fr,220px,auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input className="input pl-11" placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">All states</option>
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(11,77,224,0.5)] transition hover:bg-primary-hover">
              <Search className="h-4 w-4" /> Search
            </button>
          </form>
        </div>
      </div>

      <div className="container-tru py-10">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <EmptyState title="No institutions found" message="Try a different search or clear the filters." />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{total} institution{total === 1 ? '' : 's'}</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <Link key={i.id} to={`/institutions/${i.id}`} className="card card-hover group p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient font-display text-base font-bold text-white shadow-float">
                      {i.code?.slice(0, 2) || 'IN'}
                    </div>
                    {i.hasPostUtme && <Badge className="bg-primary-light text-primary">Post-UTME</Badge>}
                  </div>
                  <h3 className="mt-4 font-semibold text-ink group-hover:text-primary">{i.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <MapPin className="h-3.5 w-3.5" /> {i.code}{i.state ? ` · ${i.state}` : ''}
                  </p>
                  {i.categoryName && <p className="mt-2 text-xs text-muted">{i.categoryName}</p>}
                  {i.departmentCount != null && (
                    <p className="mt-4 inline-flex items-center gap-1.5 border-t border-border pt-3 text-xs font-medium text-primary">
                      <GraduationCap className="h-4 w-4" /> {i.departmentCount} departments
                    </p>
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
