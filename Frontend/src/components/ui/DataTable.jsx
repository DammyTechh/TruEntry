import { PageLoader, Pagination } from './Misc';
import { EmptyState } from './Primitives';

export function DataTable({ columns, rows, loading, empty, page, totalPages, onPage, onRowClick }) {
  if (loading) return <PageLoader />;
  if (!rows || rows.length === 0)
    return <EmptyState title={empty?.title || 'Nothing here yet'} message={empty?.message} action={empty?.action} />;

  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-primary-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 ${c.className || ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? 'cursor-pointer' : ''} hover:bg-primary-surface`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.cellClassName || ''}`}>
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onPage && <Pagination page={page} totalPages={totalPages} onPage={onPage} />}
    </div>
  );
}
