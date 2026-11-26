const CIVIL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidCivilDate(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const match = CIVIL_DATE_REGEX.exec(value.trim());
  if (!match) {
    return false;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Formata uma data civil YYYY-MM-DD para DD/MM/AAAA sem conversão de timezone.
 */
export function formatCivilDateBR(isoDate: string): string {
  const match = CIVIL_DATE_REGEX.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function getTodayCivilDate(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
