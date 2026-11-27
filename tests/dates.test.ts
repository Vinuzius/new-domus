import { describe, expect, it } from 'vitest';
import {
  civilDateToLocalDate,
  formatCivilDateBR,
  formatYearMonthLabelPTBR,
  getCurrentFinancialCycle,
  getFinancialCycleForDate,
  getFinancialCycleRange,
  getMonthDateRange,
  isValidCivilDate,
  isValidCivilDateBR,
  isValidYearMonth,
  localDateToCivilDate,
  maskCivilDateBRInput,
  parseCivilDateBRToISO,
  shiftFinancialCycle,
  shiftYearMonth,
  validateCivilDateRange,
} from '@/lib/domain/dates';

describe('Validação, máscara e conversão de datas civis (DD/MM/AAAA e YYYY-MM-DD)', () => {
  it('aceita datas civis ISO válidas incluindo ano bissexto', () => {
    expect(isValidCivilDate('2026-11-26')).toBe(true);
    expect(isValidCivilDate('2024-02-29')).toBe(true);
    expect(isValidCivilDate('2026-01-01')).toBe(true);
  });

  it('rejeita datas impossíveis ou fora do formato ISO civil', () => {
    expect(isValidCivilDate('2025-02-29')).toBe(false);
    expect(isValidCivilDate('2026-04-31')).toBe(false);
    expect(isValidCivilDate('2026-13-01')).toBe(false);
    expect(isValidCivilDate('26/11/2026')).toBe(false);
    expect(isValidCivilDate('2026-11-26T00:00:00Z')).toBe(false);
  });

  it('preserva exatamente o dia civil ao formatar para DD/MM/AAAA', () => {
    expect(formatCivilDateBR('2026-01-01')).toBe('01/01/2026');
    expect(formatCivilDateBR('2026-11-26')).toBe('26/11/2026');
    expect(formatCivilDateBR('2026-12-31')).toBe('31/12/2026');
  });

  it('converte DD/MM/AAAA válido para YYYY-MM-DD sem deslocamento de timezone', () => {
    expect(parseCivilDateBRToISO('01/01/2026')).toBe('2026-01-01');
    expect(parseCivilDateBRToISO('26/11/2026')).toBe('2026-11-26');
    expect(parseCivilDateBRToISO('29/02/2024')).toBe('2024-02-29');
    expect(parseCivilDateBRToISO(' 31/12/2026 ')).toBe('2026-12-31');

    const iso = parseCivilDateBRToISO('01/03/2026');
    expect(iso).toBe('2026-03-01');
    expect(formatCivilDateBR(iso!)).toBe('01/03/2026');
  });

  it('converte entre Date local do calendário e YYYY-MM-DD sem deslocamento de fuso horário e valida intervalos', () => {
    for (const iso of ['2026-01-01', '2024-02-29', '2026-11-26', '2026-12-31']) {
      const local = civilDateToLocalDate(iso);
      expect(local).not.toBeNull();
      expect(localDateToCivilDate(local!)).toBe(iso);
    }

    expect(civilDateToLocalDate('2025-02-29')).toBeNull();
    expect(validateCivilDateRange('2026-11-04', '2026-12-03').valid).toBe(true);
    expect(validateCivilDateRange('2026-11-04', '').valid).toBe(true);
    expect(validateCivilDateRange('', '').valid).toBe(true);
    expect(validateCivilDateRange('2026-12-04', '2026-11-04').valid).toBe(false);
  });

  it('rejeita datas brasileiras impossíveis, incompletas ou fora do padrão DD/MM/AAAA', () => {
    expect(parseCivilDateBRToISO('31/02/2026')).toBeNull();
    expect(parseCivilDateBRToISO('30/02/2026')).toBeNull();
    expect(parseCivilDateBRToISO('31/04/2026')).toBeNull();
    expect(parseCivilDateBRToISO('29/02/2025')).toBeNull();
    expect(parseCivilDateBRToISO('00/01/2026')).toBeNull();
    expect(parseCivilDateBRToISO('15/13/2026')).toBeNull();
    expect(parseCivilDateBRToISO('12/05')).toBeNull();
    expect(parseCivilDateBRToISO('5/3/2026')).toBeNull();
    expect(parseCivilDateBRToISO('12/05/26')).toBeNull();
    expect(parseCivilDateBRToISO('2026-05-12')).toBeNull();
    expect(parseCivilDateBRToISO('')).toBeNull();

    expect(isValidCivilDateBR('31/02/2026')).toBe(false);
    expect(isValidCivilDateBR('28/02/2026')).toBe(true);
  });

  it('aplica máscara progressiva DD/MM/AAAA na digitação', () => {
    expect(maskCivilDateBRInput('')).toBe('');
    expect(maskCivilDateBRInput('2')).toBe('2');
    expect(maskCivilDateBRInput('26')).toBe('26');
    expect(maskCivilDateBRInput('261')).toBe('26/1');
    expect(maskCivilDateBRInput('2611')).toBe('26/11');
    expect(maskCivilDateBRInput('26112026')).toBe('26/11/2026');
    expect(maskCivilDateBRInput('26/11/202699abc')).toBe('26/11/2026');
  });

  it('calcula intervalo mensal, navegação entre meses e rótulo pt-BR sem conversão UTC', () => {
    expect(isValidYearMonth('2026-11')).toBe(true);
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-00')).toBe(false);

    expect(getMonthDateRange('2026-11')).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
    expect(getMonthDateRange('2024-02')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    expect(getMonthDateRange('2026-02')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });

    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(formatYearMonthLabelPTBR('2026-11')).toBe('Novembro de 2026');
    expect(formatYearMonthLabelPTBR('2026-03')).toBe('Março de 2026');
  });
});

describe('Cálculo de ciclos financeiros personalizados', () => {
  it('mantém comportamento mensal exato quando o dia de início é 1', () => {
    const nov = getFinancialCycleRange('2026-11', 1);
    expect(nov.startDate).toBe('2026-11-01');
    expect(nov.endDate).toBe('2026-11-30');
    expect(nov.label).toBe('Novembro de 2026');

    const febLeap = getFinancialCycleForDate('2024-02-29', 1);
    expect(febLeap.startDate).toBe('2024-02-01');
    expect(febLeap.endDate).toBe('2024-02-29');

    const febCommon = getFinancialCycleForDate('2026-02-15', 1);
    expect(febCommon.startDate).toBe('2026-02-01');
    expect(febCommon.endDate).toBe('2026-02-28');
  });

  it('calcula ciclos corretamente para dia 4 em datas anteriores, posteriores e transições de mês e ano', () => {
    expect(getFinancialCycleForDate('2026-11-26', 4)).toMatchObject({
      anchorYearMonth: '2026-11',
      startDate: '2026-11-04',
      endDate: '2026-12-03',
      label: '04/11/2026 — 03/12/2026',
    });

    expect(getFinancialCycleForDate('2026-12-02', 4)).toMatchObject({
      anchorYearMonth: '2026-11',
      startDate: '2026-11-04',
      endDate: '2026-12-03',
    });

    expect(getFinancialCycleForDate('2026-12-04', 4)).toMatchObject({
      anchorYearMonth: '2026-12',
      startDate: '2026-12-04',
      endDate: '2027-01-03',
      label: '04/12/2026 — 03/01/2027',
    });

    expect(getFinancialCycleForDate('2027-01-03', 4)).toMatchObject({
      anchorYearMonth: '2026-12',
      startDate: '2026-12-04',
      endDate: '2027-01-03',
    });

    expect(getFinancialCycleForDate('2027-01-04', 4)).toMatchObject({
      anchorYearMonth: '2027-01',
      startDate: '2027-01-04',
      endDate: '2027-02-03',
    });
  });

  it('trata fevereiro, ano bissexto e navegação entre ciclos anteriores e próximos', () => {
    const leapBefore = getFinancialCycleForDate('2024-02-03', 4);
    expect(leapBefore.startDate).toBe('2024-01-04');
    expect(leapBefore.endDate).toBe('2024-02-03');

    const leapDay = getFinancialCycleForDate('2024-02-29', 4);
    expect(leapDay.startDate).toBe('2024-02-04');
    expect(leapDay.endDate).toBe('2024-03-03');

    const marchBeforeStart = getFinancialCycleForDate('2024-03-01', 4);
    expect(marchBeforeStart.startDate).toBe('2024-02-04');
    expect(marchBeforeStart.endDate).toBe('2024-03-03');

    const day28Feb = getCurrentFinancialCycle(28, '2026-02-28');
    expect(day28Feb.startDate).toBe('2026-02-28');
    expect(day28Feb.endDate).toBe('2026-03-27');

    const prev = shiftFinancialCycle('2027-01', -1, 4);
    expect(prev.anchorYearMonth).toBe('2026-12');
    expect(prev.startDate).toBe('2026-12-04');
    expect(prev.endDate).toBe('2027-01-03');

    const next = shiftFinancialCycle('2026-12', 1, 4);
    expect(next.anchorYearMonth).toBe('2027-01');
    expect(next.startDate).toBe('2027-01-04');
    expect(next.endDate).toBe('2027-02-03');
  });
});
