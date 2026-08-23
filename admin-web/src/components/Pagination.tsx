interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

// Build a compact page window: 1 … 4 5 [6] 7 8 … 20
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push('…');
  out.push(totalPages);
  return out;
}

export default function Pagination({ page, totalPages, total, pageSize, onChange }: Props) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <span className="pagination-info">Showing {from}–{to} of {total}</span>
      <div className="pagination-controls">
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…'
            ? <span key={`gap-${i}`} className="page-gap">…</span>
            : <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        )}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
      </div>
    </div>
  );
}
