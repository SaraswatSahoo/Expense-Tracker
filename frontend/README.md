# Expense Tracking App: Frontend

Web app for sharing expenses in groups, built with React, TypeScript, Tailwind CSS, React Router and TanStack Query. It talks to the API in `../backend`.

## Prerequisites

- Node.js 22.18 or newer
- The backend running on port 4000 (see `../backend/README.md`)

## Setup

```sh
npm install
npm run dev
```

Then open <http://localhost:5173>. In development, Vite forwards `/api` requests to `http://localhost:4000`, so the backend needs no CORS setup.

## Scripts

| Script              | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Starts the dev server                    |
| `npm run build`     | Checks types and builds to `dist/`       |
| `npm run preview`   | Serves the production build locally      |
| `npm run typecheck` | Checks types without writing any files   |

## Project structure

```text
src/
  lib/            API client and session tokens, types, money and date helpers, query keys
  hooks/          useAuth and useGroup
  components/     Reusable UI: buttons, form fields, cards, modals, tabs, page layouts
  features/
    auth/         Login and signup
    dashboard/    Balance summary, payments to confirm, group overview
    groups/       Group list, group page, Balances and Members tabs
    expenses/     Expense list, add and edit form, split editor
    settlements/  Repayment list and form, confirm and reject
```

## Deployment

A production build needs `/api` to reach the backend. Serving both from one domain is simplest. If the frontend is on a different domain, add CORS to the backend first. Behind a reverse proxy, also set Express's `trust proxy`, otherwise all users share one login rate limit.

The refresh token is stored in `localStorage`, so it could be read by a malicious script if the site ever had a cross-site scripting flaw. Moving it to an `httpOnly` cookie would be safer, but needs backend changes.
