import { describe, expect, it } from 'vitest';
import {
  formatCentsToBRL,
  formatCentsToInput,
  parseBRLInputToCents,
} from '@/lib/domain/money';

describe('Conversão e formatação monetária BRL (centavos inteiros)', () => {
  it('converte formatos brasileiros e decimais comuns sem erro de ponto flutuante', () => {
    expect(parseBRLInputToCents('19,99')).toBe(1999);
    expect(parseBRLInputToCents('1.234,56')).toBe(123456);
    expect(parseBRLInputToCents('R$ 250,00')).toBe(25000);
    expect(parseBRLInputToCents('100')).toBe(10000);
    expect(parseBRLInputToCents('100,5')).toBe(10050);
    expect(parseBRLInputToCents('49.90')).toBe(4990);
    expect(parseBRLInputToCents('0,01')).toBe(1);
    expect(parseBRLInputToCents('-150,25')).toBe(-15025);
    expect(parseBRLInputToCents('1.000')).toBe(100000);
    expect(parseBRLInputToCents('1.234.567,89')).toBe(123456789);
  });

  it('rejeita entradas inválidas ou com mais de duas casas decimais', () => {
    expect(parseBRLInputToCents('')).toBeNull();
    expect(parseBRLInputToCents('abc')).toBeNull();
    expect(parseBRLInputToCents('12,345')).toBeNull();
    expect(parseBRLInputToCents('12,3,4')).toBeNull();
    expect(parseBRLInputToCents('1.23.45')).toBeNull();
  });

  it('formata centavos inteiros para BRL e texto editável pt-BR', () => {
    expect(formatCentsToBRL(123456).replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56');
    expect(formatCentsToBRL(0).replace(/\u00a0/g, ' ')).toBe('R$ 0,00');
    expect(formatCentsToBRL(-5000).replace(/\u00a0/g, ' ')).toBe('-R$ 50,00');
    expect(formatCentsToInput(123456)).toBe('1.234,56');
    expect(formatCentsToInput(50)).toBe('0,50');
  });
});
