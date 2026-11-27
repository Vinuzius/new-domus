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

/**
 * Converte data civil YYYY-MM-DD para Date local (00:00:00 local) sem deslocamento UTC.
 */
export function civilDateToLocalDate(isoDate: string): Date | null {
  if (!isValidCivilDate(isoDate)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = isoDate.trim().split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  return new Date(year, month - 1, day);
}

/**
 * Converte Date local selecionada no calendário para YYYY-MM-DD sem usar toISOString (UTC).
 */
export function localDateToCivilDate(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const candidate = `${year}-${month}-${day}`;
  return isValidCivilDate(candidate) ? candidate : null;
}

export function validateCivilDateRange(
  startDate?: string,
  endDate?: string
): { valid: boolean; error?: string } {
  const start = startDate?.trim() || '';
  const end = endDate?.trim() || '';

  if (start && !isValidCivilDate(start)) {
    return { valid: false, error: 'Data inicial inválida.' };
  }
  if (end && !isValidCivilDate(end)) {
    return { valid: false, error: 'Data final inválida.' };
  }
  if (start && end && start > end) {
    return {
      valid: false,
      error: 'A data inicial não pode ser posterior à data final.',
    };
  }
  return { valid: true };
}

export const MIN_CYCLE_START_DAY = 1;
export const MAX_CYCLE_START_DAY = 28;

export function isValidCycleStartDay(day: number): boolean {
  return (
    Number.isInteger(day) &&
    day >= MIN_CYCLE_START_DAY &&
    day <= MAX_CYCLE_START_DAY
  );
}

export interface FinancialCyclePeriod {
  anchorYearMonth: string;
  startDate: string;
  endDate: string;
  cycleStartDay: number;
  label: string;
  rangeLabel: string;
}

export function formatCycleRangeLabel(startDate: string, endDate: string): string {
  return `${formatCivilDateBR(startDate)} — ${formatCivilDateBR(endDate)}`;
}

/**
 * Determina o mês-âncora (YYYY-MM) do ciclo financeiro ao qual uma data civil pertence.
 */
export function getCycleAnchorFromDate(
  referenceDate: string,
  cycleStartDay: number
): string {
  if (!isValidCivilDate(referenceDate)) {
    throw new Error(`Data de referência inválida: ${referenceDate}`);
  }
  if (!isValidCycleStartDay(cycleStartDay)) {
    throw new Error(`Dia de início do ciclo inválido: ${cycleStartDay}`);
  }

  const [yearStr, monthStr, dayStr] = referenceDate.trim().split('-');
  const yearMonth = `${yearStr}-${monthStr}`;
  const day = Number.parseInt(dayStr, 10);

  if (cycleStartDay === 1 || day >= cycleStartDay) {
    return yearMonth;
  }

  return shiftYearMonth(yearMonth, -1);
}

/**
 * Calcula as datas inclusivas [startDate, endDate] de um ciclo a partir do mês-âncora (YYYY-MM)
 * e do dia de início configurado (1..28).
 */
export function getFinancialCycleRange(
  anchorYearMonth: string,
  cycleStartDay: number
): FinancialCyclePeriod {
  if (!isValidYearMonth(anchorYearMonth)) {
    throw new Error(`Competência de ciclo inválida: ${anchorYearMonth}`);
  }
  if (!isValidCycleStartDay(cycleStartDay)) {
    throw new Error(`Dia de início do ciclo inválido: ${cycleStartDay}`);
  }

  const normalizedAnchor = anchorYearMonth.trim();

  if (cycleStartDay === 1) {
    const { startDate, endDate } = getMonthDateRange(normalizedAnchor);
    return {
      anchorYearMonth: normalizedAnchor,
      startDate,
      endDate,
      cycleStartDay: 1,
      label: formatYearMonthLabelPTBR(normalizedAnchor),
      rangeLabel: formatCycleRangeLabel(startDate, endDate),
    };
  }

  const startDate = `${normalizedAnchor}-${String(cycleStartDay).padStart(2, '0')}`;
  const nextMonth = shiftYearMonth(normalizedAnchor, 1);
  const endDate = `${nextMonth}-${String(cycleStartDay - 1).padStart(2, '0')}`;
  const rangeLabel = formatCycleRangeLabel(startDate, endDate);

  return {
    anchorYearMonth: normalizedAnchor,
    startDate,
    endDate,
    cycleStartDay,
    label: rangeLabel,
    rangeLabel,
  };
}

export function getFinancialCycleForDate(
  referenceDate: string,
  cycleStartDay: number
): FinancialCyclePeriod {
  const anchor = getCycleAnchorFromDate(referenceDate, cycleStartDay);
  return getFinancialCycleRange(anchor, cycleStartDay);
}

export function getCurrentFinancialCycle(
  cycleStartDay: number,
  referenceDate: string = getTodayCivilDate()
): FinancialCyclePeriod {
  return getFinancialCycleForDate(referenceDate, cycleStartDay);
}

export function shiftFinancialCycle(
  anchorYearMonth: string,
  deltaCycles: number,
  cycleStartDay: number
): FinancialCyclePeriod {
  const nextAnchor = shiftYearMonth(anchorYearMonth, deltaCycles);
  return getFinancialCycleRange(nextAnchor, cycleStartDay);
}
