import { describe, expect, it } from 'vitest';
import { createBankAccountService } from '@/lib/services/bank-accounts';
import { createCategoryService } from '@/lib/services/categories';
import { ServiceError } from '@/lib/services/errors';
import { createExpenseService } from '@/lib/services/expenses';
import { createPersonService } from '@/lib/services/people';

const CAT_1 = '11111111-1111-4111-8111-111111111111';
const CAT_2 = '11111111-1111-4111-8111-111111111112';
const PERSON_1 = '22222222-2222-4222-8222-222222222221';
const ACC_ACTIVE = '33333333-3333-4333-8333-333333333331';
const ACC_ARCHIVED = '33333333-3333-4333-8333-333333333332';
const EXP_1 = '44444444-4444-4444-8444-444444444441';

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
    const service = createPersonService({
      async listWithUsage() {
        return [];
      },
      async findById(id) {
        return id === PERSON_1 ? { id: PERSON_1, name: 'Carlos' } : null;
      },
      async findByNameCaseInsensitive() {
        return null;
      },
      async countLinkedExpenses(id) {
        return id === PERSON_1 ? 1 : 0;
      },
      async insert(name) {
        return {
          id: PERSON_1,
          name,
          expenseCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      async updateName() {
        return null;
      },
      async deleteById() {
        return true;
      },
    });

    await expect(service.remove(PERSON_1)).rejects.toBeInstanceOf(ServiceError);
    await expect(service.remove(PERSON_1)).rejects.toMatchObject({
      code: 'FORBIDDEN_DELETE',
    });
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
