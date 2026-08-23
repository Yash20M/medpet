import { useState, useMemo, useEffect } from 'react';

export interface Pagination<T> {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  total: number;
  pageItems: T[];
  pageSize: number;
}

/** Client-side pagination over an in-memory array. */
export function usePagination<T>(items: T[], pageSize = 10): Pagination<T> {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Snap back into range when the underlying list shrinks (filtering, deletes).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return { page, setPage, totalPages, total, pageItems, pageSize };
}
