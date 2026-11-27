CREATE TABLE "financial_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"cycle_start_day" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_settings_singleton_id_check" CHECK ("financial_settings"."id" = 1),
	CONSTRAINT "financial_settings_cycle_start_day_check" CHECK ("financial_settings"."cycle_start_day" >= 1 AND "financial_settings"."cycle_start_day" <= 28)
);--> statement-breakpoint
INSERT INTO "financial_settings" ("id", "cycle_start_day") VALUES (1, 1) ON CONFLICT ("id") DO NOTHING;
