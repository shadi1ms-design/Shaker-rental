/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin digits so phones / IDs are stored consistently. */
export function normalizeDigits(value: string): string {
  return (value || '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}
