# Expense Tracking App: Backend

Backend API for a group expense sharing app, built with Node.js, Express, TypeScript, PostgreSQL and Prisma.

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL, running locally or hosted

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create your `.env` file from `.env.example`. Set `DATABASE_URL` to your PostgreSQL database, creating the database first if it doesn't exist, and set `JWT_SECRET` to at least 32 random characters.

3. Apply the database migrations and generate the Prisma client:

   ```sh
   npm run db:deploy
   npm run db:generate
   ```

4. Start the dev server:

   ```sh
   npm run dev
   ```

5. Check it's working by opening <http://localhost:4000/health>. You should see:

   ```json
   { "status": "ok", "database": "connected" }
   ```

   If the database can't be reached, the endpoint returns a 503 with `"database": "disconnected"`.

## Scripts

| Script                | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Starts the server and restarts it on file changes |
| `npm run build`       | Generates the Prisma client and compiles to `dist/` |
| `npm start`           | Runs the compiled server                         |
| `npm run typecheck`   | Checks types without writing any files           |
| `npm run db:generate` | Regenerates the Prisma client                    |
| `npm run db:migrate`  | Creates and applies a migration in development   |
| `npm run db:deploy`   | Applies existing migrations in production        |
| `npm run db:studio`   | Opens Prisma Studio to browse the data           |

## API

All routes are under `/api`. Send `Authorization: Bearer <accessToken>` on everything except the auth routes. Access tokens last 15 minutes; use `/api/auth/refresh` to get a new pair.

Money values are strings such as `"100.50"`, and dates use `YYYY-MM-DD`. Errors look like `{ "error": "message" }`, with a `details` array for invalid input. Lists accept `?page=1&limit=20` and return `{ items, page, limit, total }`.

| Method and path | Purpose |
| --------------- | ------- |
| `POST /api/auth/register` | Create an account and log in |
| `POST /api/auth/login` | Log in |
| `POST /api/auth/refresh` | Swap a refresh token for a new pair |
| `POST /api/auth/logout` | Revoke a refresh token |
| `GET /api/users/me` | Get your profile |
| `PATCH /api/users/me` | Change your name |
| `PATCH /api/users/me/password` | Change your password and log out all devices |
| `GET /api/groups` | List your groups |
| `POST /api/groups` | Create a group |
| `GET /api/groups/:groupId` | Get a group and its members |
| `PATCH /api/groups/:groupId` | Rename a group or change its currency |
| `DELETE /api/groups/:groupId` | Delete a group (creator only, all balances zero) |
| `GET /api/groups/:groupId/balances` | Get balances and suggested repayments |
| `POST /api/groups/:groupId/members` | Add a registered user by email |
| `DELETE /api/groups/:groupId/members/:userId` | Remove a member, or leave the group |
| `GET /api/groups/:groupId/expenses` | List expenses (`from` and `to` filter by date) |
| `POST /api/groups/:groupId/expenses` | Create an expense and its shares |
| `GET /api/groups/:groupId/expenses/:expenseId` | Get an expense |
| `PATCH /api/groups/:groupId/expenses/:expenseId` | Edit an expense |
| `DELETE /api/groups/:groupId/expenses/:expenseId` | Delete an expense |
| `GET /api/groups/:groupId/settlements` | List settlements (`status` filters them) |
| `POST /api/groups/:groupId/settlements` | Record a repayment as pending |
| `GET /api/groups/:groupId/settlements/:settlementId` | Get a settlement |
| `PATCH /api/groups/:groupId/settlements/:settlementId` | Edit a pending settlement |
| `DELETE /api/groups/:groupId/settlements/:settlementId` | Delete a pending settlement |
| `POST /api/groups/:groupId/settlements/:settlementId/confirm` | Confirm a repayment (receiver only) |
| `POST /api/groups/:groupId/settlements/:settlementId/reject` | Reject a repayment (receiver only) |

## Project structure

```text
prisma/
  schema.prisma     Database schema
  migrations/       Database migrations
prisma.config.ts    Prisma CLI config: schema path, migrations path, database URL
src/
  config/env.ts     Loads and validates environment variables
  lib/              Prisma client, validation, errors and JSON formatting
  middleware/       Auth, group membership, 404 and error handlers
  routes/           Route handlers and input validation
  services/         Business rules and database access
  app.ts            Express app
  server.ts         Starts the server and handles shutdown
```
