/**
 * IMDb's exports (ratings.csv, watchlist.csv, list exports) are all RFC 4180 CSV
 * whose identifying column is `Const` — the tconst ("tt0111161"). Everything else
 * on a row (titles, dates, URLs) is ignored: the watched list is ids only.
 *
 * Parsing reads the whole file as text. Chunks are joined before this runs, and
 * a lifetime of ratings is ~2 MB, so no streaming machinery is warranted.
 */

const ID = /^tt\d+$/;
/** Header cells IMDb uses for the id column, compared lowercased. */
const CONST_HEADER = 'const';

/**
 * One CSV row. Quoted fields may hold commas, doubled double-quotes and
 * newlines; unquoted fields end at a comma or newline. `\r\n`, `\r` and `\n`
 * all end a record, and the trailing newline does not make an empty last row.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    // a row of one empty field is a blank line, not data
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endField();
      endRow();
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    endField();
    endRow();
  }
  return rows;
}

/**
 * The tconsts named in the `Const` column, deduplicated, file order kept.
 *
 * If no `Const` header exists, any cell that is exactly a tconst is taken —
 * URL cells ("/title/tt0111166/") do not match exactly, so they contribute
 * nothing. An empty result means the file is not an IMDb export, and the
 * caller says so rather than pushing an empty batch.
 */
export function extractImdbIds(csv: string): string[] {
  const rows = parseCsvRows(csv);
  const header = rows[0] ?? [];
  const col = header.findIndex((h) => h.trim().toLowerCase() === CONST_HEADER);

  const ids: string[] = [];
  const seen = new Set<string>();
  const take = (value: string) => {
    const v = value.trim();
    if (ID.test(v) && !seen.has(v)) {
      seen.add(v);
      ids.push(v);
    }
  };

  for (const row of rows.slice(col >= 0 ? 1 : 0)) {
    if (col >= 0) take(row[col] ?? '');
    else row.forEach(take);
  }
  return ids;
}
