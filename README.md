# Domus Finance (v0)

Aplicação web pessoal em **pt-BR** para organização financeira doméstica, com persistência centralizada em **PostgreSQL (Supabase)** via **Drizzle ORM** e acesso protegido por senha compartilhada.

---

## Stack da v0

- **Frontend e Backend:** Next.js (App Router), React e TypeScript
- **Estilização:** Tailwind CSS v4
- **Banco de dados:** PostgreSQL gerenciado no Supabase
- **ORM e Migrações:** Drizzle ORM + Drizzle Kit
- **Driver:** `postgres` (`postgres.js`), executado exclusivamente no servidor
- **Validação:** Zod
- **Testes:** Vitest
- **Gerenciador de pacotes:** `pnpm`

---

## Escopo implementado na v0 (P0)

- Barreira de acesso por senha compartilhada (`APP_ACCESS_PASSWORD`) com cookie assinado (`HttpOnly`, `SameSite=Lax`/`None` conforme contexto HTTPS, expiração de 7 dias) e limitador de tentativas no servidor.
- Logout e validação obrigatória de sessão no servidor em páginas protegidas, Server Actions e Route Handlers.
- CRUD de **Categorias**, com bloqueio de exclusão quando houver despesas vinculadas.
- CRUD de **Pessoas / Responsáveis**, com bloqueio de exclusão quando houver despesas vinculadas.
- CRUD de **Contas Bancárias**, com instituição opcional, saldo inicial informativo em centavos inteiros e opção de **arquivamento / reativação**.
- CRUD de **Despesas**, exigindo categoria e responsável, permitindo conta bancária opcional, gravando valores em centavos inteiros (`BRL`) e preservando a data civil (`YYYY-MM-DD`) sem deslocamento de fuso horário.

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (não versione segredos):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão PostgreSQL do Supabase (use o **Transaction Pooler** em produção serverless). |
| `APP_ACCESS_PASSWORD` | Sim | Senha compartilhada para login na aplicação. Validada apenas no servidor. |
| `APP_SESSION_SECRET` | Sim em produção | Segredo usado para assinar o cookie de sessão com HMAC-SHA256 (mínimo recomendado: 32 caracteres). |

> Nunca adicione o prefixo `NEXT_PUBLIC_` a nenhuma dessas variáveis.

---

## Configuração e execução local

1. **Instalar dependências com `pnpm`:**

   ```bash
   pnpm install
   ```

2. **Configurar `.env.local`:**

   Preencha `DATABASE_URL`, `APP_ACCESS_PASSWORD` e `APP_SESSION_SECRET`.

3. **Aplicar migrações no PostgreSQL:**

   As migrações versionadas ficam em `drizzle/`. Para aplicá-las no banco configurado em `DATABASE_URL`:

   ```bash
   pnpm db:migrate
   ```

   Caso altere `db/schema.ts` futuramente, gere uma nova migração antes de aplicar:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Executar em desenvolvimento:**

   ```bash
   pnpm dev
   ```

   Acesse `http://localhost:3000`.

5. **Executar lint, build e testes:**

   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```

---

## Deploy inicial (Vercel + Supabase)

1. Crie um projeto PostgreSQL no **Supabase** e copie a string de conexão do **Connection Pooler** (modo *Transaction*, porta `6543`) para `DATABASE_URL`. O cliente `postgres.js` em `db/index.ts` já utiliza `prepare: false`.
2. Execute `DATABASE_URL="..." pnpm db:migrate` localmente ou em etapa de release para criar as tabelas no Supabase.
3. Conecte o repositório na **Vercel**, configure as variáveis de ambiente (`DATABASE_URL`, `APP_ACCESS_PASSWORD`, `APP_SESSION_SECRET`) e habilite `pnpm` como gerenciador de build.
4. Após o deploy, acesse a URL publicada em dois dispositivos (ex.: computador e celular), faça login com a senha compartilhada e valide a persistência dos cadastros após recarregar a página.

---

## Limitações conhecidas da v0

- **Senha compartilhada única:** qualquer pessoa que conheça `APP_ACCESS_PASSWORD` acessa exatamente os mesmos dados. Não há perfis individuais, login Google ou controle por papéis nesta versão.
- **Saldo inicial informativo:** o campo `initialBalanceCents` das contas bancárias não é recalculado automaticamente ao registrar ou excluir despesas.
- **Rate limiting em memória:** o limitador de tentativas de login protege cada instância em execução; em ambiente serverless multi-instância, atua por instância ativa.
