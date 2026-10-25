# Prodizi-CRM

## Project overview

Prodigi CRM is an internal company workspace for managing leads, tasks, sales,
payments, targets and compensation. The application is built as a role-aware
Next.js App Router project with Supabase for authentication, Postgres, realtime
and row-level security.

This repository currently contains **Phase 1: project setup and scaffolding**.
Every route is in place with a placeholder screen, branding and shared UI
foundation. Feature work is intentionally not implemented yet.

## Tech stack

- Next.js 16 (App Router, TypeScript strict, Turbopack)
- React 19
- Tailwind CSS v4 + shadcn/ui (Radix primitives)
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- TanStack Query, React Hook Form, Zod
- Recharts, SheetJS (`xlsx`)
- date-fns, Sonner, next-themes, lucide-react
- dnd-kit for future drag-and-drop workflows
- Prettier + `prettier-plugin-tailwindcss`
- Supabase CLI (local dev dependency)

## Folder structure

```text
.
├── public/
│   └── logo.png
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── leads/[id]/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── salary/page.tsx
│   │   │   ├── sales/[id]/page.tsx
│   │   │   ├── sales/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── team/[id]/page.tsx
│   │   │   └── team/page.tsx
│   │   ├── api/admin/create-member/route.ts
│   │   ├── globals.css
│   │   ├── icon.png
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── topbar.tsx
│   │   ├── shared/
│   │   │   ├── page-placeholder.tsx
│   │   │   └── role-gate.tsx
│   │   ├── ui/                 # shadcn/ui components
│   │   └── providers.tsx
│   ├── hooks/
│   │   └── use-role.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── middleware.ts
│   │   │   └── server.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── database.ts
│   └── proxy.ts                # Next.js 16 middleware (session refresh + route guard)
├── .env.example
├── .prettierrc
├── components.json
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Setup steps

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file and fill in the Supabase project values:

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

   The service role key is server-only and must never be exposed to the
   browser.

3. Run the database schema in the Supabase SQL editor. The schema is the
   source of truth for tables, enums, triggers, views and RLS policies.

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

Owner and manager member invitations will be added to the Team module in a
later phase through `POST /api/admin/create-member`.

## Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the development server             |
| `npm run build`        | Create a production build                |
| `npm run start`        | Start the production server              |
| `npm run lint`         | Run ESLint                               |
| `npm run typecheck`    | Run TypeScript with `--noEmit`            |
| `npm run format`       | Format the repository with Prettier      |
| `npm run format:check` | Check formatting without writing changes |

## Notes and assumptions

- The database schema file was not present in the repository at scaffold time,
  and no Supabase project ID was configured. `src/types/database.ts` was
  therefore hand-written from the product specification in the Supabase
  generator shape. Regenerate it once schema access is available:

  ```bash
  npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.ts
  ```

- Next.js 16 renamed the `middleware` convention to `proxy`. The route guard
  and session refresh live in `src/proxy.ts` with the shared Supabase helper in
  `src/lib/supabase/middleware.ts`.
- `src/app/api/admin/create-member/route.ts` is a stub that returns `501` until
  the Team module is implemented.
- Branding uses the Prodigi palette: blue `#2D86E8` as the primary UI color and
  an orange → green → blue gradient for accents.
