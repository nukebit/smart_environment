import ExcelJS from 'exceljs';
import JSZip from 'jszip';

export type ExportWarning = {
  id: number; title: string; room: string; building: string; kind: string;
  createdAt: string; measuredAt: string; value: number | null; firstValue?: number | null; limit: number | null;
  unit: string; advice: string; isRead: boolean;
};

const date = (value: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);

// Dezelfde categoriekleuren als de lichte weergave van de waarschuwingenpagina.
const warningColors = (kind: string) => {
  if (kind.startsWith('temperature')) return { border: '#e7000b', background: '#fef2f2' };
  if (kind.startsWith('humidity')) return { border: '#155dfc', background: '#eff6ff' };
  if (kind.startsWith('pressure')) return { border: '#00a63e', background: '#f0fdf4' };
  return { border: '#fe9a00', background: '#fffbeb' };
};

export function selectWarningsForExport(items: ExportWarning[], count: number) {
  if (!Number.isInteger(count) || count < 1 || count > items.length) {
    throw new Error('Kies een geldig aantal meldingen.');
  }
  return [...items].sort((a, b) => date(b.createdAt).getTime() - date(a.createdAt).getTime() || b.id - a.id).slice(0, count);
}

const formatValue = (value: number, unit: string) => `${value.toLocaleString('nl-NL', { maximumSignificantDigits: 21 })} ${unit}`.trim();

export async function createWarningsExcel(items: ExportWarning[], count: number, category: string, room: string) {
  const selected = selectWarningsForExport(items, count);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Environment';
  const sheet = workbook.addWorksheet('Waarschuwingen', {
    views: [{ state: 'normal', showGridLines: false }],
  });
  const widths = [40, 24, 16, 28, 24, 22, 65];
  sheet.columns = widths.map(width => ({ width }));
  const summary = [
    'Waarschuwingenrapport',
    `Smart Environment | Export: ${new Date().toLocaleString('nl-NL')}`,
    `Categorie: ${category} | Lokaal: ${room}`,
    `${selected.length} van ${items.length} meldingen | Nieuwste eerst`,
  ];
  summary.forEach((text, index) => {
    sheet.mergeCells(index + 1, 1, index + 1, 7);
    const cell = sheet.getCell(index + 1, 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: index === 0 ? 20 : 11, bold: index === 0, color: { argb: index === 0 ? 'FF047857' : 'FF334155' } };
    sheet.getRow(index + 1).height = index === 0 ? 32 : 22;
  });
  const header = sheet.getRow(7);
  header.values = ['Melding', 'Gebouw', 'Lokaal', 'Tijdstip melding', 'Waarde bij melding', 'Grens bij melding', 'Advies'];
  header.height = 26;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
    cell.border = { right: { style: 'thin', color: { argb: 'FF6EE7B7' } } };
  });
  selected.forEach(w => {
    const row = sheet.addRow([w.title, w.building, w.room, date(w.createdAt).toLocaleString('nl-NL'),
      w.firstValue == null ? '' : formatValue(w.firstValue, w.unit),
      w.limit === null ? '' : `${w.kind.endsWith('-high') ? 'Bovengrens' : 'Ondergrens'}\n${formatValue(w.limit, w.unit)}`, w.advice]);
    const colors = warningColors(w.kind);
    row.height = Math.max(44, 15 * Math.max(Math.ceil(w.title.length / 35), Math.ceil(w.advice.length / 58), Math.ceil(w.building.length / 20)));
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colors.background.slice(1).toUpperCase() } };
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF020617' } };
      cell.alignment = { horizontal: 'left', vertical: 'top', indent: 1, wrapText: true };
      cell.border = {
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
      };
    });
    row.getCell(1).border = { ...row.getCell(1).border, left: { style: 'medium', color: { argb: 'FF' + colors.border.slice(1).toUpperCase() } } };
    row.getCell(3).numFmt = '@';
  });
  const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const xml = await archive.file(sheetPath)!.async('string');
  // Lokaalnamen zijn identificaties, ook als ze op een getal lijken (bijv. 3.55).
  archive.file(sheetPath, xml.replace('</worksheet>', `<ignoredErrors><ignoredError sqref="C8:C${7 + selected.length}" numberStoredAsText="1"/></ignoredErrors></worksheet>`));
  return archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
