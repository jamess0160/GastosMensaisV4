# Gastos Mensais V4

Controle de gastos mensais: contas e cartões, lançamento de gastos e rendas, rateio entre
pessoas, orçamento por categoria e relatórios do mês.

```
1. Docs/        a documentação do projeto
API/            Express + TypeScript + Knex sobre PostgreSQL
Frontend/       React 18 + Vite + TypeScript
```

**Os dois eram repositórios separados até 09/09/2026**, e foram juntados com `git subtree` — o
histórico de ambos está aqui inteiro.

## Rodar

Precisa de um PostgreSQL de pé. A API sobe primeiro; o dev server do front faz proxy de `/api`
para ela.

```bash
# API — em API/
cp exemple.env .env          # preencha DB_*, JWT_SECRET, MAIL_* e APP_URL
npx knex migrate:latest
npm start                    # nodemon sobre tsx

# Front — em Frontend/
cp .env.example .env         # VITE_API_PROXY_TARGET aponta para a API local
npm run dev                  # localhost:5173
```

O cookie de sessão é `HttpOnly` + `SameSite=Strict`, então front e API precisam estar na
**mesma origem**: em produção é o nginx servindo `/` e `/api`, em dev é o proxy do Vite. A saída
errada é afrouxar o cookie.

| | Testes | Typecheck | Formato |
|---|---|---|---|
| **API** | `npm test` (Jest, integração contra o banco de teste) | — | — |
| **Front** | `npm test` (Vitest) | `npm run typecheck` | `npm run format:check` |

A API tem ainda o par ponta a ponta: `npm run start:test` num terminal e `npm run test:e2e` no
outro — as mesmas suítes, contra um servidor de verdade.

## Documentação

| Onde | O que é |
|---|---|
| [1. Docs/RoadMap MVP.md](1.%20Docs/RoadMap%20MVP.md) | **Comece aqui.** O que existe hoje, o que falta para o MVP e o que ficou de fora |
| [1. Docs/Levas/](1.%20Docs/Levas/) | Um plano por leva de desenvolvimento, e o formato de um plano |
| [1. Docs/Old/](1.%20Docs/Old/) | Congelado: a documentação de quando o projeto eram dois repositórios |
| [CLAUDE.md](CLAUDE.md) | Convenções que valem para o repositório inteiro |
| [API/CLAUDE.md](API/CLAUDE.md) · [Frontend/CLAUDE.md](Frontend/CLAUDE.md) | A arquitetura de cada lado |
