# AGENTS.md --- Domus Finance

## 1. Objetivo do projeto

O Domus Finance é uma aplicação web pessoal para organização financeira.
O desenvolvimento será reiniciado do zero, com entregas pequenas e
verificáveis. A prioridade é entregar uma versão inicial utilizável
(v0), não construir antecipadamente uma plataforma financeira complexa.

Este arquivo orienta o Google AI Studio durante a implementação. Em caso
de conflito entre uma solicitação pontual e este documento, preserve a
arquitetura e os requisitos explícitos mais recentes do usuário;
explique conflitos antes de tomar decisões irreversíveis.

## 2. Princípios obrigatórios

-   Desenvolver em etapas pequenas, mantendo a aplicação executável.
-   Priorizar simplicidade, legibilidade, manutenção e funcionamento
    real.
-   Não implementar funcionalidades futuras antes da v0 estar concluída
    e validada.
-   Não inventar requisitos nem ampliar o escopo sem autorização.
-   Não substituir tecnologias ou bibliotecas definidas sem explicar o
    motivo e pedir aprovação.
-   Não afirmar que algo foi testado, executado, publicado ou corrigido
    sem realmente ter sido.
-   Antes de alterar arquivos existentes, inspecionar a estrutura e
    entender o código.
-   Evitar abstrações, camadas e padrões que não tragam benefício
    concreto para este projeto.
-   Não criar microserviços, filas, CQRS, event sourcing ou arquitetura
    distribuída.

## 3. Stack definida para a v0

-   Next.js com App Router.
-   React e TypeScript.
-   PostgreSQL gerenciado no Supabase.
-   Hospedagem da aplicação na Vercel.
-   Drizzle ORM e Drizzle Kit para acesso e migrações.
-   Driver `postgres` (Postgres.js), executado somente no servidor.
-   pnpm como gerenciador de pacotes; manter `pnpm-lock.yaml`.
-   Interface em português do Brasil (`pt-BR`).
-   Valores monetários exibidos em Real brasileiro (BRL).

Não usar SQLite para a implantação compartilhada da v0: a aplicação
precisa ser acessível pela internet em mais de um dispositivo, com
persistência centralizada. Não usar Firebase/Firestore.

## 4. Arquitetura e segurança

-   O navegador nunca deve se conectar diretamente ao PostgreSQL.
-   Toda leitura e escrita de dados deve ocorrer no servidor, por meio
    de Server Components, Server Actions ou Route Handlers conforme
    apropriado.
-   Segredos e credenciais devem existir apenas em variáveis de ambiente
    do servidor.
-   Nunca usar prefixo `NEXT_PUBLIC_` em segredos.
-   Preparar a conexão com PostgreSQL para ambiente serverless. Usar a
    URL de conexão/pooler apropriada do Supabase para a aplicação e
    seguir a documentação oficial vigente do Supabase para a
    configuração. Se o pooler estiver em modo transaction, configurar o
    driver conforme a documentação, incluindo `prepare: false` quando
    aplicável.
-   Executar migrações de forma controlada; não executar DDL
    automaticamente a cada requisição.
-   A v0 terá uma barreira simples de acesso por senha compartilhada,
    sem contas individuais e sem login Google.
-   A senha deve vir de `APP_ACCESS_PASSWORD`, exclusivamente no
    servidor.
-   A sessão deve ser assinada usando `APP_SESSION_SECRET` e armazenada
    em cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`
    e com expiração definida.
-   Validar a sessão no servidor em todas as páginas privadas e em toda
    Server Action/Route Handler que leia ou altere dados. Não confiar
    apenas em middleware, estado React ou proteção visual.
-   Implementar logout.
-   Não armazenar senha ou segredo em `localStorage` ou
    `sessionStorage`.
-   Aplicar proteção razoável contra tentativas repetidas de senha e
    documentar a estratégia adotada.
-   A senha compartilhada dá o mesmo nível de acesso a qualquer pessoa
    que a conheça. Não há identidade individual, perfis ou permissões
    por pessoa na v0.

## 5. Modelo de dados mínimo da v0

Usar identificadores consistentes (UUID ou outra estratégia justificada)
e timestamps de criação/atualização.

### Category

-   `id`
-   `name`
-   `createdAt`
-   `updatedAt`

### Person (responsável)

-   `id`
-   `name`
-   `createdAt`
-   `updatedAt`

### BankAccount

-   `id`
-   `name`
-   `institution` opcional
-   `initialBalanceCents` inteiro
-   `archived` boolean
-   `createdAt`
-   `updatedAt`

### Expense

-   `id`
-   `description`
-   `amountCents` inteiro
-   `date` (data civil, sem deslocamento de fuso)
-   `categoryId` obrigatório
-   `personId` obrigatório
-   `bankAccountId` opcional
-   `createdAt`
-   `updatedAt`

Regras: - Categoria e pessoa são obrigatórias para uma despesa. - Conta
bancária é opcional. - Guardar dinheiro em centavos inteiros. Nunca usar
ponto flutuante para persistência ou cálculos monetários. - Validar os
relacionamentos no servidor e por chaves estrangeiras no banco. - Não
exibir IDs técnicos na interface; exibir nomes legíveis. - Preservar a
data selecionada pelo usuário, sem mudança de dia por conversão de
timezone. - Não permitir exclusões que deixem despesas órfãs. Quando
houver vínculos, bloquear a exclusão e orientar o usuário; para contas,
preferir arquivamento. - Não usar exclusão em cascata para apagar
despesas indiretamente. - Saldo inicial da conta é apenas informativo na
v0: não recalcular automaticamente saldo com despesas, não importar
extratos e não reconciliar saldos.

## 6. Escopo funcional da v0

Implementar: 1. Estrutura inicial do projeto e conexão PostgreSQL. 2.
Migrações e validação do schema. 3. Barreira de acesso simples por senha
compartilhada. 4. CRUD de categorias. 5. CRUD de pessoas/responsáveis.
6. CRUD de contas bancárias, com arquivamento. 7. CRUD de despesas,
vinculando categoria e pessoa e permitindo conta opcional. 8. Interface
responsiva e utilizável em desktop e dispositivos móveis. 9. Estados de
carregamento, vazio, sucesso e erro. 10. Validação de formulários no
cliente para usabilidade e obrigatoriamente no servidor. 11. Testes das
regras e operações essenciais. 12. Documentação de instalação, variáveis
de ambiente, migrações e deploy.

A ordem de implementação deve ser incremental. Não iniciar uma nova
etapa enquanto a anterior não estiver funcionando.

## 7. Fora do escopo da v0

Não implementar agora: - Login Google, autenticação individual, cadastro
de usuários ou recuperação de senha. - Household, membros, convites,
multi-tenancy, papéis ADMIN/VIEWER ou permissões por proprietário. -
Cartões, métodos de pagamento, parcelas, pagamentos parciais/totais ou
histórico de pagamentos. - Atualização automática de saldo, conciliação,
extratos ou integração bancária/Open Finance. - Despesas recorrentes,
orçamentos e metas. - Relatórios avançados, exportação CSV ou dashboards
complexos. - Microserviços, mensageria, filas, CQRS ou event sourcing.

Esses itens podem permanecer no backlog futuro, mas não devem aparecer
como dependências artificiais da v0.

## 8. Regras de implementação

-   Usar TypeScript com tipagem estrita; evitar `any`.
-   Separar componentes de interface, validação, regras de negócio e
    acesso a dados sem criar camadas excessivas.
-   Preferir validação compartilhada com Zod ou solução equivalente,
    mantendo validação obrigatória no servidor.
-   Tratar erros com mensagens compreensíveis; não expor stack traces,
    SQL ou segredos ao usuário.
-   Usar transações quando uma operação envolver múltiplas escritas que
    precisem ser atômicas.
-   Criar índices e constraints somente quando justificados pelo modelo
    e pelas consultas reais.
-   Manter nomes de tabelas/colunas consistentes.
-   Não inserir dados fictícios em produção. Seeds de desenvolvimento
    devem ser claramente separados.
-   Não fazer deploy, alterar serviços externos ou consumir recursos
    pagos sem solicitação explícita do usuário.
-   Não apagar arquivos ou configurações legadas sem inspecioná-los e
    explicar o impacto.

## 9. Variáveis de ambiente esperadas

Documentar em `.env.example`, sem valores reais:

-   `DATABASE_URL`
-   `APP_ACCESS_PASSWORD`
-   `APP_SESSION_SECRET`
-   `NODE_ENV` (gerenciada pelo ambiente quando aplicável)

Nunca incluir credenciais reais em commits, prompts, logs ou
documentação.

## 10. Critérios de aceite da v0

A v0 só pode ser considerada pronta quando: - A aplicação inicia
localmente seguindo o README. - A aplicação conecta ao PostgreSQL
configurado. - As migrações podem ser executadas de forma
reproduzível. - O acesso protegido funciona e as rotas/ações privadas
recusam chamadas sem sessão válida. - É possível criar, listar, editar e
excluir categorias sem vínculos. - É possível criar, listar, editar e
excluir pessoas sem vínculos. - É possível criar, listar, editar e
arquivar contas bancárias. - É possível criar, listar, editar e excluir
despesas respeitando os vínculos. - Valores monetários são persistidos
em centavos inteiros e exibidos corretamente em BRL. - Datas permanecem
iguais às escolhidas pelo usuário. - A interface funciona em desktop e
celular. - Erros e estados vazios são tratados. - Os testes essenciais
passam. - O README explica configuração, migrações, execução, deploy e
limitações da senha compartilhada.

## 11. Fluxo de trabalho esperado do agente

Para cada etapa: 1. Inspecione o estado atual do projeto. 2. Informe
brevemente o que pretende alterar. 3. Implemente somente a etapa
solicitada. 4. Execute verificações e testes disponíveis. 5. Relate
arquivos alterados, comandos executados, resultados e limitações. 6. Não
avance para a próxima etapa sem validação do usuário quando houver
decisão funcional ou arquitetural relevante.
