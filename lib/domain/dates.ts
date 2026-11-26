const CIVIL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_CIVIL_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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
 * Converte data no padrão brasileiro DD/MM/AAAA para YYYY-MM-DD,
 * validando calendário real (bissextos e dias por mês) sem conversão de fuso horário.
 */
export function parseCivilDateBRToISO(value: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = BR_CIVIL_DATE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const isoCandidate = `${year}-${month}-${day}`;
  return isValidCivilDate(isoCandidate) ? isoCandidate : null;
}

export function isValidCivilDateBR(value: string): boolean {
  return parseCivilDateBRToISO(value) !== null;
}

/**
 * Aplica máscara progressiva DD/MM/AAAA durante a digitação ou colagem.
 */
export function maskCivilDateBRInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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

export function getTodayCivilDateBR(): string {
  return formatCivilDateBR(getTodayCivilDate());
}
