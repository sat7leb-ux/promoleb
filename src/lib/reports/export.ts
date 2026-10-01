/**
 * Client-side CSV and Excel-compatible export.
 *
 * Runs in the browser over rows the report has already fetched, so exporting
 * never needs a second query or a server round trip.
 */

/**
 * Escapes a value for CSV.
 *
 * Wraps in quotes whenever the value contains a delimiter, quote or newline,
 * and doubles embedded quotes — the escaping RFC 4180 requires. A leading
 * `=`, `+`, `-` or `@` is prefixed with a tab so spreadsheet software treats it
 * as text rather than a formula, which matters because this data includes
 * user-entered titles and notes.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`;
  if (/[",\n\r;]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds a CSV string from a header row and data rows. */
export function toCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
  delimiter = ',',
): string {
  const lines = [headers.map(escapeCell).join(delimiter)];
  for (const row of rows) lines.push(row.map(escapeCell).join(delimiter));
  return lines.join('\r\n');
}

/**
 * Triggers a browser download for the given content.
 *
 * The object URL is revoked on the next tick rather than immediately: Firefox
 * needs the URL to still resolve when the click is processed.
 */
export function downloadFile(filename: string, content: string, mime: string): void {
  // A UTF-8 BOM makes Excel read the file as UTF-8 instead of the local
  // codepage, which otherwise mangles Arabic and accented text.
  const blob = new Blob([mime === 'text/csv' ? `\uFEFF${content}` : content], {
    type: `${mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Strips characters that are unsafe in a filename. */
function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'export';
}

/** Timestamp for the filename, e.g. 2026-10-01-1430. */
function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportCsv(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  downloadFile(`sat7-promo-${safeFilename(filename)}-${stamp()}.csv`, toCsv(headers, rows), 'text/csv');
}

/**
 * Excel-compatible export.
 *
 * Emits SpreadsheetML 2003 (a single XML worksheet) rather than .xlsx. Excel,
 * LibreOffice and Google Sheets all open it, it needs no zip library on the
 * client, and it preserves cell types — so counts stay numeric and dates stay
 * dates instead of everything becoming text.
 */
export function exportExcel(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  const cell = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '<Cell/>';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
  };

  const headerCells = headers.map((h) => cell(h)).join('');
  const bodyRows = rows
    .map((row) => `<Row>${row.map(cell).join('')}</Row>`)
    .join('');

  const xml =
    '<?xml version="1.0"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Worksheet ss:Name="Export"><Table>' +
    `<Row>${headerCells}</Row>` +
    bodyRows +
    '</Table></Worksheet></Workbook>';

  downloadFile(
    `sat7-promo-${safeFilename(filename)}-${stamp()}.xml`,
    xml,
    'application/vnd.ms-excel',
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Opens the browser print dialog for the current page. */
export function printReport(): void {
  window.print();
}
