/* ================================================================== */
/* LEGO BLOCK — free-text search shared by every list/table screen.    */
/* Keyword-based, not pinned to one field: the query is split into      */
/* tokens and every token must appear somewhere across the given       */
/* fields, so "מגלן קשר" or "NVG לילה" both match regardless of which  */
/* field holds which word or what order the user typed them in.        */
/* ================================================================== */

export function matchesSearch(fields, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}
