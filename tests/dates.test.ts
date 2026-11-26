import { describe, expect, it } from 'vitest';
import { formatCivilDateBR, isValidCivilDate } from '@/lib/domain/dates';

describe('Validação e formatação de datas civis (YYYY-MM-DD)', () => {
  it('aceita datas civis válidas incluindo ano bissexto', () => {
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
});
