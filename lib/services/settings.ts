import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { financialSettings } from '@/db/schema';
import { financialSettingsSchema } from '@/lib/domain/schemas';
import { ServiceError, translateDbError } from './errors';

export const DEFAULT_CYCLE_START_DAY = 1;
const SETTINGS_SINGLETON_ID = 1;

export interface FinancialSettingsData {
  cycleStartDay: number;
  updatedAt: Date | null;
}

export interface SettingsRepository {
  getSingleton(): Promise<FinancialSettingsData | null>;
  upsertCycleStartDay(cycleStartDay: number): Promise<FinancialSettingsData>;
}

const drizzleSettingsRepo: SettingsRepository = {
  async getSingleton() {
    const db = getDb();
    const [row] = await db
      .select({
        cycleStartDay: financialSettings.cycleStartDay,
        updatedAt: financialSettings.updatedAt,
      })
      .from(financialSettings)
      .where(eq(financialSettings.id, SETTINGS_SINGLETON_ID))
      .limit(1);

    return row ?? null;
  },

  async upsertCycleStartDay(cycleStartDay) {
    const db = getDb();
    const now = new Date();
    const [saved] = await db
      .insert(financialSettings)
      .values({
        id: SETTINGS_SINGLETON_ID,
        cycleStartDay,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: financialSettings.id,
        set: {
          cycleStartDay,
          updatedAt: now,
        },
      })
      .returning({
        cycleStartDay: financialSettings.cycleStartDay,
        updatedAt: financialSettings.updatedAt,
      });

    return saved;
  },
};

export function createSettingsService(repo: SettingsRepository = drizzleSettingsRepo) {
  return {
    async getFinancialSettings(): Promise<FinancialSettingsData> {
      try {
        const existing = await repo.getSingleton();
        if (!existing) {
          return {
            cycleStartDay: DEFAULT_CYCLE_START_DAY,
            updatedAt: null,
          };
        }
        return existing;
      } catch (error) {
        console.error('Erro ao carregar configurações financeiras:', error);
        throw translateDbError(
          error,
          'Não foi possível carregar as configurações financeiras.'
        );
      }
    },

    async updateCycleStartDay(input: unknown): Promise<FinancialSettingsData> {
      const parsed = financialSettingsSchema.safeParse(input);
      if (!parsed.success) {
        throw new ServiceError(
          'VALIDATION',
          parsed.error.issues[0]?.message ??
            'Informe um dia de início do ciclo entre 1 e 28.',
          400
        );
      }

      try {
        return await repo.upsertCycleStartDay(parsed.data.cycleStartDay);
      } catch (error) {
        console.error('Erro ao salvar configurações financeiras:', error);
        throw translateDbError(
          error,
          'Não foi possível salvar o dia de início do ciclo financeiro.'
        );
      }
    },
  };
}

export const settingsService = createSettingsService();
