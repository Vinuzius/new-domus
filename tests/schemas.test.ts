import { describe, expect, it } from 'vitest';
import {
  bankAccountFormSchema,
  categorySchema,
  expenseFormSchema,
  personSchema,
} from '@/lib/domain/schemas';

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('Schemas de validação Zod da v0', () => {
  it('valida categoria e pessoa com trim e tamanho mínimo/máximo', () => {
    expect(categorySchema.parse({ name: '  Alimentação  ' }).name).toBe('Alimentação');
    expect(categorySchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(personSchema.parse({ name: '  Ana Paula  ' }).name).toBe('Ana Paula');
    expect(personSchema.safeParse({ name: ' ' }).success).toBe(false);
  });

  it('valida conta bancária com instituição opcional e saldo inicial em centavos', () => {
    const parsed = bankAccountFormSchema.parse({
      name: 'Conta Corrente',
      institution: '  ',
      initialBalance: '1.500,25',
    });
    expect(parsed.institution).toBeNull();
    expect(parsed.initialBalance).toBe(150025);

    const invalid = bankAccountFormSchema.safeParse({
      name: 'Conta',
      initialBalance: 'valor-errado',
    });
    expect(invalid.success).toBe(false);
  });

  it('valida despesa exigindo categoria e pessoa e permitindo conta opcional', () => {
    const withoutAccount = expenseFormSchema.parse({
      description: 'Farmácia',
      amount: '84,50',
      date: '2026-11-26',
      categoryId: VALID_UUID_1,
      personId: VALID_UUID_2,
      bankAccountId: '',
    });
    expect(withoutAccount.amount).toBe(8450);
    expect(withoutAccount.bankAccountId).toBeNull();

    const withAccount = expenseFormSchema.parse({
      description: 'Mercado',
      amount: '320,00',
      date: '2026-11-26',
      categoryId: VALID_UUID_1,
      personId: VALID_UUID_2,
      bankAccountId: VALID_UUID_3,
    });
    expect(withAccount.bankAccountId).toBe(VALID_UUID_3);

    const zeroAmount = expenseFormSchema.safeParse({
      description: 'Zero',
      amount: '0,00',
      date: '2026-11-26',
      categoryId: VALID_UUID_1,
      personId: VALID_UUID_2,
    });
    expect(zeroAmount.success).toBe(false);

    const missingPerson = expenseFormSchema.safeParse({
      description: 'Sem responsável',
      amount: '50,00',
      date: '2026-11-26',
      categoryId: VALID_UUID_1,
      personId: '',
    });
    expect(missingPerson.success).toBe(false);
  });
});
