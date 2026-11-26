const CIVIL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_CIVIL_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const YEAR_MONTH_REGEX = /^(\d{4})-(\d{2})$/;

const MONTH_NAMES_PTBR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

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

export function isValidYearMonth(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const match = YEAR_MONTH_REGEX.exec(value.trim());
  if (!match) {
    return false;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retorna o intervalo civil fechado [startDate, endDate] (YYYY-MM-DD) de um mês YYYY-MM.
 */
export function getMonthDateRange(yearMonth: string): {
  startDate: string;
  endDate: string;
} {
  const match = YEAR_MONTH_REGEX.exec(yearMonth.trim());
  if (!match || !isValidYearMonth(yearMonth)) {
    throw new Error(`Competência mensal inválida: ${yearMonth}`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const mm = String(month).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${dd}`,
  };
}

/**
 * Avança ou retrocede N meses a partir de YYYY-MM sem uso de Date local.
 */
export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  if (!isValidYearMonth(yearMonth)) {
    return getCurrentYearMonth();
  }
  const [yearStr, monthStr] = yearMonth.trim().split('-');
  const totalMonths =
    Number.parseInt(yearStr, 10) * 12 + (Number.parseInt(monthStr, 10) - 1) + deltaMonths;
  const clamped = Math.max(1900 * 12, Math.min(2100 * 12 + 11, totalMonths));
  const nextYear = Math.floor(clamped / 12);
  const nextMonth = (clamped % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/**
 * Formata YYYY-MM como "Novembro de 2026" sem risco de deslocamento de fuso horário.
 */
export function formatYearMonthLabelPTBR(yearMonth: string): string {
  if (!isValidYearMonth(yearMonth)) {
    return yearMonth;
  }
  const [yearStr, monthStr] = yearMonth.trim().split('-');
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES_PTBR[monthIndex] ?? monthStr;
  return `${monthName} de ${yearStr}`;
}
