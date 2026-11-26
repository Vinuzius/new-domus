import { describe, expect, it } from 'vitest';
import { resolveDefaultPersonId } from '@/lib/domain/people';
import { createBankAccountService } from '@/lib/services/bank-accounts';
import { createCategoryService } from '@/lib/services/categories';
import { ServiceError } from '@/lib/services/errors';
import { createExpenseService } from '@/lib/services/expenses';
import { createPersonService, type PersonRepository } from '@/lib/services/people';

const CAT_1 = '11111111-1111-4111-8111-111111111111';
const CAT_2 = '11111111-1111-4111-8111-111111111112';
const PERSON_1 = '22222222-2222-4222-8222-222222222221';
const PERSON_2 = '22222222-2222-4222-8222-222222222222';
const PERSON_3 = '22222222-2222-4222-8222-222222222223';
const PERSON_MISSING = '22222222-2222-4222-8222-222222222299';
const ACC_ACTIVE = '33333333-3333-4333-8333-333333333331';
const ACC_ARCHIVED = '33333333-3333-4333-8333-333333333332';
const EXP_1 = '44444444-4444-4444-8444-444444444441';

function createInMemoryPersonRepo(
  initial: Array<{ id: string; name: string; isDefault?: boolean; linkedCount?: number }>
): {
  repo: PersonRepository;
  store: Map<string, { id: string; name: string; isDefault: boolean; linkedCount: number }>;
} {
  const store = new Map(
    initial.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name,
        isDefault: Boolean(item.isDefault),
        linkedCount: item.linkedCount ?? 0,
      },
    ])
  );

  const repo: PersonRepository = {
    async listWithUsage() {
      return Array.from(store.values()).map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        expenseCount: p.linkedCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    },
    async findById(id) {
      const found = store.get(id);
      return found ? { id: found.id, name: found.name, isDefault: found.isDefault } : null;
    },
    async findByNameCaseInsensitive(name) {
      const found = Array.from(store.values()).find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      return found ? { id: found.id, name: found.name } : null;
    },
    async countLinkedExpenses(id) {
      return store.get(id)?.linkedCount ?? 0;
    },
    async insert(name) {
      const id = PERSON_3;
      const created = { id, name, isDefault: false, linkedCount: 0 };
      store.set(id, created);
      return {
        id,
        name,
        isDefault: false,
        expenseCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async updateName(id, name) {
      const found = store.get(id);
      if (!found) return null;
      found.name = name;
      return {
        id: found.id,
        name: found.name,
        isDefault: found.isDefault,
        expenseCount: found.linkedCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async setDefault(id, isDefault) {
      const target = store.get(id);
      if (!target) return null;

      if (isDefault) {
        for (const item of store.values()) {
          item.isDefault = false;
        }
      }
      target.isDefault = isDefault;

      return {
        id: target.id,
        name: target.name,
        isDefault: target.isDefault,
        expenseCount: target.linkedCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async deleteById(id) {
      return store.delete(id);
    },
  };

  return { repo, store };
}

describe('Regras de integridade referencial e domínio', () => {
  it('bloqueia exclusão de categoria com despesas vinculadas e permite quando livre', async () => {
    const categoriesStore = new Map<string, { id: string; name: string }>([
      [CAT_1, { id: CAT_1, name: 'Moradia' }],
      [CAT_2, { id: CAT_2, name: 'Lazer' }],
    ]);
    const linkedCounts = new Map<string, number>([
      [CAT_1, 2],
      [CAT_2, 0],
    ]);

    const service = createCategoryService({
      async listWithUsage() {
        return Array.from(categoriesStore.values()).map((c) => ({
          ...c,
          expenseCount: linkedCounts.get(c.id) ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      },
      async findById(id) {
        return categoriesStore.get(id) ?? null;
      },
      async findByNameCaseInsensitive(name) {
        return (
          Array.from(categoriesStore.values()).find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          ) ?? null
        );
      },
      async countLinkedExpenses(id) {
        return linkedCounts.get(id) ?? 0;
      },
      async insert(name) {
        const created = {
          id: '11111111-1111-4111-8111-111111111199',
          name,
          expenseCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        categoriesStore.set(created.id, { id: created.id, name: created.name });
        return created;
      },
      async updateName(id, name) {
        const found = categoriesStore.get(id);
        if (!found) return null;
        found.name = name;
        return {
          ...found,
          expenseCount: linkedCounts.get(id) ?? 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async deleteById(id) {
        return categoriesStore.delete(id);
      },
    });

    await expect(service.remove(CAT_1)).rejects.toMatchObject({
      code: 'FORBIDDEN_DELETE',
    });

    await expect(service.remove(CAT_2)).resolves.toBeUndefined();
    expect(categoriesStore.has(CAT_2)).toBe(false);
  });

  it('bloqueia exclusão de responsável com despesas vinculadas', async () => {
    const { repo } = createInMemoryPersonRepo([
      { id: PERSON_1, name: 'Carlos', isDefault: true, linkedCount: 1 },
    ]);
    const service = createPersonService(repo);

    await expect(service.remove(PERSON_1)).rejects.toBeInstanceOf(ServiceError);
    await expect(service.remove(PERSON_1)).rejects.toMatchObject({
      code: 'FORBIDDEN_DELETE',
    });
  });

  it('gerencia responsável padrão: exclusividade única, desmarcação, erro para inexistente e limpeza ao excluir', async () => {
    const { repo, store } = createInMemoryPersonRepo([
      { id: PERSON_1, name: 'Ana', isDefault: false, linkedCount: 0 },
      { id: PERSON_2, name: 'Eu', isDefault: false, linkedCount: 0 },
      { id: PERSON_3, name: 'Carlos', isDefault: false, linkedCount: 2 },
    ]);
    const service = createPersonService(repo);

    // 1. Selecionar Ana como padrão
    const anaDefault = await service.setDefault(PERSON_1, { isDefault: true });
    expect(anaDefault.isDefault).toBe(true);
    expect(store.get(PERSON_1)?.isDefault).toBe(true);
    expect(store.get(PERSON_2)?.isDefault).toBe(false);

    // 2. Selecionar Eu como padrão deve desmarcar Ana automaticamente
    const euDefault = await service.setDefault(PERSON_2, { isDefault: true });
    expect(euDefault.isDefault).toBe(true);
    expect(store.get(PERSON_1)?.isDefault).toBe(false);
    expect(store.get(PERSON_2)?.isDefault).toBe(true);

    // 3. Desmarcar Eu deixa sistema sem responsável padrão
    const euUnchecked = await service.setDefault(PERSON_2, { isDefault: false });
    expect(euUnchecked.isDefault).toBe(false);
    expect(Array.from(store.values()).some((p) => p.isDefault)).toBe(false);

    // 4. Rejeita pessoa inexistente e payload inválido
    await expect(
      service.setDefault(PERSON_MISSING, { isDefault: true })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(
      service.setDefault('id-invalido', { isDefault: true })
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });
    await expect(
      service.setDefault(PERSON_1, { isDefault: 'sim' })
    ).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });

    // 5. Excluir pessoa padrão sem despesas remove a configuração automaticamente
    await service.setDefault(PERSON_1, { isDefault: true });
    await expect(service.remove(PERSON_1)).resolves.toBeUndefined();
    expect(store.has(PERSON_1)).toBe(false);
    expect(Array.from(store.values()).some((p) => p.isDefault)).toBe(false);

    // 6. Pessoa padrão com despesas vinculadas continua bloqueada para exclusão
    await service.setDefault(PERSON_3, { isDefault: true });
    await expect(service.remove(PERSON_3)).rejects.toMatchObject({
      code: 'FORBIDDEN_DELETE',
    });
    expect(store.get(PERSON_3)?.isDefault).toBe(true);
  });

  it('pré-seleciona responsável padrão ao criar despesa e faz fallback para primeira pessoa quando não houver padrão', () => {
    expect(
      resolveDefaultPersonId([
        { id: PERSON_1, isDefault: false },
        { id: PERSON_2, isDefault: true },
        { id: PERSON_3, isDefault: false },
      ])
    ).toBe(PERSON_2);

    expect(
      resolveDefaultPersonId([
        { id: PERSON_1, isDefault: false },
        { id: PERSON_2, isDefault: false },
      ])
    ).toBe(PERSON_1);

    expect(resolveDefaultPersonId([])).toBe('');
  });

  it('permite arquivar e reativar conta bancária sem afetar despesas', async () => {
    let archivedState = false;
    const service = createBankAccountService({
      async listWithUsage() {
        return [];
      },
      async findById(id) {
        return id === ACC_ACTIVE
          ? { id: ACC_ACTIVE, name: 'Conta Principal', archived: archivedState }
          : null;
      },
      async countLinkedExpenses() {
        return 3;
      },
      async insert(data) {
        return {
          id: ACC_ACTIVE,
          ...data,
          archived: false,
          expenseCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async update() {
        return null;
      },
      async setArchived(id, archived) {
        archivedState = archived;
        return {
          id,
          name: 'Conta Principal',
          institution: 'Banco X',
          initialBalanceCents: 100000,
          archived,
          expenseCount: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    });

    const archived = await service.setArchived(ACC_ACTIVE, true);
    expect(archived.archived).toBe(true);
    expect(archived.expenseCount).toBe(3);

    const reactivated = await service.setArchived(ACC_ACTIVE, false);
    expect(reactivated.archived).toBe(false);
  });

  it('exige categoria e pessoa válidas, permite despesa sem conta e bloqueia nova despesa em conta arquivada', async () => {
    const inserted: Array<{ bankAccountId: string | null }> = [];
    const service = createExpenseService({
      async listAll() {
        return [];
      },
      async listFiltered() {
        return [];
      },
      async getMonthlySummaryRaw() {
        return {
          totalCents: 0,
          expenseCount: 0,
          largestExpense: null,
          byCategory: [],
          recentExpenses: [],
        };
      },
      async findById(id) {
        return id === EXP_1 ? { id: EXP_1, bankAccountId: ACC_ARCHIVED } : null;
      },
      async categoryExists(id) {
        return id === CAT_1;
      },
      async personExists(id) {
        return id === PERSON_1;
      },
      async findBankAccount(id) {
        if (id === ACC_ACTIVE) return { id: ACC_ACTIVE, archived: false };
        if (id === ACC_ARCHIVED) return { id: ACC_ARCHIVED, archived: true };
        return null;
      },
      async insert(data) {
        inserted.push({ bankAccountId: data.bankAccountId });
        return EXP_1;
      },
      async update() {
        return true;
      },
      async deleteById() {
        return true;
      },
    });

    // Sem conta bancária (opcional) deve funcionar
    const createdNoAccount = await service.create({
      description: 'Padaria',
      amountCents: 2450,
      date: '2026-11-26',
      categoryId: CAT_1,
      personId: PERSON_1,
      bankAccountId: null,
    });
    expect(createdNoAccount.id).toBe(EXP_1);
    expect(inserted[0].bankAccountId).toBeNull();

    // Nova despesa em conta arquivada deve falhar
    await expect(
      service.create({
        description: 'Mercado',
        amountCents: 9900,
        date: '2026-11-26',
        categoryId: CAT_1,
        personId: PERSON_1,
        bankAccountId: ACC_ARCHIVED,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    // Editar despesa que já pertencia à conta arquivada mantendo a mesma conta deve funcionar
    await expect(
      service.update(EXP_1, {
        description: 'Mercado atualizado',
        amountCents: 9900,
        date: '2026-11-26',
        categoryId: CAT_1,
        personId: PERSON_1,
        bankAccountId: ACC_ARCHIVED,
      })
    ).resolves.toEqual({ id: EXP_1 });
  });
});
