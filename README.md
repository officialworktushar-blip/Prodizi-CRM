# Prodizi-CRM

## Project overview

Prodigi CRM is an internal company workspace for managing leads, tasks, sales,
payments, targets and compensation. It is a role-aware Next.js App Router
application backed by Supabase for authentication, Postgres, realtime and
row-level security.

The current implementation includes the full CRM UI, Supabase-backed data
flows, team hierarchy management and smart lead assignment.

## Tech stack

- Next.js 16 (App Router, TypeScript strict, Turbopack)
- React 19
- Tailwind CSS v4 + shadcn/ui (Radix primitives)
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- TanStack Query, React Hook Form, Zod
- Recharts, SheetJS (`xlsx`)
- date-fns, Sonner, next-themes, lucide-react
- dnd-kit for drag-and-drop workflows
- Prettier + `prettier-plugin-tailwindcss`
- Supabase CLI (local dev dependency)

## Features

- **Dashboard**: owner and manager summaries scoped to the viewer's hierarchy,
  pipeline, revenue, pending payments, top performers and team workload.
- **Team hierarchy**: connected org chart plus list view, reporting manager,
  reporting breadcrumbs, direct reports, active/inactive access and unplaced
  member detection.
- **Role-aware member management**: owners manage the whole company; managers
  create and manage employees and interns in their own subtree. Only owners can
  create managers or change roles.
- **Leads**: pipeline table, kanban and upcoming views, unassigned tab,
  assignee and assigned-by filters, assignment history, bulk assignment, Excel
  import/export, confirmations and follow-ups.
- **Smart assignment**: workload-aware recommendations, manual assignment,
  round-robin distribution and least-loaded distribution with a preview before
  committing.
- **Tasks**: board and list views scoped to the viewer's hierarchy, daily and
  weekly work, lead completion flow, incentives and realtime updates.
- **Sales and salary**: hierarchy-scoped revenue, payments, payroll views and
  member filters.
- **Security**: server-side session refresh and route protection through
  `src/proxy.ts`; Supabase RLS remains the source of truth for data access.

## Hierarchy rules

- `Owner` is the top of the hierarchy.
- `Manager` reports to an owner.
- `Employee` reports to a manager or owner.
- `Intern` reports to an employee, manager or owner.
- Every non-owner should have a valid `manager_id`; otherwise the member is
  shown as **Unplaced** until an owner assigns a manager.
- Owners see all data. Managers see themselves and their full downline.
  Employees and interns see themselves.
- Assigning a manager in a filter includes that manager's whole subtree.
- Owner is always available as a reporting-manager option where the role rules
  allow it.

## Lead assignment

Assignment is available to owners and managers only. Every assignment records
`assigned_to`, `assigned_by` and `assigned_at`.

Recommendation scores combine:

- `+3` when the member's dedicated work, designation or position matches the
  lead kind or product/service.
- `-1` for every five open leads.
- `+ performance_pct / 50`.
- `-2` when the member has more than 15 pending tasks.

Bulk modes:

- **Round robin**: distributes selected leads evenly across selected members.
- **Least loaded**: assigns each lead to the selected member with the lowest
  current open-lead count, accounting for assignments made earlier in the same
  preview.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the environment file and fill in the Supabase project values:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_PROJECT_ID=
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the
   browser.

3. Apply the Supabase schema and hierarchy/assignment migration. The migration
   is not committed in this repository, so verify the deployed database has:

   - `profiles.manager_id`
   - `leads.assigned_by` and `leads.assigned_at`
   - the `assignee_workload` view
   - the `my_tree_ids`, `in_my_tree`, `is_admin`, `is_owner` and
     `notify_admins` functions
   - hierarchy-aware RLS policies and assignment guards

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Unauthenticated users
   are redirected to `/login`.

### First owner account

There is no public sign-up. To bootstrap the first owner:

1. Create a user in **Supabase Dashboard → Authentication → Users**.
2. Insert the matching profile row with `role = 'owner'` and `is_active = true`.
3. Sign in with that email and password on `/login`.

Additional members are created from the Team screen or
`POST /api/admin/create-member`.

## Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the development server             |
| `npm run build`        | Create a production build                |
| `npm run start`        | Start the production server              |
| `npm run lint`         | Run ESLint                               |
| `npm run typecheck`    | Run TypeScript with `--noEmit`           |
| `npm run format`       | Format the repository with Prettier      |
| `npm run format:check` | Check formatting without writing changes |

## Verification

Run the local checks before shipping:

```bash
npm run typecheck
npm run lint
npm run build
npm run format:check
```

No automated test runner is configured yet.

## Notes

- Next.js 16 renamed the `middleware` convention to `proxy`. The route guard
  and session refresh live in `src/proxy.ts` with the shared Supabase helper in
  `src/lib/supabase/middleware.ts`.
- Keep notifications, task creation, sales creation and assignment history
  trigger-driven. The frontend must not duplicate database automation.
- Branding uses the Prodigi palette: blue `#2D86E8` as the primary UI color and
  an orange → green → blue gradient for accents.
