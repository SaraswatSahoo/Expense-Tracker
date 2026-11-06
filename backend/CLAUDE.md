# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project summary

Backend for a group expense sharing app: users form groups, record shared expenses split among members, and settle up with repayments. Built with Express 5, TypeScript, PostgreSQL (hosted on Neon) and Prisma 7.

The REST API is built: authentication, groups, members, expenses, settlements and balances. The web app that uses it is in `../frontend` (React, TypeScript, Tailwind CSS); see its README. No test runner or linter is configured in either project, so `npm run typecheck` is the only automated check.

`DATABASE_URL` in `.env` points to a real Neon database that the user actively uses, and they may have `npm run dev` running. Test against a temporary local PostgreSQL on separate ports, and first prove that requests actually reach the temporary database.

## Commands

Run these from `backend/`. Requires Node.js 22.18 or newer.

```sh
npm run dev           # Run src/server.ts with tsx, restarting on file changes
npm run build         # prisma generate, then tsc to dist/
npm start             # Run the compiled dist/server.js
npm run typecheck     # tsc --noEmit
npm run db:generate   # Regenerate the Prisma client
npm run db:migrate    # prisma migrate dev: create and apply a migration
npm run db:deploy     # prisma migrate deploy: apply existing migrations
npm run db:studio     # Open Prisma Studio
```

`src/generated/` is gitignored, so run `npm run db:generate` after a fresh install and after changing the schema. `typecheck` and `dev` fail without the generated client; only `build` generates it automatically.

## Architecture

- **Startup:** `src/server.ts` starts the HTTP server and handles shutdown. `src/app.ts` builds the Express app and registers routers and middleware. `notFoundHandler` and `errorHandler` must stay last, so mount new routers above them.
- **Config:** `src/config/env.ts` loads and validates `.env` at import time, including `DATABASE_URL` and `JWT_SECRET`. Application code should use its `env` export rather than `process.env`.
- **Database:** `src/lib/prisma.ts` exports the shared `PrismaClient`; import it rather than creating another client.
- **Layers:** routers in `src/routes/` parse input with zod and call `src/services/`, which hold the business rules. `src/lib/serializers.ts` shapes all JSON output, so `passwordHash` and `deletedAt` are never returned and money is always a string.
- **Routing:** `src/routes/groups.ts` applies `requireAuth` and `requireGroupMember`, then mounts the nested members, expenses and settlements routers. Nested routers need `mergeParams: true`.
- **Errors:** throw the helpers in `src/lib/errors.ts` (`notFound`, `conflict` and so on). `errorHandler` turns them and zod errors into JSON responses. Non-members get `404` rather than `403`, so they can't discover groups.
- **Group writes:** anything that affects balances or membership must run inside `withGroupWrite` (`src/services/groupAccess.ts`). It locks the group row and rechecks the caller's membership, so a member can't leave while an expense naming them is being saved.
- **Rate limiting:** `src/routes/auth.ts` limits register and login per IP address. Behind a reverse proxy, set Express's `trust proxy`, otherwise all users share one limit.

## Prisma models and relations

Defined in `prisma/schema.prisma`:

| Model | Purpose | Primary key | Belongs to |
|---|---|---|---|
| `User` | Account with a `passwordHash`; `email` is unique | `id` | None |
| `RefreshToken` | Login session; only `tokenHash` is stored, and `tokenHash` is unique | `id` | `user` → `User` |
| `Group` | Cost-sharing group with one `currency` | `id` | `createdBy` → `User` |
| `GroupMember` | Group membership; `leftAt` marks former members | `groupId` + `userId` | `group` → `Group`, `user` → `User` |
| `Expense` | A cost in one group | `id` | `group` → `Group`, `paidBy` → `User`, `createdBy` → `User` |
| `ExpenseSplit` | One user's `shareAmount` of an expense | `expenseId` + `userId` | `expense` → `Expense`, `user` → `User` |
| `Settlement` | Repayment with a `SettlementStatus` of `PENDING`, `CONFIRMED` or `REJECTED` | `id` | `group` → `Group`, `fromUser` → `User`, `toUser` → `User`, `createdBy` → `User` |

**Delete behaviour:** relations to `User` use `Restrict`, so a user with any linked records can't be deleted; `RefreshToken` is the exception and uses `Cascade`. Relations to `Group` and `Expense` use `Cascade`, so deleting a group permanently removes its members, expenses, shares and settlements.

## Data rules

The first migration adds CHECK constraints by hand, because Prisma can't model them: positive amounts and shares, a three-capital-letter currency, and no settlement to oneself.

The database doesn't enforce these rules, so the services do, and new code must keep them:

- The payer, everyone sharing an expense and both settlement parties must be active members of the group. Removing a member sets `leftAt` rather than deleting the row.
- An expense's shares must add up exactly to its `amount`, and both are written in one transaction.
- Only the record's creator or payer can change an expense or a pending settlement. Only the receiver (`toUserId`) can confirm or reject a settlement. Confirmed and rejected settlements can't be changed.
- A member can't leave with a non-zero balance or a pending settlement, and a group can't be deleted until every balance is zero. Only the creator can delete a group.
- An expense involving a former member can't be deleted or have its payer, amount or shares changed.
- A group's currency can't change once it has expenses or settlements, including soft-deleted ones.
- `Expense` and `Settlement` are soft deleted by setting `deletedAt`, so queries must exclude those rows. Shares of a soft-deleted expense don't count.

A member's balance is `expenses paid - shares owed + confirmed settlements paid - confirmed settlements received`. Only `CONFIRMED` settlements affect balances.

## Naming rules

**Database**

- **Models:** singular PascalCase. There's no `@@map` or `@map`, so database names match Prisma names and must be double-quoted in raw SQL (`"GroupMember"."userId"`).
- **Fields:** camelCase. Foreign keys are the relation name plus `Id` (`paidBy` / `paidById`).
- **Named relations:** when a model links to `User` more than once, name the relation `<Model><Role>` (`"ExpensePayer"`).
- **Types:**
  - IDs are `@default(uuid(7)) @db.Uuid`; join tables use a composite `@@id`.
  - Money is `Decimal @db.Decimal(12, 2)`, so never use JavaScript numbers for money calculations.
  - Date-only fields are `@db.Date` (`expenseDate`, `settledOn`).
  - Points in time are `@db.Timestamptz(3)` and end in `At` (`deletedAt`, `leftAt`).
- **Every model** has `createdAt` and `updatedAt`.
- **CHECK constraints:** `<Model>_<rule>` (`Expense_amount_positive`).

**Code**

- Source files are camelCase (`errorHandler.ts`), with routers exported as `<name>Router` from `src/routes/<name>.ts`.

## Prisma 7 conventions

Prisma 7 differs from older versions and from many examples online:

- The connection URL is set in `prisma.config.ts` for the CLI and passed through the `PrismaPg` driver adapter at runtime. `schema.prisma` must not contain a `url`.
- The generator is `prisma-client` (not `prisma-client-js`), so import from `src/generated/prisma/client.js`, not `@prisma/client`.
- Stay on Prisma 7 unless an upgrade is requested. npm's `latest` tag currently points to a release candidate (`8.0.0-rc.30`), so don't install `prisma@latest`. Keep `prisma`, `@prisma/client` and `@prisma/adapter-pg` on the same version.

## TypeScript conventions

The project is ESM (`"type": "module"`) with `NodeNext` module resolution, so relative imports must end in `.js`, even when the source file is `.ts`. `noUncheckedIndexedAccess` is on, so indexed lookups can be `undefined`.
