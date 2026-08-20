import React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

/* ================================================================== */
/* LEGO BLOCK — Pagination. Presentational only: the consuming screen   */
/* owns `page`/`pageSize` state and slices its own array — this just    */
/* renders the summary line + page-size select + page-number controls, */
/* the same shape used by real e-commerce/warehouse catalogs.           */
/* ================================================================== */

export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

function pageWindow(page, pageCount) {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  return [...keep].sort((a, b) => a - b);
}

export default function Pagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);
  const nums = pageWindow(page, pageCount);

  return (
    <div className="pagination-bar">
      <span className="pagination-summary" dir="ltr">{totalItems === 0 ? "0 תוצאות" : `מציג ${from}–${to} מתוך ${totalItems}`}</span>
      <div className="pagination-controls">
        {onPageSizeChange && (
          <select
            className="pagination-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="פריטים בעמוד"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} בעמוד</option>)}
          </select>
        )}
        <div className="pagination-pages">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="הקודם">
            <ChevronRight size={14} />
          </button>
          {nums.map((n, i) => (
            <React.Fragment key={n}>
              {i > 0 && nums[i - 1] !== n - 1 && <span className="pagination-ellipsis">···</span>}
              <button className={"pagination-page" + (n === page ? " active" : "")} onClick={() => onPageChange(n)}>
                {n}
              </button>
            </React.Fragment>
          ))}
          <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} title="הבא">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
