// Preserve the typed text until validation; native number inputs can erase an
// incomplete minus sign. Accept Dutch decimal commas and the Unicode minus.
export function parseGrenswaarde(text: string): number {
  const normalized = text.trim().replace(/−/g, '-').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return NaN;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}
