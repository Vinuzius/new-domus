import { z } from 'zod';
import { isValidCivilDate, isValidYearMonth } from './dates';
import { parseBRLInputToCents } from './money';

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const idSchema = z
  .string()
  .trim()
  .regex(uuidRegex, 'Identificador inválido.');

export const loginSchema = z.object({
  password: z
    .string()
    .min(1, 'Informe a senha de acesso.')
    .max(256, 'Senha excede o limite permitido.'),
});

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da categoria deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome da categoria pode ter no máximo 60 caracteres.'),
});

export const personSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome do responsável deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome do responsável pode ter no máximo 60 caracteres.'),
});

export const personDefaultSchema = z.object({
  isDefault: z.boolean({
    error: 'Informe se a pessoa deve ser marcada como responsável padrão.',
  }),
});

export const bankAccountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da conta deve ter pelo menos 2 caracteres.')
    .max(80, 'O nome da conta pode ter no máximo 80 caracteres.'),
  institution: z
    .string()
    .trim()
    .max(80, 'O nome da instituição pode ter no máximo 80 caracteres.')
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  initialBalance: z
    .string()
    .trim()
    .default('0,00')
    .transform((val, ctx) => {
      const normalized = val.length === 0 ? '0,00' : val;
      const cents = parseBRLInputToCents(normalized);
      if (cents === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Informe um saldo inicial válido em reais (ex.: 1.250,00).',
        });
        return z.NEVER;
      }
      return cents;
    }),
});

export const bankAccountInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome da conta deve ter pelo menos 2 caracteres.')
    .max(80, 'O nome da conta pode ter no máximo 80 caracteres.'),
  institution: z
    .string()
    .trim()
    .max(80, 'O nome da instituição pode ter no máximo 80 caracteres.')
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  initialBalanceCents: z
    .number()
    .int('O saldo inicial deve ser representado em centavos inteiros.')
    .min(-999_999_999, 'Valor abaixo do limite permitido.')
    .max(999_999_999, 'Valor acima do limite permitido.'),
});

export const expenseFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'A descrição deve ter pelo menos 2 caracteres.')
    .max(140, 'A descrição pode ter no máximo 140 caracteres.'),
  amount: z
    .string()
    .trim()
    .min(1, 'Informe o valor da despesa.')
    .transform((val, ctx) => {
      const cents = parseBRLInputToCents(val);
      if (cents === null || cents <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Informe um valor positivo válido em reais (ex.: 89,90).',
        });
        return z.NEVER;
      }
      return cents;
    }),
  date: z
    .string()
    .trim()
    .refine(isValidCivilDate, 'Selecione uma data válida (AAAA-MM-DD).'),
  categoryId: z
    .string()
    .trim()
    .regex(uuidRegex, 'Selecione uma categoria válida.'),
  personId: z
    .string()
    .trim()
    .regex(uuidRegex, 'Selecione um responsável válido.'),
  bankAccountId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val, ctx) => {
      if (!val || val.length === 0) {
        return null;
      }
      if (!uuidRegex.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Selecione uma conta bancária válida.',
        });
        return z.NEVER;
      }
      return val;
    }),
});

export const expenseInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'A descrição deve ter pelo menos 2 caracteres.')
    .max(140, 'A descrição pode ter no máximo 140 caracteres.'),
  amountCents: z
    .number()
    .int('O valor da despesa deve ser um número inteiro em centavos.')
    .positive('O valor da despesa deve ser maior que zero.')
    .max(999_999_999, 'Valor acima do limite permitido.'),
  date: z
    .string()
    .trim()
    .refine(isValidCivilDate, 'Selecione uma data válida (AAAA-MM-DD).'),
  categoryId: z
    .string()
    .trim()
    .regex(uuidRegex, 'Selecione uma categoria válida.'),
  personId: z
    .string()
    .trim()
    .regex(uuidRegex, 'Selecione um responsável válido.'),
  bankAccountId: z
    .string()
    .trim()
    .regex(uuidRegex, 'Selecione uma conta bancária válida.')
    .nullable()
    .optional()
    .transform((val) => val ?? null),
});

export const yearMonthSchema = z
  .string()
  .trim()
  .refine(isValidYearMonth, 'Competência mensal inválida (AAAA-MM).');

export const EXPENSE_SORT_VALUES = [
  'date_desc',
  'date_asc',
  'amount_desc',
  'amount_asc',
] as const;

export type ExpenseSortOption = (typeof EXPENSE_SORT_VALUES)[number];

export const expenseFilterSchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(100, 'A pesquisa pode ter no máximo 100 caracteres.')
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined)),
    startDate: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined))
      .refine(
        (val) => val === undefined || isValidCivilDate(val),
        'Data inicial inválida (AAAA-MM-DD).'
      ),
    endDate: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined))
      .refine(
        (val) => val === undefined || isValidCivilDate(val),
        'Data final inválida (AAAA-MM-DD).'
      ),
    categoryId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined))
      .refine(
        (val) => val === undefined || uuidRegex.test(val),
        'Filtro de categoria inválido.'
      ),
    personId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined))
      .refine(
        (val) => val === undefined || uuidRegex.test(val),
        'Filtro de responsável inválido.'
      ),
    bankAccountId: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val && val.length > 0 ? val : undefined))
      .refine(
        (val) => val === undefined || uuidRegex.test(val),
        'Filtro de conta bancária inválido.'
      ),
    sort: z.enum(EXPENSE_SORT_VALUES).optional().default('date_desc'),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      message: 'A data inicial não pode ser posterior à data final.',
      path: ['startDate'],
    }
  );

export const financialSettingsSchema = z.object({
  cycleStartDay: z
    .number({ error: 'Informe um dia de início entre 1 e 28.' })
    .int('O dia de início do ciclo deve ser um número inteiro.')
    .min(1, 'O dia de início do ciclo deve ser no mínimo 1.')
    .max(28, 'O dia de início do ciclo deve ser no máximo 28.'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type BankAccountInput = z.infer<typeof bankAccountInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
export type FinancialSettingsInput = z.infer<typeof financialSettingsSchema>;
