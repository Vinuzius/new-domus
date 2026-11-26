const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const brlInputFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCentsToBRL(cents: number): string {
  if (!Number.isFinite(cents)) {
    return brlFormatter.format(0);
  }
  return brlFormatter.format(Math.trunc(cents) / 100);
}

export function formatCentsToInput(cents: number): string {
  if (!Number.isFinite(cents)) {
    return '0,00';
  }
  return brlInputFormatter.format(Math.trunc(cents) / 100);
}

/**
 * Converte texto monetário em BRL (ex.: "1.234,56", "R$ 49,90", "100.5", "-25,00")
 * para centavos inteiros usando manipulação de string, sem aritmética de ponto flutuante.
 */
export function parseBRLInputToCents(raw: string): number | null {
  if (typeof raw !== 'string') {
    return null;
  }

  let normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  normalized = normalized.replace(/^R\$\s*/i, '').replace(/\s+/g, '');

  let isNegative = false;
  if (normalized.startsWith('-')) {
    isNegative = true;
    normalized = normalized.slice(1);
  } else if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }

  if (!normalized) {
    return null;
  }

  // Rejeita caracteres fora de dígitos, ponto e vírgula
  if (!/^[0-9.,]+$/.test(normalized)) {
    return null;
  }

  const commaCount = (normalized.match(/,/g) ?? []).length;
  const dotCount = (normalized.match(/\./g) ?? []).length;

  let integerPart = '';
  let decimalPart = '';

  if (commaCount > 1) {
    return null;
  }

  if (commaCount === 1) {
    // Formato pt-BR: pontos são separadores de milhar, vírgula é separador decimal
    const [intRaw, decRaw] = normalized.split(',');
    if (dotCount > 0 && !/^\d{1,3}(\.\d{3})*$/.test(intRaw)) {
      return null;
    }
    integerPart = intRaw.replace(/\./g, '');
    decimalPart = decRaw;
  } else if (dotCount === 1) {
    // Formato com um ponto: pode ser milhar ("1.000") ou decimal ("49.90" / "49.5")
    const [left, right] = normalized.split('.');
    if (right.length === 3 && left.length >= 1 && left.length <= 3 && left !== '0') {
      integerPart = left + right;
      decimalPart = '';
    } else if (right.length >= 1 && right.length <= 2) {
      integerPart = left;
      decimalPart = right;
    } else {
      return null;
    }
  } else if (dotCount > 1) {
    // Vários pontos só são válidos como separadores de milhar ("1.234.567")
    if (!/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
      return null;
    }
    integerPart = normalized.replace(/\./g, '');
    decimalPart = '';
  } else {
    integerPart = normalized;
    decimalPart = '';
  }

  if (!/^\d+$/.test(integerPart)) {
    return null;
  }
  if (decimalPart.length > 2 || (decimalPart.length > 0 && !/^\d+$/.test(decimalPart))) {
    return null;
  }

  const paddedDecimal = decimalPart.padEnd(2, '0');
  const reais = Number.parseInt(integerPart, 10);
  const centavos = Number.parseInt(paddedDecimal, 10);

  if (!Number.isSafeInteger(reais) || !Number.isSafeInteger(centavos)) {
    return null;
  }

  const total = reais * 100 + centavos;
  if (!Number.isSafeInteger(total) || total > 999_999_999) {
    return null;
  }

  if (total === 0) {
    return 0;
  }

  return isNegative ? -total : total;
}
