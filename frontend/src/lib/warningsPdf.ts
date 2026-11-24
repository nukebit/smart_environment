import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export type ExportWarning = {
  id: number; title: string; room: string; building: string; kind: string;
  createdAt: string; measuredAt: string; value: number | null; limit: number | null;
  unit: string; advice: string; isRead: boolean;
};

const date = (value: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
const time = (value: string) => date(value).toLocaleString('nl-NL');

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

export function createWarningsPdf(items: ExportWarning[], count: number, category: string, room: string) {
  const selected = selectWarningsForExport(items, count);
  const doc = new jsPDF();
  doc.setProperties({ title: 'Waarschuwingenrapport', author: 'Smart Environment' });
  doc.setFontSize(20);
  doc.setTextColor(4, 120, 87);
  doc.text('Waarschuwingenrapport', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const summary = doc.splitTextToSize([
    `Smart Environment | Export: ${new Date().toLocaleString('nl-NL')}`,
    `Categorie: ${category} | Lokaal: ${room}`,
    `${selected.length} van ${items.length} meldingen | Nieuwste eerst`,
    'Eerste melding = start van de melding; laatste meting = laatst geregistreerde meetwaarde.',
  ].join('\n'), 182);
  doc.text(summary, 14, 29);
  autoTable(doc, {
    startY: 33 + summary.length * 4.5,
    margin: { top: 18, bottom: 18, left: 14, right: 14 },
    head: [['Melding en lokaal', 'Tijd en meetwaarden', 'Advies']],
    body: selected.map(w => [
      `${w.title}\n${w.building} - ${w.room}`,
      `Eerste melding:\n${time(w.createdAt)}\nLaatste meting:\n${time(w.measuredAt)}${w.value === null ? '' : `\nWaarde: ${w.value.toLocaleString('nl-NL', { maximumSignificantDigits: 21 })} ${w.unit}`}${w.limit === null ? '' : `\n${w.kind.endsWith('-high') ? 'Bovengrens' : 'Ondergrens'}: ${w.limit.toLocaleString('nl-NL')} ${w.unit}`}`,
      w.advice,
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [4, 120, 87] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 62 }, 2: { cellWidth: 70 } },
    rowPageBreak: 'avoid',
    didParseCell: ({ section, row, cell }) => {
      if (section !== 'body') return;
      const warning = selected[row.index];
      cell.styles.fillColor = warningColors(warning.kind).background;
      cell.styles.textColor = '#020617';
    },
    didDrawCell: ({ section, row, column, cell }) => {
      if (section !== 'body' || column.index !== 0) return;
      doc.setDrawColor(warningColors(selected[row.index].kind).border);
      doc.setLineWidth(1);
      doc.line(cell.x, cell.y, cell.x, cell.y + cell.height);
    },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Smart Environment', 14, 288);
    doc.text(`Pagina ${page} van ${pages}`, 196, 288, { align: 'right' });
  }
  return doc;
}
