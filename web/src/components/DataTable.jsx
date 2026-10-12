/**
 * DataTable — shared table machinery for table.grid / data-table pages.
 *
 * useGridTable wraps @tanstack/react-table and hands back everything a
 * page needs: the instance, the current page's rows, sort helpers that
 * match the .sorting_asc/.sorting_desc header classes, range math, and a
 * pager object for <DsPager> / <DatasetFoot>. Pages keep their own markup
 * (columns, cells, board groups) — this only owns the state wiring that
 * used to be re-rolled per page.
 *
 *   const grid = useGridTable({ data, columns, pageSize: 15,
 *                               initialSorting: [{ id: 'created', desc: true }],
 *                               globalFilter: query, globalFilterFn,
 *                               resetKey: JSON.stringify(filters) });
 *   <th className={grid.sortClass('name')} onClick={grid.sortHandler('name')}>
 *     Name{grid.renderSortArrow('name')}
 *   </th>
 *   {grid.pageRows.map((row) => <tr key={row.id}>…</tr>)}
 *   <DatasetFoot grid={grid} />
 *
 * Pagination notes:
 * - The page resets to 1 when `globalFilter` or `resetKey` changes — pass a
 *   serialized filter object for resetKey to cover filters the hook can't
 *   see. Data changes alone do not reset; a shrunken list clamps to the
 *   last valid page (the old Math.min(page, pageCount - 1) behaviour).
 * - Rows are sliced from the pre-pagination row model with the clamped
 *   page, so an out-of-range pageIndex can never render an empty table.
 * - `paginate: false` returns every filtered + sorted row (grouped boards).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

export function useGridTable({
  data = [],
  columns,
  pageSize = 15,
  initialSorting = [],
  globalFilter = '',
  globalFilterFn,
  resetKey = null,
  paginate = true,
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  // Reset to the first page when the visible set changes via filters the
  // hook owns (globalFilter) or ones the page owns (resetKey) — replaces the
  // manual setPage(0) calls that used to be sprinkled through handlers.
  useEffect(() => {
    setPagination((p) => (p.pageIndex ? { ...p, pageIndex: 0 } : p));
  }, [globalFilter, resetKey]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    globalFilterFn,
    enableSortingRemoval: false, // asc ⇄ desc cycle, never unsorted
    sortDescFirst: false,        // first click on any column sorts ascending
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // getPrePaginationRowModel = filtered + sorted, unsliced. Slicing by hand
  // keeps the old clamp semantics: a page index past the end falls back to
  // the last page instead of rendering an empty tbody.
  const rowModel = table.getPrePaginationRowModel().rows;
  const filteredCount = rowModel.length;
  const pageCount = paginate ? Math.max(1, Math.ceil(filteredCount / pageSize)) : 1;
  const safePage = Math.min(pagination.pageIndex, pageCount - 1);
  // rowModel is referentially stable (TanStack caches it), so pageRows is
  // safe to depend on in downstream useMemos like board grouping.
  const pageRows = useMemo(
    () => (paginate
      ? rowModel.slice(safePage * pageSize, safePage * pageSize + pageSize)
      : rowModel
    ).map((row) => row.original),
    [rowModel, paginate, safePage, pageSize]
  );
  const start = filteredCount ? safePage * pageSize + 1 : 0;
  const end = Math.min((safePage + 1) * pageSize, filteredCount);

  const sortClass = (col) => {
    const dir = table.getColumn(col)?.getIsSorted();
    return dir === 'asc' ? 'sorting_asc' : dir === 'desc' ? 'sorting_desc' : 'sorting';
  };
  const sortHandler = (col) => table.getColumn(col)?.getToggleSortingHandler();
  const renderSortArrow = (col) => {
    const dir = table.getColumn(col)?.getIsSorted();
    if (!dir) return null;
    return <span className="ds-sort">{dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>;
  };

  // Absolute targets derived from the clamped page — relative prev/next on
  // the raw state could land on an out-of-range index after data shrinks.
  const pager = {
    first: () => setPagination((p) => ({ ...p, pageIndex: 0 })),
    prev: () => setPagination((p) => ({ ...p, pageIndex: Math.max(0, safePage - 1) })),
    next: () => setPagination((p) => ({ ...p, pageIndex: Math.min(pageCount - 1, safePage + 1) })),
    last: () => setPagination((p) => ({ ...p, pageIndex: pageCount - 1 })),
    canPrev: safePage > 0,
    canNext: safePage < pageCount - 1,
  };

  return {
    table, pageRows, filteredCount, pageCount, safePage, pageSize,
    start, end, sortClass, sortHandler, renderSortArrow, pager,
  };
}

/** The 4-button pager — first / prev / current-of-total / next / last. */
export function DsPager({ grid }) {
  const { pageCount, safePage, pager } = grid;
  return (
    <div className="ds-pager">
      <button type="button" className="ds-page" onClick={pager.first} disabled={!pager.canPrev} aria-label="First page">
        <ChevronFirst size={15} />
      </button>
      <button type="button" className="ds-page" onClick={pager.prev} disabled={!pager.canPrev} aria-label="Previous page">
        <ChevronLeft size={15} />
      </button>
      <span className="ds-page" aria-current="page">{safePage + 1}</span>
      <span className="ds-gap">/</span>
      <span className="ds-page">{pageCount}</span>
      <button type="button" className="ds-page" onClick={pager.next} disabled={!pager.canNext} aria-label="Next page">
        <ChevronRight size={15} />
      </button>
      <button type="button" className="ds-page" onClick={pager.last} disabled={!pager.canNext} aria-label="Last page">
        <ChevronLast size={15} />
      </button>
    </div>
  );
}

/** Standard dataset footer: "start–end of total" range plus the pager. */
export function DatasetFoot({ grid }) {
  return (
    <div className="dataset-foot">
      <div className="ds-range">
        <b>{grid.start}</b>–<b>{grid.end}</b> of <b>{grid.filteredCount}</b>
      </div>
      <DsPager grid={grid} />
    </div>
  );
}

export default useGridTable;
