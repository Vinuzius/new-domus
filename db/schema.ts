import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  institution: text('institution'),
  initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('expenses_date_idx').on(table.date),
    index('expenses_category_id_idx').on(table.categoryId),
    index('expenses_person_id_idx').on(table.personId),
    index('expenses_bank_account_id_idx').on(table.bankAccountId),
  ]
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  expenses: many(expenses),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  expenses: many(expenses),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
  person: one(people, {
    fields: [expenses.personId],
    references: [people.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [expenses.bankAccountId],
    references: [bankAccounts.id],
  }),
}));

export type CategoryRow = typeof categories.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type BankAccountRow = typeof bankAccounts.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;
