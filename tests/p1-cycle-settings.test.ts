import { describe, expect, it } from 'vitest';
import { getCurrentFinancialCycle, getFinancialCycleRange } from '@/lib/domain/dates';
import type { ExpenseInput } from '@/lib/domain/schemas';
import {
  createExpenseService,
  type ExpenseListItem,
  type ExpenseRepository,
  type NormalizedExpenseFilters,
} from '@/lib/services/expenses';
import {
  createSettingsService,
  type FinancialSettingsData,
  type SettingsRepository,
} from '@/lib/services/settings';

const CAT_MERCADO = '11111111-1111-4111-8111-111111111111';
const CAT_MORADIA = '11111111-1111-4111-8111-111111111112';
const CAT_LAZER = '11111111-1111-4111-8111-111111111113';
const PERSON_ANA = '22222222-2222-4222-8222-222222222221';
const ACC_NUBANK = '33333333-3333-4333-8333-333333333331';

const CATEGORY_NAMES: Record<string, string> = {
  [CAT_MERCADO]: 'Mercado',
  [CAT_MORADIA]: 'Moradia',
  [CAT_LAZER]: 'Lazer',
};

function createInMemorySettingsRepo(initialDay?: number): SettingsRepository {
  let row: FinancialSettingsData | null =
    initialDay === undefined
      ? null
      : { cycleStartDay: initialDay, updatedAt: new Date() };

  return {
    async getSingleton() {
      return row ? { ...row } : null;
    },
    async upsertCycleStartDay(cycleStartDay) {
      row = { cycleStartDay, updatedAt: new Date() };
      return { ...row };
    },
  };
}

function createInMemoryExpenseRepo(seed: ExpenseListItem[]): ExpenseRepository {
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

    return [...matched].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  return {
    async listAll() {
      return filterAndSort({ sort: 'date_desc' });
    },
    async listFiltered(filters) {
      return filterAndSort(filters);
    },
    async getMonthlySummaryRaw(startDate, endDate, recentLimit) {
      const periodItems = items.filter(
        (item) => item.date >= startDate && item.date <= endDate
      );
      const totalCents = periodItems.reduce((acc, item) => acc + item.amountCents, 0);
      const expenseCount = periodItems.length;
      const sortedByAmount = [...periodItems].sort(
        (a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date)
      );
      const top = sortedByAmount[0];

      const catMap = new Map<
        string,
        { categoryId: string; categoryName: string; totalCents: number; expenseCount: number }
      >();
      for (const item of periodItems) {
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

      const recentExpenses = [...periodItems]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime()
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
      return id === PERSON_ANA;
    },
    async findBankAccount(id) {
      return id === ACC_NUBANK ? { id, archived: false } : null;
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
        personName: 'Ana',
        bankAccountId: data.bankAccountId ?? null,
        bankAccountName: data.bankAccountId ? 'Nubank' : null,
        bankAccountArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    async update() {
      return false;
    },
    async deleteById() {
      return false;
    },
  };
}

function makeExpense(
  id: string,
  description: string,
  amountCents: number,
  date: string,
  categoryId: string,
  offsetMs = 0
): ExpenseListItem {
  const ts = new Date(1_700_000_000_000 + offsetMs);
  return {
    id,
    description,
    amountCents,
    date,
    categoryId,
    categoryName: CATEGORY_NAMES[categoryId],
    personId: PERSON_ANA,
    personName: 'Ana',
    bankAccountId: ACC_NUBANK,
    bankAccountName: 'Nubank',
    bankAccountArchived: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('Configuração do ciclo financeiro (settingsService)', () => {
  it('retorna dia padrão 1 quando ainda não há registro salvo e persiste alterações entre consultas', async () => {
    const repo = createInMemorySettingsRepo();
    const serviceA = createSettingsService(repo);
    const serviceB = createSettingsService(repo);

    const initial = await serviceA.getFinancialSettings();
    expect(initial.cycleStartDay).toBe(1);

    const updated = await serviceA.updateCycleStartDay({ cycleStartDay: 4 });
    expect(updated.cycleStartDay).toBe(4);

    // Nova leitura (simulando outra requisição/dispositivo) preserva o valor persistido
    const persisted = await serviceB.getFinancialSettings();
    expect(persisted.cycleStartDay).toBe(4);

    const boundary28 = await serviceB.updateCycleStartDay({ cycleStartDay: 28 });
    expect(boundary28.cycleStartDay).toBe(28);
  });

  it('rejeita dias menores que 1, maiores que 28 ou não inteiros', async () => {
    const service = createSettingsService(createInMemorySettingsRepo(1));

    await expect(service.updateCycleStartDay({ cycleStartDay: 0 })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
    await expect(service.updateCycleStartDay({ cycleStartDay: -4 })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
    await expect(service.updateCycleStartDay({ cycleStartDay: 29 })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
    await expect(service.updateCycleStartDay({ cycleStartDay: 4.5 })).rejects.toMatchObject({
      code: 'VALIDATION',
      status: 400,
    });
  });
});

describe('Resumo financeiro, filtros de período e integração com ciclo personalizado', () => {
  const CYCLE_EXPENSES: ExpenseListItem[] = [
    // Fora do ciclo 04/11..03/12 (pertence ao ciclo anterior)
    makeExpense('44444444-4444-4444-8444-444444444401', 'Padaria 03/11', 3500, '2026-11-03', CAT_MERCADO, 100),
    // Primeiro dia do ciclo 04/11..03/12
    makeExpense('44444444-4444-4444-8444-444444444402', 'Aluguel 04/11', 200000, '2026-11-04', CAT_MORADIA, 200),
    // Meio do ciclo em novembro
    makeExpense('44444444-4444-4444-8444-444444444403', 'Mercado 18/11', 45000, '2026-11-18', CAT_MERCADO, 300),
    // Mês seguinte (dezembro) ainda dentro do ciclo de novembro (02/12)
    makeExpense('44444444-4444-4444-8444-444444444404', 'Cinema 02/12', 15000, '2026-12-02', CAT_LAZER, 400),
    // Último dia inclusivo do ciclo 04/11..03/12
    makeExpense('44444444-4444-4444-8444-444444444405', 'Mercado 03/12', 40000, '2026-12-03', CAT_MERCADO, 500),
    // Dia seguinte ao encerramento (pertence ao próximo ciclo 04/12..03/01)
    makeExpense('44444444-4444-4444-8444-444444444406', 'Aluguel 04/12', 200000, '2026-12-04', CAT_MORADIA, 600),
  ];

  it('agrupa despesas nos limites exatos do ciclo (primeiro dia, último dia, mês seguinte dentro do ciclo e próximo ciclo)', async () => {
    const settingsService = createSettingsService(createInMemorySettingsRepo(4));
    const expenseService = createExpenseService(createInMemoryExpenseRepo(CYCLE_EXPENSES));

    const settings = await settingsService.getFinancialSettings();
    const novCycle = getCurrentFinancialCycle(settings.cycleStartDay, '2026-12-02');
    expect(novCycle.startDate).toBe('2026-11-04');
    expect(novCycle.endDate).toBe('2026-12-03');

    const summaryNov = await expenseService.getCycleSummary(
      novCycle.anchorYearMonth,
      settings.cycleStartDay,
      6
    );

    expect(summaryNov.startDate).toBe('2026-11-04');
    expect(summaryNov.endDate).toBe('2026-12-03');
    expect(summaryNov.periodLabel).toBe('04/11/2026 — 03/12/2026');
    // 200000 + 45000 + 15000 + 40000 = 300000 (R$ 3.000,00)
    expect(summaryNov.totalCents).toBe(300000);
    expect(summaryNov.expenseCount).toBe(4);
    expect(summaryNov.averageCents).toBe(75000);
    expect(summaryNov.largestExpense?.description).toBe('Aluguel 04/11');
    expect(summaryNov.byCategory.map((c) => c.categoryName)).toEqual([
      'Moradia',
      'Mercado',
      'Lazer',
    ]);
    expect(summaryNov.byCategory[1]).toMatchObject({
      totalCents: 85000,
      expenseCount: 2,
      percentage: 28.3,
    });

    // Próximo ciclo (04/12/2026 — 03/01/2027) pega apenas a despesa de 04/12
    const decCycle = getFinancialCycleRange('2026-12', settings.cycleStartDay);
    const summaryDec = await expenseService.getCycleSummary(
      decCycle.anchorYearMonth,
      settings.cycleStartDay,
      6
    );
    expect(summaryDec.totalCents).toBe(200000);
    expect(summaryDec.expenseCount).toBe(1);
    expect(summaryDec.recentExpenses[0].description).toBe('Aluguel 04/12');
  });

  it('preserva filtro de categoria com período do ciclo, seleção manual de datas, limpeza e rejeição de intervalo inválido', async () => {
    const expenseService = createExpenseService(createInMemoryExpenseRepo(CYCLE_EXPENSES));

    // Simula clique em "Mercado" dentro do ciclo 04/11..03/12
    const categoryFromCycle = await expenseService.listFiltered({
      categoryId: CAT_MERCADO,
      startDate: '2026-11-04',
      endDate: '2026-12-03',
    });
    expect(categoryFromCycle.filteredCount).toBe(2);
    expect(categoryFromCycle.filteredTotalCents).toBe(85000);
    expect(categoryFromCycle.items.map((i) => i.description)).toEqual([
      'Mercado 03/12',
      'Mercado 18/11',
    ]);

    // Seleção manual de período arbitrário preservada
    const manualRange = await expenseService.listFiltered({
      startDate: '2026-11-01',
      endDate: '2026-11-18',
    });
    expect(manualRange.filteredCount).toBe(3);

    // Limpeza de datas retorna todos os lançamentos
    const cleared = await expenseService.listFiltered({});
    expect(cleared.filteredCount).toBe(6);

    // Intervalo inválido (data inicial posterior à data final)
    await expect(
      expenseService.listFiltered({
        startDate: '2026-12-04',
        endDate: '2026-11-04',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });
  });
});
