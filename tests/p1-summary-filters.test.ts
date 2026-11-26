import { describe, expect, it } from 'vitest';
import type { ExpenseInput } from '@/lib/domain/schemas';
import {
  buildMonthlySummary,
  createExpenseService,
  type ExpenseListItem,
  type ExpenseRepository,
  type NormalizedExpenseFilters,
} from '@/lib/services/expenses';

const CAT_MERCADO = '11111111-1111-4111-8111-111111111111';
const CAT_MORADIA = '11111111-1111-4111-8111-111111111112';
const CAT_TRANSPORTE = '11111111-1111-4111-8111-111111111113';
const CAT_LAZER = '11111111-1111-4111-8111-111111111114';

const PERSON_ANA = '22222222-2222-4222-8222-222222222221';
const PERSON_CARLOS = '22222222-2222-4222-8222-222222222222';

const ACC_NUBANK = '33333333-3333-4333-8333-333333333331';
const ACC_ITAU = '33333333-3333-4333-8333-333333333332';

const CATEGORY_NAMES: Record<string, string> = {
  [CAT_MERCADO]: 'Mercado',
  [CAT_MORADIA]: 'Moradia',
  [CAT_TRANSPORTE]: 'Transporte',
  [CAT_LAZER]: 'Lazer',
};

const PERSON_NAMES: Record<string, string> = {
  [PERSON_ANA]: 'Ana',
  [PERSON_CARLOS]: 'Carlos',
};

const ACCOUNT_NAMES: Record<string, string> = {
  [ACC_NUBANK]: 'Nubank',
  [ACC_ITAU]: 'Itaú',
};

function createInMemoryExpenseRepo(seed: ExpenseListItem[]): {
  repo: ExpenseRepository;
  items: ExpenseListItem[];
} {
  const items = [...seed];
  let seq = seed.length + 1;

  function filterAndSort(filters: NormalizedExpenseFilters): ExpenseListItem[] {
    const qLower = filters.q?.toLowerCase();
    const matched = items.filter((item) => {
      if (qLower && !item.description.toLowerCase().includes(qLower)) return false;
      if (filters.startDate && item.date < filters.startDate) return false;
      if (filters.endDate && item.date > filters.endDate) return false;
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
      if (filters.personId && item.personId !== filters.personId) return false;
      if (filters.bankAccountId && item.bankAccountId !== filters.bankAccountId) return false;
      return true;
    });

    return [...matched].sort((a, b) => {
      switch (filters.sort) {
        case 'date_asc':
          return (
            a.date.localeCompare(b.date) ||
            a.createdAt.getTime() - b.createdAt.getTime()
          );
        case 'amount_desc':
          return (
            b.amountCents - a.amountCents ||
            b.date.localeCompare(a.date)
          );
        case 'amount_asc':
          return (
            a.amountCents - b.amountCents ||
            b.date.localeCompare(a.date)
          );
        case 'date_desc':
        default:
          return (
            b.date.localeCompare(a.date) ||
            b.createdAt.getTime() - a.createdAt.getTime()
          );
      }
    });
  }

  const repo: ExpenseRepository = {
    async listAll() {
      return filterAndSort({ sort: 'date_desc' });
    },
    async listFiltered(filters) {
      return filterAndSort(filters);
    },
    async getMonthlySummaryRaw(startDate, endDate, recentLimit) {
      const monthItems = items.filter(
        (item) => item.date >= startDate && item.date <= endDate
      );
      const totalCents = monthItems.reduce((acc, item) => acc + item.amountCents, 0);
      const expenseCount = monthItems.length;

      const sortedByAmount = [...monthItems].sort(
        (a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date)
      );
      const top = sortedByAmount[0];

      const catMap = new Map<
        string,
        { categoryId: string; categoryName: string; totalCents: number; expenseCount: number }
      >();
      for (const item of monthItems) {
        const prev = catMap.get(item.categoryId);
        if (prev) {
          prev.totalCents += item.amountCents;
          prev.expenseCount += 1;
        } else {
          catMap.set(item.categoryId, {
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            totalCents: item.amountCents,
            expenseCount: 1,
          });
        }
      }

      const recentExpenses = [...monthItems]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.getTime() - a.createdAt.getTime()
        )
        .slice(0, recentLimit);

      return {
        totalCents,
        expenseCount,
        largestExpense: top
          ? {
              id: top.id,
              description: top.description,
              amountCents: top.amountCents,
              date: top.date,
              categoryName: top.categoryName,
              personName: top.personName,
            }
          : null,
        byCategory: Array.from(catMap.values()),
        recentExpenses,
      };
    },
    async findById(id) {
      const found = items.find((item) => item.id === id);
      return found ? { id: found.id, bankAccountId: found.bankAccountId } : null;
    },
    async categoryExists(id) {
      return Boolean(CATEGORY_NAMES[id]);
    },
    async personExists(id) {
      return Boolean(PERSON_NAMES[id]);
    },
    async findBankAccount(id) {
      return ACCOUNT_NAMES[id] ? { id, archived: false } : null;
    },
    async insert(data: ExpenseInput) {
      const id = `44444444-4444-4444-8444-4444444444${String(seq++).padStart(2, '0')}`;
      const now = new Date();
      items.push({
        id,
        description: data.description,
        amountCents: data.amountCents,
        date: data.date,
        categoryId: data.categoryId,
        categoryName: CATEGORY_NAMES[data.categoryId] ?? 'Outra',
        personId: data.personId,
        personName: PERSON_NAMES[data.personId] ?? 'Outro',
        bankAccountId: data.bankAccountId ?? null,
        bankAccountName: data.bankAccountId ? ACCOUNT_NAMES[data.bankAccountId] ?? null : null,
        bankAccountArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    async update(id, data) {
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return false;
      items[idx] = {
        ...items[idx],
        description: data.description,
        amountCents: data.amountCents,
        date: data.date,
        categoryId: data.categoryId,
        categoryName: CATEGORY_NAMES[data.categoryId] ?? 'Outra',
        personId: data.personId,
        personName: PERSON_NAMES[data.personId] ?? 'Outro',
        bankAccountId: data.bankAccountId ?? null,
        bankAccountName: data.bankAccountId ? ACCOUNT_NAMES[data.bankAccountId] ?? null : null,
        updatedAt: new Date(),
      };
      return true;
    },
    async deleteById(id) {
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return false;
      items.splice(idx, 1);
      return true;
    },
  };

  return { repo, items };
}

function makeExpense(
  id: string,
  description: string,
  amountCents: number,
  date: string,
  categoryId: string,
  personId: string,
  bankAccountId: string | null,
  createdOffsetMs = 0
): ExpenseListItem {
  const ts = new Date(1_700_000_000_000 + createdOffsetMs);
  return {
    id,
    description,
    amountCents,
    date,
    categoryId,
    categoryName: CATEGORY_NAMES[categoryId],
    personId,
    personName: PERSON_NAMES[personId],
    bankAccountId,
    bankAccountName: bankAccountId ? ACCOUNT_NAMES[bankAccountId] : null,
    bankAccountArchived: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

const SAMPLE_EXPENSES: ExpenseListItem[] = [
  makeExpense('44444444-4444-4444-8444-444444444401', 'Aluguel Apartamento', 250000, '2026-11-05', CAT_MORADIA, PERSON_ANA, ACC_ITAU, 1000),
  makeExpense('44444444-4444-4444-8444-444444444402', 'Supermercado Extra', 45000, '2026-11-10', CAT_MERCADO, PERSON_CARLOS, ACC_NUBANK, 2000),
  makeExpense('44444444-4444-4444-8444-444444444403', 'Supermercado Atacadão', 55000, '2026-11-18', CAT_MERCADO, PERSON_ANA, ACC_NUBANK, 3000),
  makeExpense('44444444-4444-4444-8444-444444444404', 'Combustível Posto', 20000, '2026-11-22', CAT_TRANSPORTE, PERSON_CARLOS, null, 4000),
  // Mês anterior preservado
  makeExpense('44444444-4444-4444-8444-444444444405', 'Supermercado Outubro', 30000, '2026-10-15', CAT_MERCADO, PERSON_ANA, ACC_NUBANK, 500),
];

describe('P1: Resumo financeiro mensal e agrupamento por categoria', () => {
  it('calcula total, quantidade, média, maior despesa, categorias ordenadas e percentuais do mês', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const summary = await service.getMonthlySummary('2026-11', 6);

    expect(summary.totalCents).toBe(370000); // 2500 + 450 + 550 + 200 = R$ 3.700,00
    expect(summary.expenseCount).toBe(4);
    expect(summary.averageCents).toBe(92500); // 370000 / 4 = R$ 925,00
    expect(summary.largestExpense).toMatchObject({
      description: 'Aluguel Apartamento',
      amountCents: 250000,
    });

    // Categorias sem despesas no mês (Lazer) não aparecem; ordenação descendente por valor
    expect(summary.byCategory).toHaveLength(3);
    expect(summary.byCategory.map((c) => c.categoryName)).toEqual([
      'Moradia',
      'Mercado',
      'Transporte',
    ]);
    expect(summary.byCategory[0]).toMatchObject({
      totalCents: 250000,
      expenseCount: 1,
      percentage: 67.6,
    });
    expect(summary.byCategory[1]).toMatchObject({
      totalCents: 100000,
      expenseCount: 2,
      percentage: 27,
    });
    expect(summary.byCategory[2]).toMatchObject({
      totalCents: 20000,
      expenseCount: 1,
      percentage: 5.4,
    });

    expect(summary.recentExpenses[0].description).toBe('Combustível Posto');
  });

  it('retorna indicadores zerados e listas vazias para mês sem despesas', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const summary = await service.getMonthlySummary('2026-12', 6);

    expect(summary.totalCents).toBe(0);
    expect(summary.expenseCount).toBe(0);
    expect(summary.averageCents).toBe(0);
    expect(summary.largestExpense).toBeNull();
    expect(summary.byCategory).toEqual([]);
    expect(summary.recentExpenses).toEqual([]);
  });

  it('exclui categorias zeradas e arredonda percentuais corretamente em buildMonthlySummary', () => {
    const result = buildMonthlySummary('2026-11', '2026-11-01', '2026-11-30', {
      totalCents: 10000,
      expenseCount: 3,
      largestExpense: null,
      byCategory: [
        { categoryId: CAT_LAZER, categoryName: 'Lazer', totalCents: 0, expenseCount: 0 },
        { categoryId: CAT_TRANSPORTE, categoryName: 'Transporte', totalCents: 3333, expenseCount: 1 },
        { categoryId: CAT_MERCADO, categoryName: 'Mercado', totalCents: 6667, expenseCount: 2 },
      ],
      recentExpenses: [],
    });

    expect(result.averageCents).toBe(3333);
    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory[0].categoryName).toBe('Mercado');
    expect(result.byCategory[0].percentage).toBe(66.7);
    expect(result.byCategory[1].percentage).toBe(33.3);
  });
});

describe('P1: Pesquisa textual, filtros combinados, ordenação e integridade', () => {
  it('pesquisa parcialmente sem diferenciar maiúsculas/minúsculas e remove espaços extras', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const result = await service.listFiltered({ q: '  sUpErMeRcAdO  ' });
    expect(result.filteredCount).toBe(3);
    expect(result.filteredTotalCents).toBe(130000);
  });

  it('filtra por data inicial, data final, categoria, responsável e conta bancária separadamente e combinados', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const byStart = await service.listFiltered({ startDate: '2026-11-15' });
    expect(byStart.filteredCount).toBe(2);

    const byEnd = await service.listFiltered({ endDate: '2026-10-31' });
    expect(byEnd.filteredCount).toBe(1);
    expect(byEnd.items[0].description).toBe('Supermercado Outubro');

    const byCategory = await service.listFiltered({ categoryId: CAT_MERCADO });
    expect(byCategory.filteredCount).toBe(3);

    const byPerson = await service.listFiltered({ personId: PERSON_CARLOS });
    expect(byPerson.filteredCount).toBe(2);
    expect(byPerson.filteredTotalCents).toBe(65000);

    const byAccount = await service.listFiltered({ bankAccountId: ACC_ITAU });
    expect(byAccount.filteredCount).toBe(1);
    expect(byAccount.items[0].description).toBe('Aluguel Apartamento');

    const combined = await service.listFiltered({
      q: 'supermercado',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      categoryId: CAT_MERCADO,
      personId: PERSON_ANA,
      bankAccountId: ACC_NUBANK,
    });
    expect(combined.filteredCount).toBe(1);
    expect(combined.filteredTotalCents).toBe(55000);
    expect(combined.items[0].description).toBe('Supermercado Atacadão');
  });

  it('ordena corretamente por data e valor e trata ausência de resultados e filtros inválidos', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const oldestFirst = await service.listFiltered({ sort: 'date_asc' });
    expect(oldestFirst.items[0].date).toBe('2026-10-15');

    const highestFirst = await service.listFiltered({ sort: 'amount_desc' });
    expect(highestFirst.items[0].amountCents).toBe(250000);
    expect(highestFirst.items[highestFirst.items.length - 1].amountCents).toBe(20000);

    const lowestFirst = await service.listFiltered({ sort: 'amount_asc' });
    expect(lowestFirst.items[0].amountCents).toBe(20000);

    const empty = await service.listFiltered({ q: 'inexistente-xyz' });
    expect(empty.items).toEqual([]);
    expect(empty.filteredCount).toBe(0);
    expect(empty.filteredTotalCents).toBe(0);

    await expect(
      service.listFiltered({ startDate: '2026-11-20', endDate: '2026-11-01' })
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });

    await expect(
      service.listFiltered({ categoryId: 'nao-e-uuid' })
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });
  });

  it('atualiza o resumo mensal e os resultados filtrados após criação, edição e exclusão mantendo dados antigos intactos', async () => {
    const { repo } = createInMemoryExpenseRepo(SAMPLE_EXPENSES);
    const service = createExpenseService(repo);

    const created = await service.create({
      description: 'Farmácia Bairro',
      amountCents: 10000,
      date: '2026-11-25',
      categoryId: CAT_LAZER,
      personId: PERSON_ANA,
      bankAccountId: ACC_NUBANK,
    });

    let summary = await service.getMonthlySummary('2026-11', 6);
    expect(summary.totalCents).toBe(380000);
    expect(summary.expenseCount).toBe(5);
    expect(summary.byCategory).toHaveLength(4);

    await service.update(created.id, {
      description: 'Farmácia Bairro',
      amountCents: 15000,
      date: '2026-11-25',
      categoryId: CAT_LAZER,
      personId: PERSON_ANA,
      bankAccountId: ACC_NUBANK,
    });

    summary = await service.getMonthlySummary('2026-11', 6);
    expect(summary.totalCents).toBe(385000);

    await service.remove(created.id);
    summary = await service.getMonthlySummary('2026-11', 6);
    expect(summary.totalCents).toBe(370000);
    expect(summary.expenseCount).toBe(4);

    // Despesa antiga de outubro continua intacta
    const octSummary = await service.getMonthlySummary('2026-10', 6);
    expect(octSummary.totalCents).toBe(30000);
    expect(octSummary.expenseCount).toBe(1);
  });
});
