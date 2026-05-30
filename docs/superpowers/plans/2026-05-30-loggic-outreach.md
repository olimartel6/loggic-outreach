# Loggic Outreach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bâtir un remplacement maison d'Instantly.ai pour Loggic — séquences de cold email, import CSV, stop-on-reply — utilisé par 2 cofondateurs, 15-50 emails/jour, déployé sur outreach.logiccsupplies.ca.

**Architecture:** React + Vite SPA sur Vercel, backend Supabase (Postgres + Auth + Edge Functions), envois SMTP via Spacemail des users, détection de réponses via poll IMAP. Pas de warmup, pas d'unibox.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind + shadcn/ui, TanStack Query, Supabase (Postgres, Auth, Edge Functions, Vault/pgcrypto), Deno (Edge Functions), `nodemailer`-equivalent pour Deno (`denomailer`), `imap-deno` ou équivalent.

**Spec source:** `docs/superpowers/specs/2026-05-30-loggic-outreach-design.md`

---

## File Structure

### Frontend (`web/`)

- `web/index.html` — Vite entry HTML
- `web/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- `web/src/main.tsx` — React entry
- `web/src/App.tsx` — Router + TanStack Query provider
- `web/src/lib/supabase.ts` — Supabase client singleton
- `web/src/lib/auth.tsx` — Auth context + protected route HOC
- `web/src/lib/api.ts` — Typed wrappers around Supabase queries
- `web/src/lib/format.ts` — date/number formatters
- `web/src/components/TopNav.tsx` — top navigation bar
- `web/src/components/Layout.tsx` — page shell
- `web/src/components/SequenceStepCard.tsx` — éditeur d'un step
- `web/src/components/LeadsTable.tsx` — table de leads avec filtres
- `web/src/components/CsvUploader.tsx` — drag-drop CSV
- `web/src/pages/Login.tsx`
- `web/src/pages/Dashboard.tsx`
- `web/src/pages/Campaigns.tsx` — liste des campagnes
- `web/src/pages/CampaignDetail.tsx` — séquence + leads d'une campagne
- `web/src/pages/Leads.tsx` — vue globale des leads
- `web/src/pages/Settings.tsx` — mailboxes + horaire
- `web/src/types.ts` — types DB partagés

### Backend (`supabase/`)

- `supabase/config.toml` — config local
- `supabase/migrations/0001_init.sql` — toutes les tables
- `supabase/migrations/0002_rls.sql` — Row-Level Security
- `supabase/migrations/0003_encryption.sql` — fonctions pgcrypto + SECURITY DEFINER
- `supabase/migrations/0004_auth_whitelist.sql` — trigger before user inserted
- `supabase/functions/send-tick/index.ts` — cron sender
- `supabase/functions/send-tick/smtp.ts` — wrapper denomailer
- `supabase/functions/send-tick/templates.ts` — rendu variables
- `supabase/functions/imap-poll/index.ts` — cron IMAP
- `supabase/functions/imap-poll/imap.ts` — wrapper IMAP
- `supabase/functions/imap-poll/threading.ts` — match Message-ID
- `supabase/functions/import-csv/index.ts` — endpoint CSV
- `supabase/functions/_shared/db.ts` — DB helpers partagés
- `supabase/functions/_shared/crypto.ts` — décryptage côté serveur
- `supabase/functions/_tests/` — tests Deno

### Infra/Docs (racine)

- `package.json` racine (workspaces)
- `.github/workflows/deploy-frontend.yml` — Vercel deploy
- `.github/workflows/deploy-functions.yml` — Supabase functions deploy
- `README.md` — setup local + deploy

---

## Phase 1 — Foundation (DB + Auth + Skeleton)

But: Pouvoir se logger avec magic link et voir une page Dashboard vide.

### Task 1.1: Initialiser le repo + workspaces

**Files:**
- Create: `package.json`
- Create: `.gitignore` (existe déjà, à compléter)
- Create: `README.md`

- [ ] **Step 1: Créer `package.json` racine avec workspaces**

```json
{
  "name": "loggic-outreach",
  "private": true,
  "version": "0.0.1",
  "workspaces": ["web"],
  "scripts": {
    "dev": "npm --workspace web run dev",
    "build": "npm --workspace web run build",
    "test:functions": "cd supabase/functions && deno test --allow-all"
  }
}
```

- [ ] **Step 2: Compléter `.gitignore`**

```
node_modules/
dist/
.env
.env.local
.superpowers/
supabase/.branches
supabase/.temp
```

- [ ] **Step 3: README minimal**

```markdown
# Loggic Outreach
Cold email automation for Loggic, 2 users. See docs/superpowers/.

## Dev
1. `cp .env.example .env` and fill Supabase keys
2. `npm install`
3. `npm run dev` (frontend) + `supabase start` (backend local)
```

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore README.md
git commit -m "chore: init workspaces"
```

### Task 1.2: Scaffold frontend Vite + TypeScript + Tailwind + shadcn

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/tailwind.config.ts`, `web/postcss.config.js`
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`

- [ ] **Step 1: Run Vite scaffold**

```bash
cd web && npm create vite@latest . -- --template react-ts -y
```

Expected: Vite scaffold files in `web/`.

- [ ] **Step 2: Install deps**

```bash
cd web && npm i react-router-dom @tanstack/react-query @supabase/supabase-js zod react-hook-form
cd web && npm i -D tailwindcss postcss autoprefixer @types/node
cd web && npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

`web/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

`web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-slate-50 text-slate-900; font-family: ui-sans-serif, system-ui, sans-serif; }
```

- [ ] **Step 4: Add shadcn baseline (manual, no CLI)**

Create `web/src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

```bash
cd web && npm i clsx tailwind-merge
```

- [ ] **Step 5: Verify build works**

```bash
cd web && npm run build
```

Expected: build succeeds, `web/dist/` created.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite + Tailwind"
```

### Task 1.3: Supabase project + migrations init

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Install Supabase CLI and init**

```bash
brew install supabase/tap/supabase 2>/dev/null || true
cd ~/Desktop/loggic-outreach && supabase init
```

Expected: `supabase/config.toml` created.

- [ ] **Step 2: Write initial migration `supabase/migrations/0001_init.sql`**

```sql
-- Mailboxes per user (1 per user expected)
create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  smtp_host text not null,
  smtp_port int not null default 587,
  smtp_user text not null,
  smtp_pass_encrypted bytea not null,
  imap_host text not null,
  imap_port int not null default 993,
  imap_pass_encrypted bytea not null,
  last_imap_uid_seen bigint not null default 0,
  status text not null default 'active' check (status in ('active','paused','error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mailboxes_user_uniq on public.mailboxes(user_id);

-- Campaigns shared across all users
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_by uuid not null references auth.users(id),
  schedule jsonb not null default '{"days":["mon","tue","wed","thu","fri"],"start_hour":8,"end_hour":17,"daily_limit_per_user":20,"timezone":"America/Toronto"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_order int not null,
  delay_days int not null default 0,
  subject_template text not null,
  body_template text not null,
  unique (campaign_id, step_order)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  company text,
  demo_link text,
  custom1 text,
  status text not null default 'queued' check (status in ('queued','in_progress','replied','bounced','completed','unsubscribed','failed')),
  current_step int not null default 0,
  next_send_at timestamptz,
  mailbox_id uuid references public.mailboxes(id),
  thread_message_id text,
  last_subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index leads_due_idx on public.leads(status, next_send_at) where status in ('queued','in_progress');

create table public.sends (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  step_id uuid not null references public.sequence_steps(id),
  mailbox_id uuid not null references public.mailboxes(id),
  sent_at timestamptz not null default now(),
  smtp_message_id text,
  status text not null check (status in ('sent','bounced','failed')),
  error_text text
);

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes(id),
  detected_at timestamptz not null default now(),
  imap_uid bigint not null,
  snippet text
);
```

- [ ] **Step 3: Start Supabase locally and apply**

```bash
cd ~/Desktop/loggic-outreach && supabase start
supabase migration up
```

Expected: containers up, migration applied. Note the local URL + anon key from `supabase status`.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(db): initial schema"
```

### Task 1.4: Auth whitelist trigger

**Files:**
- Create: `supabase/migrations/0004_auth_whitelist.sql`

- [ ] **Step 1: Write the failing test (manual smoke planned at Step 4)**

(Trigger logic — TDD here is awkward in SQL; we'll smoke test it.)

- [ ] **Step 2: Write migration**

```sql
-- Whitelist: only specific emails can create accounts.
-- Edit allowed_emails to add users.
create or replace function public.enforce_whitelist()
returns trigger language plpgsql security definer as $$
declare
  allowed_emails text[] := array['oliviermartel2006@gmail.com', 'olivier@logiccsupplies.ca', 'charles-antoine@logiccsupplies.ca'];
begin
  if new.email is null or not (new.email = any(allowed_emails)) then
    raise exception 'Email % is not authorized', new.email;
  end if;
  return new;
end$$;

drop trigger if exists enforce_whitelist_trigger on auth.users;
create trigger enforce_whitelist_trigger
  before insert on auth.users
  for each row execute function public.enforce_whitelist();
```

- [ ] **Step 3: Apply**

```bash
supabase migration up
```

- [ ] **Step 4: Manual smoke**

```bash
# Local Supabase Studio: http://localhost:54323
# Try sending magic link to bogus@example.com — should error.
# Try with olivier@logiccsupplies.ca — should succeed.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_auth_whitelist.sql
git commit -m "feat(auth): whitelist trigger"
```

### Task 1.5: Supabase client + Auth context (frontend)

**Files:**
- Create: `web/.env.example`, `web/.env.local`
- Create: `web/src/lib/supabase.ts`
- Create: `web/src/lib/auth.tsx`

- [ ] **Step 1: Install Supabase client**

```bash
cd web && npm i @supabase/supabase-js
```

- [ ] **Step 2: Create env files**

`web/.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`web/.env.local` (gitignored): fill with local Supabase URL + anon key from `supabase status`.

- [ ] **Step 3: Create `web/src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_* env vars')

export const supabase = createClient(url, key)
```

- [ ] **Step 4: Create `web/src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

const AuthCtx = createContext<{ session: Session | null, loading: boolean }>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return <AuthCtx.Provider value={{ session, loading }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
```

- [ ] **Step 5: Commit**

```bash
git add web/.env.example web/src/lib/
git commit -m "feat(web): supabase client + auth context"
```

### Task 1.6: Login page (magic link) + protected routes + shell

**Files:**
- Create: `web/src/pages/Login.tsx`, `web/src/pages/Dashboard.tsx`
- Create: `web/src/components/TopNav.tsx`, `web/src/components/Layout.tsx`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`

- [ ] **Step 1: Create `Login.tsx`**

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function send(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setError(error.message); else setSent(true)
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={send} className="bg-white p-8 rounded-xl shadow-sm w-96">
        <h1 className="text-xl font-bold mb-1">Loggic Outreach</h1>
        <p className="text-sm text-slate-500 mb-6">Connecte-toi avec ton email Loggic.</p>
        {sent ? (
          <p className="text-green-600 text-sm">Vérifie ta boîte mail pour le lien.</p>
        ) : (
          <>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="toi@logiccsupplies.ca" className="w-full border rounded px-3 py-2 mb-3"/>
            <button className="w-full bg-slate-900 text-white py-2 rounded">Envoyer le lien</button>
            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
          </>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create `TopNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campagnes' },
  { to: '/leads', label: 'Leads' },
  { to: '/settings', label: 'Settings' },
]

export function TopNav() {
  const { session } = useAuth()
  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center text-sm">
      <div className="font-bold mr-8">⚡ Outreach</div>
      <div className="flex gap-6 flex-1">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({isActive}) => isActive ? 'font-semibold border-b-2 border-slate-900 pb-1' : 'text-slate-500'}>{t.label}</NavLink>
        ))}
      </div>
      <div className="text-xs text-slate-500 mr-4">{session?.user.email}</div>
      <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-slate-900">Logout</button>
    </nav>
  )
}
```

- [ ] **Step 3: Create `Layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Create `Dashboard.tsx` (placeholder)**

```tsx
export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-slate-500">Vue d'ensemble — à venir.</p>
    </div>
  )
}
```

- [ ] **Step 5: Rewrite `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

const qc = new QueryClient()

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-500">Chargement…</div>
  if (!session) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 6: Update `main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
```

- [ ] **Step 7: Smoke test**

```bash
cd web && npm run dev
```

Open http://localhost:5173 — expect login. Use whitelisted email → magic link from Supabase Inbucket (http://localhost:54324) → redirect to Dashboard.

- [ ] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat(web): login + protected shell"
```

---

## Phase 2 — Campaign + Sequence CRUD

But: Créer une campagne avec 3 étapes, l'éditer, l'enregistrer.

### Task 2.1: RLS policies for shared campaigns

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: Write migration**

```sql
-- All authenticated users see and modify everything (2-person team, shared).
alter table public.mailboxes enable row level security;
alter table public.campaigns enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.leads enable row level security;
alter table public.sends enable row level security;
alter table public.replies enable row level security;

create policy "auth users read mailboxes" on public.mailboxes for select to authenticated using (true);
create policy "users manage their own mailbox" on public.mailboxes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "auth users all on campaigns" on public.campaigns for all to authenticated using (true) with check (true);
create policy "auth users all on sequence_steps" on public.sequence_steps for all to authenticated using (true) with check (true);
create policy "auth users all on leads" on public.leads for all to authenticated using (true) with check (true);
create policy "auth users read sends" on public.sends for select to authenticated using (true);
create policy "auth users read replies" on public.replies for select to authenticated using (true);
-- sends and replies are written only by service role (Edge Functions).
```

- [ ] **Step 2: Apply**

```bash
supabase migration up
```

- [ ] **Step 3: Manual smoke via SQL editor**

Log in as olivier@, run `select * from campaigns;` — returns empty (not error). Run `insert into campaigns(name, created_by) values ('test', auth.uid())` — succeeds.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat(db): RLS for shared campaigns"
```

### Task 2.2: Types + API wrappers

**Files:**
- Create: `web/src/types.ts`, `web/src/lib/api.ts`

- [ ] **Step 1: Generate Supabase types**

```bash
cd ~/Desktop/loggic-outreach && supabase gen types typescript --local > web/src/types.gen.ts
```

- [ ] **Step 2: Create app-level types in `web/src/types.ts`**

```ts
import type { Database } from './types.gen'
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type SequenceStep = Database['public']['Tables']['sequence_steps']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Mailbox = Database['public']['Tables']['mailboxes']['Row']
export type LeadStatus = Lead['status']
```

- [ ] **Step 3: Create `web/src/lib/api.ts`**

```ts
import { supabase } from './supabase'
import type { Campaign, SequenceStep, Lead, Mailbox } from '../types'

export const campaignsApi = {
  list: async (): Promise<Campaign[]> => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },
  create: async (name: string, userId: string) => {
    const { data, error } = await supabase.from('campaigns').insert({ name, created_by: userId }).select().single()
    if (error) throw error
    return data
  },
  update: async (id: string, patch: Partial<Campaign>) => {
    const { error } = await supabase.from('campaigns').update(patch).eq('id', id)
    if (error) throw error
  },
}

export const stepsApi = {
  listByCampaign: async (campaignId: string): Promise<SequenceStep[]> => {
    const { data, error } = await supabase.from('sequence_steps').select('*').eq('campaign_id', campaignId).order('step_order')
    if (error) throw error
    return data
  },
  upsert: async (step: Partial<SequenceStep> & { campaign_id: string, step_order: number, subject_template: string, body_template: string, delay_days: number }) => {
    const { error } = await supabase.from('sequence_steps').upsert(step, { onConflict: 'campaign_id,step_order' })
    if (error) throw error
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('sequence_steps').delete().eq('id', id)
    if (error) throw error
  },
}

export const leadsApi = {
  listByCampaign: async (campaignId: string): Promise<Lead[]> => {
    const { data, error } = await supabase.from('leads').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  listAll: async (filter?: Lead['status']) => {
    let q = supabase.from('leads').select('*, campaigns(name)').order('created_at', { ascending: false })
    if (filter) q = q.eq('status', filter)
    const { data, error } = await q
    if (error) throw error
    return data
  },
}

export const mailboxesApi = {
  mine: async (userId: string): Promise<Mailbox | null> => {
    const { data, error } = await supabase.from('mailboxes').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  },
}
```

- [ ] **Step 4: Verify build still passes**

```bash
cd web && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web/src/types.ts web/src/types.gen.ts web/src/lib/api.ts
git commit -m "feat(web): types + api wrappers"
```

### Task 2.3: Campaigns list page

**Files:**
- Create: `web/src/pages/Campaigns.tsx`
- Modify: `web/src/App.tsx` (add route)

- [ ] **Step 1: Create `Campaigns.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { campaignsApi } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Campaigns() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: campaignsApi.list })
  const create = useMutation({
    mutationFn: () => campaignsApi.create(name, session!.user.id),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['campaigns'] }) },
  })
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campagnes</h1>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate() }} className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la campagne" className="border rounded px-3 py-1.5 text-sm"/>
          <button className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded">+ Nouvelle</button>
        </form>
      </div>
      {isLoading ? <p>Chargement…</p> : (
        <div className="bg-white rounded-xl border divide-y">
          {data?.length === 0 && <div className="p-6 text-slate-500">Aucune campagne. Crée la première ↑</div>}
          {data?.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">Status: {c.status} • Créée {new Date(c.created_at).toLocaleDateString('fr-CA')}</div>
              </div>
              <span className="text-slate-400">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add route in `App.tsx`**

Add import and route:
```tsx
import Campaigns from './pages/Campaigns'
// ...
<Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
```

- [ ] **Step 3: Smoke test**

```bash
cd web && npm run dev
```

Visit /campaigns, create one, see it in the list.

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): campaigns list + create"
```

### Task 2.4: Campaign detail with sequence editor

**Files:**
- Create: `web/src/pages/CampaignDetail.tsx`, `web/src/components/SequenceStepCard.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `SequenceStepCard.tsx`**

```tsx
import { useState } from 'react'
import type { SequenceStep } from '../types'

type Draft = Pick<SequenceStep, 'step_order' | 'delay_days' | 'subject_template' | 'body_template'>

export function SequenceStepCard({ initial, onSave, onDelete }: {
  initial: Draft,
  onSave: (d: Draft) => Promise<void>,
  onDelete?: () => Promise<void>,
}) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setDraft({ ...draft, [k]: v }); setDirty(true) }
  return (
    <div className="bg-white border rounded-xl p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold text-sm">📧 Étape {draft.step_order + 1}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Délai:</span>
          <input type="number" min={0} value={draft.delay_days} onChange={e => set('delay_days', Number(e.target.value))} className="border rounded w-16 px-2 py-0.5"/>
          <span>jours après l'étape précédente</span>
        </div>
      </div>
      <input value={draft.subject_template} onChange={e => set('subject_template', e.target.value)} placeholder="Sujet (utilise {first_name}, {company}, etc.)" className="w-full border rounded px-3 py-1.5 text-sm mb-2"/>
      <textarea value={draft.body_template} onChange={e => set('body_template', e.target.value)} rows={6} placeholder="Corps de l'email" className="w-full border rounded px-3 py-2 text-sm font-mono"/>
      <div className="flex justify-between mt-3">
        {onDelete && <button onClick={() => confirm('Supprimer cette étape ?') && onDelete()} className="text-xs text-red-600">Supprimer</button>}
        <button disabled={!dirty} onClick={async () => { await onSave(draft); setDirty(false) }} className="ml-auto text-xs bg-slate-900 text-white px-3 py-1 rounded disabled:opacity-30">{dirty ? 'Enregistrer' : 'À jour'}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `CampaignDetail.tsx`**

```tsx
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignsApi, stepsApi } from '../lib/api'
import { SequenceStepCard } from '../components/SequenceStepCard'

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: camp } = useQuery({ queryKey: ['campaign', id], queryFn: () => campaignsApi.get(id!), enabled: !!id })
  const { data: steps } = useQuery({ queryKey: ['steps', id], queryFn: () => stepsApi.listByCampaign(id!), enabled: !!id })
  const upsert = useMutation({
    mutationFn: stepsApi.upsert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', id] }),
  })
  const remove = useMutation({
    mutationFn: stepsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', id] }),
  })
  const toggleStatus = useMutation({
    mutationFn: (status: 'active' | 'paused' | 'draft') => campaignsApi.update(id!, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  })

  if (!camp) return <p>Chargement…</p>
  const nextOrder = steps ? steps.length : 0
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{camp.name}</h1>
          <div className="text-xs text-slate-500">Status: {camp.status}</div>
        </div>
        <div className="flex gap-2 text-xs">
          {camp.status !== 'active' && <button onClick={() => toggleStatus.mutate('active')} className="bg-green-600 text-white px-3 py-1.5 rounded">Activer</button>}
          {camp.status === 'active' && <button onClick={() => toggleStatus.mutate('paused')} className="bg-yellow-600 text-white px-3 py-1.5 rounded">Mettre en pause</button>}
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-3">Séquence</h2>
      {steps?.map(s => (
        <SequenceStepCard
          key={s.id}
          initial={s}
          onSave={d => upsert.mutateAsync({ ...d, campaign_id: id!, id: s.id })}
          onDelete={() => remove.mutateAsync(s.id)}
        />
      ))}
      <button
        onClick={() => upsert.mutate({ campaign_id: id!, step_order: nextOrder, delay_days: nextOrder === 0 ? 0 : 4, subject_template: '', body_template: '' })}
        className="w-full border-2 border-dashed border-slate-300 text-slate-500 py-4 rounded-xl hover:border-slate-500"
      >
        + Ajouter une étape
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```tsx
import CampaignDetail from './pages/CampaignDetail'
<Route path="/campaigns/:id" element={<Protected><CampaignDetail /></Protected>} />
```

- [ ] **Step 4: Smoke test**

Crée une campagne, ajoute 3 étapes, édite, supprime, active/pause. Vérifie en SQL: `select * from sequence_steps;`

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): campaign detail + sequence editor"
```

---

## Phase 3 — Lead Management

But: Importer un CSV de leads dans une campagne, voir la liste, ajouter manuellement.

### Task 3.1: CSV uploader component (frontend-only parsing)

**Files:**
- Create: `web/src/components/CsvUploader.tsx`
- Install: `papaparse`

- [ ] **Step 1: Install papaparse**

```bash
cd web && npm i papaparse && npm i -D @types/papaparse
```

- [ ] **Step 2: Create `CsvUploader.tsx`**

```tsx
import { useState } from 'react'
import Papa from 'papaparse'

export type LeadDraft = {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  demo_link?: string
  custom1?: string
}

export function CsvUploader({ onParsed }: { onParsed: (leads: LeadDraft[]) => void }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-500">
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (!f) return
          setError(null)
          Papa.parse<Record<string, string>>(f, {
            header: true,
            skipEmptyLines: true,
            complete: r => {
              const leads: LeadDraft[] = []
              for (const row of r.data) {
                const email = row.email?.trim().toLowerCase()
                if (!email || !email.includes('@')) continue
                leads.push({
                  email,
                  first_name: row.first_name?.trim() || undefined,
                  last_name: row.last_name?.trim() || undefined,
                  company: row.company?.trim() || row.company_name?.trim() || undefined,
                  demo_link: row.demo_link?.trim() || undefined,
                  custom1: row.custom1?.trim() || undefined,
                })
              }
              if (leads.length === 0) setError('Aucun email valide trouvé.')
              else onParsed(leads)
            },
            error: e => setError(e.message),
          })
        }}
      />
      <div className="text-sm font-semibold">Glisse un CSV ici ou clique</div>
      <div className="text-xs text-slate-500 mt-1">Colonnes attendues: email, first_name, last_name, company, demo_link, custom1</div>
      {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
    </label>
  )
}
```

- [ ] **Step 3: Add unit test for CSV parsing**

`web/src/components/CsvUploader.test.ts` (use vitest if added later; for now skip — papaparse is well-tested).

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat(web): CSV uploader component"
```

### Task 3.2: Leads on campaign detail + bulk insert

**Files:**
- Modify: `web/src/lib/api.ts` (add `leadsApi.bulkInsert`, `leadsApi.insertOne`)
- Modify: `web/src/pages/CampaignDetail.tsx` (add leads section + CSV uploader)

- [ ] **Step 1: Extend `leadsApi`**

In `web/src/lib/api.ts`:
```ts
export const leadsApi = {
  // ... existing
  bulkInsert: async (campaignId: string, leads: { email: string, first_name?: string, last_name?: string, company?: string, demo_link?: string, custom1?: string }[]) => {
    const rows = leads.map(l => ({ ...l, campaign_id: campaignId, status: 'queued' as const, current_step: 0, next_send_at: new Date().toISOString() }))
    const { data, error } = await supabase.from('leads').upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true }).select()
    if (error) throw error
    return data
  },
  insertOne: async (campaignId: string, lead: { email: string, first_name?: string, company?: string, demo_link?: string }) => {
    const { error } = await supabase.from('leads').insert({ ...lead, campaign_id: campaignId, status: 'queued', current_step: 0, next_send_at: new Date().toISOString() })
    if (error) throw error
  },
}
```

- [ ] **Step 2: Add leads section to `CampaignDetail.tsx`**

Add after the sequence editor section:
```tsx
import { CsvUploader } from '../components/CsvUploader'
import { leadsApi } from '../lib/api'

// inside the component, alongside other queries:
const { data: leads } = useQuery({ queryKey: ['leads', id], queryFn: () => leadsApi.listByCampaign(id!), enabled: !!id })
const importLeads = useMutation({
  mutationFn: (l: Parameters<typeof leadsApi.bulkInsert>[1]) => leadsApi.bulkInsert(id!, l),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', id] }),
})

// JSX (after sequence section):
<h2 className="text-lg font-semibold mt-8 mb-3">Leads ({leads?.length ?? 0})</h2>
<CsvUploader onParsed={l => importLeads.mutate(l)} />
{importLeads.isSuccess && <p className="text-green-600 text-xs mt-2">{importLeads.data?.length ?? 0} leads importés (doublons ignorés).</p>}
<div className="mt-4 bg-white border rounded-xl divide-y max-h-96 overflow-auto">
  {leads?.map(l => (
    <div key={l.id} className="flex justify-between p-3 text-sm">
      <div>
        <div className="font-medium">{l.email}</div>
        <div className="text-xs text-slate-500">{l.company} • {l.first_name} {l.last_name}</div>
      </div>
      <div className="text-xs text-slate-500">{l.status} • step {l.current_step}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Smoke test**

Crée un CSV test:
```bash
cat > /tmp/test-leads.csv <<EOF
email,first_name,company,demo_link
test1@example.com,Alice,Café Test,https://demo.logiccsupplies.ca/?tenant=cafe-test
test2@example.com,Bob,Salon Test,https://demo.logiccsupplies.ca/?tenant=salon-test
EOF
```

Importe-le dans une campagne. Vérifie en SQL: `select email, status, next_send_at from leads;`

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): import CSV into campaign"
```

### Task 3.3: Global Leads page with filters

**Files:**
- Create: `web/src/components/LeadsTable.tsx`, `web/src/pages/Leads.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `LeadsTable.tsx`**

```tsx
import type { Lead } from '../types'

const statusLabel: Record<Lead['status'], string> = {
  queued: 'En queue',
  in_progress: 'En cours',
  replied: '✓ Réponse',
  bounced: 'Bounced',
  completed: 'Fini',
  unsubscribed: 'Unsubscribe',
  failed: 'Échec',
}

const statusColor: Record<Lead['status'], string> = {
  queued: 'text-slate-500',
  in_progress: 'text-blue-600',
  replied: 'text-green-600 font-semibold',
  bounced: 'text-red-600',
  completed: 'text-slate-400',
  unsubscribed: 'text-slate-400',
  failed: 'text-red-600',
}

export function LeadsTable({ leads }: { leads: (Lead & { campaigns?: { name: string } | null })[] }) {
  return (
    <table className="w-full text-sm bg-white border rounded-xl overflow-hidden">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="p-3">Email</th><th className="p-3">Entreprise</th><th className="p-3">Campagne</th><th className="p-3">Status</th><th className="p-3">Étape</th>
        </tr>
      </thead>
      <tbody>
        {leads.map(l => (
          <tr key={l.id} className="border-t">
            <td className="p-3">{l.email}</td>
            <td className="p-3">{l.company ?? '—'}</td>
            <td className="p-3">{l.campaigns?.name ?? '—'}</td>
            <td className={`p-3 ${statusColor[l.status]}`}>{statusLabel[l.status]}</td>
            <td className="p-3 text-xs text-slate-500">{l.current_step}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Create `Leads.tsx`**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { leadsApi } from '../lib/api'
import { LeadsTable } from '../components/LeadsTable'
import type { LeadStatus } from '../types'

const tabs: { key: LeadStatus | 'all', label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'queued', label: 'En queue' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'replied', label: 'Réponses' },
  { key: 'bounced', label: 'Bounced' },
]

export default function Leads() {
  const [filter, setFilter] = useState<typeof tabs[number]['key']>('all')
  const { data } = useQuery({
    queryKey: ['leads-global', filter],
    queryFn: () => leadsApi.listAll(filter === 'all' ? undefined : filter),
  })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Leads</h1>
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} className={`text-xs px-3 py-1.5 rounded ${filter === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{t.label}</button>
        ))}
      </div>
      <LeadsTable leads={data ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Add route**

```tsx
import Leads from './pages/Leads'
<Route path="/leads" element={<Protected><Leads /></Protected>} />
```

- [ ] **Step 4: Smoke test + Commit**

```bash
git add web/src
git commit -m "feat(web): global leads page with filters"
```

---

## Phase 4 — Send Tick (Edge Function)

But: Edge Function `send-tick` qui envoie les emails dus, gère le threading, log dans `sends`.

### Task 4.1: pgcrypto encryption helpers

**Files:**
- Create: `supabase/migrations/0003_encryption.sql`

- [ ] **Step 1: Write migration**

```sql
create extension if not exists pgcrypto;
create schema if not exists private;

-- Server-side only: read from app.encryption_key set via supabase secrets
create or replace function private.encrypt_secret(plain text)
returns bytea language plpgsql security definer as $$
declare key text := current_setting('app.encryption_key', true);
begin
  if key is null or length(key) < 32 then raise exception 'ENCRYPTION_KEY missing or too short'; end if;
  return pgp_sym_encrypt(plain, key);
end$$;

create or replace function private.decrypt_secret(cipher bytea)
returns text language plpgsql security definer as $$
declare key text := current_setting('app.encryption_key', true);
begin
  if key is null then raise exception 'ENCRYPTION_KEY missing'; end if;
  return pgp_sym_decrypt(cipher, key);
end$$;

revoke all on function private.encrypt_secret(text) from public, anon, authenticated;
revoke all on function private.decrypt_secret(bytea) from public, anon, authenticated;
-- Only service_role (Edge Functions) can call.
grant execute on function private.encrypt_secret(text), private.decrypt_secret(bytea) to service_role;
```

- [ ] **Step 2: Set encryption key in Supabase dashboard**

Generate: `openssl rand -base64 48`. Then in Supabase Studio → SQL editor:
```sql
alter database postgres set app.encryption_key to 'PASTE_KEY_HERE';
```

Locally:
```bash
echo "ALTER DATABASE postgres SET app.encryption_key TO '$(openssl rand -base64 48)';" | supabase db query
```

- [ ] **Step 3: Apply migration**

```bash
supabase migration up
```

- [ ] **Step 4: Smoke test**

```sql
select length(private.encrypt_secret('test'));  -- non-zero
select private.decrypt_secret(private.encrypt_secret('hello'));  -- 'hello'
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_encryption.sql
git commit -m "feat(db): pgcrypto encryption helpers"
```

### Task 4.2: Mailbox upsert RPC (to encrypt creds server-side)

**Files:**
- Create: `supabase/migrations/0005_mailbox_rpc.sql`

- [ ] **Step 1: Write RPC**

```sql
create or replace function public.upsert_mailbox(
  p_display_name text,
  p_email text,
  p_smtp_host text,
  p_smtp_port int,
  p_smtp_user text,
  p_smtp_pass text,
  p_imap_host text,
  p_imap_port int,
  p_imap_pass text
) returns uuid language plpgsql security definer as $$
declare m_id uuid;
begin
  insert into public.mailboxes (
    user_id, display_name, email, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
    imap_host, imap_port, imap_pass_encrypted
  ) values (
    auth.uid(), p_display_name, p_email, p_smtp_host, p_smtp_port, p_smtp_user, private.encrypt_secret(p_smtp_pass),
    p_imap_host, p_imap_port, private.encrypt_secret(p_imap_pass)
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    smtp_host = excluded.smtp_host,
    smtp_port = excluded.smtp_port,
    smtp_user = excluded.smtp_user,
    smtp_pass_encrypted = excluded.smtp_pass_encrypted,
    imap_host = excluded.imap_host,
    imap_port = excluded.imap_port,
    imap_pass_encrypted = excluded.imap_pass_encrypted,
    updated_at = now()
  returning id into m_id;
  return m_id;
end$$;

grant execute on function public.upsert_mailbox(text,text,text,int,text,text,text,int,text) to authenticated;
```

- [ ] **Step 2: Apply + smoke test from Studio**

```bash
supabase migration up
```

In Studio, logged as olivier@: call `select public.upsert_mailbox('Test', 'olivier@logiccsupplies.ca', 'mail.spacemail.com', 587, 'olivier@logiccsupplies.ca', 'fakepw', 'mail.spacemail.com', 993, 'fakepw');`. Should return a UUID.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_mailbox_rpc.sql
git commit -m "feat(db): upsert_mailbox RPC"
```

### Task 4.3: Template rendering (Edge Function module + test)

**Files:**
- Create: `supabase/functions/send-tick/templates.ts`
- Create: `supabase/functions/_tests/templates_test.ts`

- [ ] **Step 1: Write failing test**

`supabase/functions/_tests/templates_test.ts`:
```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { render } from '../send-tick/templates.ts'

Deno.test('substitutes known variables', () => {
  const out = render('Salut {first_name}, j\'ai vu {company}.', {
    first_name: 'Sophie', company: 'Urbania', custom1: '', demo_link: '', last_name: '',
  })
  assertEquals(out, "Salut Sophie, j'ai vu Urbania.")
})

Deno.test('keeps unknown variables as-is', () => {
  const out = render('Salut {first_name}, {foo}.', {
    first_name: 'Bob', company: '', custom1: '', demo_link: '', last_name: '',
  })
  assertEquals(out, 'Salut Bob, {foo}.')
})

Deno.test('appends unsubscribe footer when missing', () => {
  const out = render('Hi.', { first_name: '', last_name: '', company: '', demo_link: '', custom1: '' }, { footer: '\n\n--\nUnsub: mailto:olivier+unsub@logiccsupplies.ca' })
  assertEquals(out.endsWith('Unsub: mailto:olivier+unsub@logiccsupplies.ca'), true)
})
```

- [ ] **Step 2: Run — expect FAIL (file missing)**

```bash
cd supabase/functions && deno test --allow-all _tests/templates_test.ts
```

Expected: FAIL "Module not found".

- [ ] **Step 3: Implement `templates.ts`**

```ts
export type Vars = {
  first_name: string
  last_name: string
  company: string
  demo_link: string
  custom1: string
}

const KNOWN: (keyof Vars)[] = ['first_name', 'last_name', 'company', 'demo_link', 'custom1']

export function render(template: string, vars: Vars, opts?: { footer?: string }): string {
  let out = template
  for (const k of KNOWN) {
    out = out.replaceAll(`{${k}}`, vars[k] ?? '')
  }
  if (opts?.footer && !out.includes(opts.footer.trim())) out += opts.footer
  return out
}
```

- [ ] **Step 4: Re-run tests — expect PASS**

```bash
cd supabase/functions && deno test --allow-all _tests/templates_test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions
git commit -m "feat(fn): template rendering + tests"
```

### Task 4.4: SMTP wrapper (denomailer)

**Files:**
- Create: `supabase/functions/send-tick/smtp.ts`
- Create: `supabase/functions/_tests/smtp_dryrun_test.ts`

- [ ] **Step 1: Write `smtp.ts`**

```ts
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export type SmtpCreds = {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
}

export type SendOptions = {
  to: string
  subject: string
  body: string
  inReplyTo?: string  // Message-ID of previous email in thread
  references?: string  // chain of Message-IDs
}

export type SendResult = { messageId: string }

export async function sendEmail(creds: SmtpCreds, opts: SendOptions): Promise<SendResult> {
  const client = new SMTPClient({
    connection: {
      hostname: creds.host,
      port: creds.port,
      tls: creds.port === 465,
      auth: { username: creds.username, password: creds.password },
    },
  })

  const messageId = `<${crypto.randomUUID()}@${creds.fromEmail.split('@')[1]}>`
  const headers: Record<string, string> = { 'Message-ID': messageId }
  if (opts.inReplyTo) headers['In-Reply-To'] = opts.inReplyTo
  if (opts.references) headers['References'] = opts.references

  try {
    await client.send({
      from: `${creds.fromName} <${creds.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      content: opts.body,
      headers,
    })
    return { messageId }
  } finally {
    await client.close()
  }
}
```

- [ ] **Step 2: Dry-run test (no actual send, just import check)**

`supabase/functions/_tests/smtp_dryrun_test.ts`:
```ts
import { sendEmail } from '../send-tick/smtp.ts'
Deno.test('sendEmail module imports', () => {
  if (typeof sendEmail !== 'function') throw new Error('sendEmail not exported')
})
```

```bash
cd supabase/functions && deno test --allow-all _tests/smtp_dryrun_test.ts
```

Expected: PASS.

- [ ] **Step 3: (Optional) Manual SMTP test with Mailtrap**

Set `MAILTRAP_HOST`, `MAILTRAP_USER`, `MAILTRAP_PASS` env vars, run a small script that calls `sendEmail`. Verify in Mailtrap inbox.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions
git commit -m "feat(fn): SMTP wrapper"
```

### Task 4.5: DB helpers (Edge Function shared)

**Files:**
- Create: `supabase/functions/_shared/db.ts`

- [ ] **Step 1: Write helper**

```ts
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function decryptSecret(db: SupabaseClient, cipher: Uint8Array): Promise<string> {
  const { data, error } = await db.rpc('decrypt_secret_b64', { cipher_b64: btoa(String.fromCharCode(...cipher)) })
  if (error) throw error
  return data as string
}
```

Note: we need a base64-friendly wrapper in SQL since Edge Functions return bytea as base64. **Must be in `public` schema** so supabase-js `db.rpc()` can call it.

`supabase/migrations/0006_decrypt_b64.sql`:
```sql
create or replace function public.decrypt_secret_b64(cipher_b64 text)
returns text language plpgsql security definer as $$
begin
  return private.decrypt_secret(decode(cipher_b64, 'base64'));
end$$;
revoke all on function public.decrypt_secret_b64(text) from public, anon, authenticated;
grant execute on function public.decrypt_secret_b64(text) to service_role;
```

- [ ] **Step 2: Apply migration**

```bash
supabase migration up
```

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(fn): db admin client + decrypt helper"
```

### Task 4.6: Send-tick orchestrator (the main loop)

**Files:**
- Create: `supabase/functions/send-tick/index.ts`

- [ ] **Step 1: Write `index.ts`**

```ts
import { adminClient, decryptSecret } from '../_shared/db.ts'
import { sendEmail, type SmtpCreds } from './smtp.ts'
import { render, type Vars } from './templates.ts'

const FOOTER = '\n\n—\nLoggic Outreach. Pour ne plus recevoir d\'emails: mailto:olivier+unsub@logiccsupplies.ca?subject=unsubscribe'

Deno.serve(async () => {
  const db = adminClient()
  const startedAt = new Date()

  // 1. Fetch all active mailboxes
  const { data: mailboxes, error: mbErr } = await db.from('mailboxes').select('*').eq('status', 'active')
  if (mbErr) return new Response(`mailbox fetch: ${mbErr.message}`, { status: 500 })

  const results: Record<string, number> = {}

  for (const mb of mailboxes ?? []) {
    // 2. Daily limit check: count sends from this mailbox today
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
    const { count: sentToday } = await db.from('sends').select('id', { count: 'exact', head: true })
      .eq('mailbox_id', mb.id).gte('sent_at', todayStart.toISOString()).eq('status', 'sent')

    // Use campaign's per-user daily limit (use any active campaign's schedule — they share).
    const { data: anyActive } = await db.from('campaigns').select('schedule').eq('status', 'active').limit(1).maybeSingle()
    const limit = (anyActive?.schedule as any)?.daily_limit_per_user ?? 20
    if ((sentToday ?? 0) >= limit) { results[mb.email] = 0; continue }

    // 3. Schedule window check (hours/days)
    const schedule = (anyActive?.schedule as any) ?? { days: ['mon','tue','wed','thu','fri'], start_hour: 8, end_hour: 17, timezone: 'America/Toronto' }
    if (!isWithinSchedule(schedule)) { results[mb.email] = 0; continue }

    // 4. Pick ONE lead that is due, belonging to an active campaign, not yet assigned to a different mailbox.
    const { data: leads } = await db.from('leads')
      .select('*, campaigns!inner(status)')
      .in('status', ['queued', 'in_progress'])
      .lte('next_send_at', startedAt.toISOString())
      .eq('campaigns.status', 'active')
      .or(`mailbox_id.is.null,mailbox_id.eq.${mb.id}`)
      .limit(1)

    const lead = leads?.[0]
    if (!lead) { results[mb.email] = 0; continue }

    // 5. Fetch the step to send
    const { data: step } = await db.from('sequence_steps').select('*')
      .eq('campaign_id', lead.campaign_id).eq('step_order', lead.current_step).single()
    if (!step) {
      await db.from('leads').update({ status: 'completed' }).eq('id', lead.id)
      continue
    }

    // 6. Decrypt SMTP creds
    const smtpPass = await decryptSecret(db, mb.smtp_pass_encrypted as Uint8Array)
    const creds: SmtpCreds = {
      host: mb.smtp_host, port: mb.smtp_port,
      username: mb.smtp_user, password: smtpPass,
      fromEmail: mb.email, fromName: mb.display_name,
    }

    const vars: Vars = {
      first_name: lead.first_name ?? '',
      last_name: lead.last_name ?? '',
      company: lead.company ?? '',
      demo_link: lead.demo_link ?? '',
      custom1: lead.custom1 ?? '',
    }
    const subject = render(step.subject_template, vars)
    const body = render(step.body_template, vars, { footer: FOOTER })

    // 7. Threading: if this is a follow-up, reuse prior subject and reference Message-ID.
    let finalSubject = subject
    let inReplyTo: string | undefined
    let references: string | undefined
    if (lead.current_step > 0 && lead.thread_message_id) {
      finalSubject = lead.last_subject?.startsWith('Re: ') ? lead.last_subject : `Re: ${lead.last_subject ?? subject}`
      inReplyTo = lead.thread_message_id
      references = lead.thread_message_id
    }

    // 8. Send.
    try {
      const { messageId } = await sendEmail(creds, { to: lead.email, subject: finalSubject, body, inReplyTo, references })
      await db.from('sends').insert({ lead_id: lead.id, step_id: step.id, mailbox_id: mb.id, smtp_message_id: messageId, status: 'sent' })

      // 9. Advance lead.
      const { data: nextStep } = await db.from('sequence_steps').select('delay_days').eq('campaign_id', lead.campaign_id).eq('step_order', lead.current_step + 1).maybeSingle()
      const jitter = (3 + Math.random() * 5) * 60 * 1000  // 3-8 min in ms
      const nextSendAt = nextStep ? new Date(Date.now() + nextStep.delay_days * 86400000 + jitter) : null
      await db.from('leads').update({
        status: nextStep ? 'in_progress' : 'completed',
        current_step: lead.current_step + 1,
        next_send_at: nextSendAt?.toISOString() ?? null,
        mailbox_id: mb.id,
        thread_message_id: lead.thread_message_id ?? messageId,
        last_subject: finalSubject,
      }).eq('id', lead.id)

      // 10. ALSO bump next_send_at on OTHER queued leads for this mailbox to jitter them.
      await db.rpc('jitter_next_for_mailbox', { p_mailbox_id: mb.id, p_jitter_seconds: 180 + Math.floor(Math.random() * 300) })
        .catch(() => {}) // best effort

      results[mb.email] = 1
    } catch (e) {
      await db.from('sends').insert({ lead_id: lead.id, step_id: step.id, mailbox_id: mb.id, status: 'failed', error_text: String(e) })
      await db.from('leads').update({ status: 'failed' }).eq('id', lead.id)
      results[mb.email] = -1
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), { headers: { 'content-type': 'application/json' } })
})

function isWithinSchedule(s: { days: string[], start_hour: number, end_hour: number, timezone: string }): boolean {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, weekday: 'short', hour: 'numeric', hour12: false })
  const parts = fmt.formatToParts(now)
  const day = (parts.find(p => p.type === 'weekday')?.value ?? '').toLowerCase()
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  if (!s.days.includes(day)) return false
  return hour >= s.start_hour && hour < s.end_hour
}
```

- [ ] **Step 2: Add the jitter helper RPC**

`supabase/migrations/0007_jitter_rpc.sql`:
```sql
create or replace function public.jitter_next_for_mailbox(p_mailbox_id uuid, p_jitter_seconds int)
returns void language plpgsql security definer as $$
begin
  update public.leads
  set next_send_at = greatest(now() + (p_jitter_seconds || ' seconds')::interval, next_send_at)
  where mailbox_id = p_mailbox_id
    and status in ('queued','in_progress')
    and next_send_at <= now();
end$$;
grant execute on function public.jitter_next_for_mailbox(uuid, int) to service_role;
```

```bash
supabase migration up
```

- [ ] **Step 3: Deploy function locally and invoke**

```bash
supabase functions serve send-tick --no-verify-jwt
# In another terminal:
curl -i -X POST http://localhost:54321/functions/v1/send-tick \
  -H "Authorization: Bearer $(supabase status -o json | jq -r .ANON_KEY)"
```

Expected: 200 with `{"ok":true,"results":{...}}`. With no due leads, results is empty.

- [ ] **Step 4: End-to-end manual test**

1. Set up a mailbox via Settings (Task 6.x) — or directly call `upsert_mailbox` with Mailtrap creds.
2. Create a campaign with 2 steps (delay 0 + delay 0 for fast test).
3. Activate it.
4. Insert 1 lead manually.
5. Call `send-tick`. Verify email arrives in Mailtrap, `sends` table has a row, lead advanced to step 1.
6. Call `send-tick` again. Verify second email arrives, threading headers present (`In-Reply-To`).
7. Verify `lead.status = 'completed'` after both steps.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(fn): send-tick orchestrator"
```

### Task 4.7: Schedule send-tick as cron

**Files:**
- Modify: `supabase/config.toml` (cron config)

- [ ] **Step 1: Add cron schedule via SQL**

`supabase/migrations/0008_cron.sql`:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run send-tick every 2 minutes.
select cron.schedule(
  'send-tick',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/send-tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
  $$
);
```

Set the runtime settings (in Studio SQL editor or via secrets):
```sql
alter database postgres set app.functions_url to 'https://YOUR_PROJECT.supabase.co/functions/v1';
alter database postgres set app.service_role_key to 'YOUR_SERVICE_ROLE_KEY';
```

⚠ On local dev, replace with `http://host.docker.internal:54321/functions/v1`.

- [ ] **Step 2: Verify**

```sql
select * from cron.job;  -- should show send-tick row
select * from cron.job_run_details order by start_time desc limit 5;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_cron.sql
git commit -m "feat(db): cron schedule for send-tick"
```

---

## Phase 5 — IMAP Poll (Reply + Bounce Detection)

But: Edge Function `imap-poll` qui détecte les réponses et marque les leads.

### Task 5.1: IMAP wrapper (Deno)

**Files:**
- Create: `supabase/functions/imap-poll/imap.ts`
- Create: `supabase/functions/_tests/imap_dryrun_test.ts`

- [ ] **Step 1: Choose library**

Use `https://deno.land/x/imapjs` (or `https://esm.sh/imapflow@1` via Node compat — Supabase Edge Runtime supports it). Validate import works.

- [ ] **Step 2: Write `imap.ts`**

```ts
// @ts-ignore
import { ImapFlow } from 'https://esm.sh/imapflow@1.0.158'

export type ImapCreds = {
  host: string
  port: number
  username: string
  password: string
}

export type NewMessage = {
  uid: number
  subject: string
  inReplyTo: string | null
  references: string[]
  from: string
  snippet: string
}

export async function fetchNewMessages(creds: ImapCreds, sinceUid: number): Promise<NewMessage[]> {
  const client = new ImapFlow({
    host: creds.host, port: creds.port, secure: creds.port === 993,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  })
  await client.connect()
  const lock = await client.getMailboxLock('INBOX')
  const results: NewMessage[] = []
  try {
    const range = `${sinceUid + 1}:*`
    for await (const msg of client.fetch(range, { envelope: true, source: false, bodyStructure: false, uid: true })) {
      if (!msg.envelope) continue
      results.push({
        uid: Number(msg.uid),
        subject: msg.envelope.subject ?? '',
        inReplyTo: msg.envelope.inReplyTo ?? null,
        references: (msg.envelope as any).references ?? [],
        from: msg.envelope.from?.[0]?.address ?? '',
        snippet: msg.envelope.subject ?? '',  // header-only for now
      })
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return results
}
```

- [ ] **Step 3: Dry-run import test**

`supabase/functions/_tests/imap_dryrun_test.ts`:
```ts
import { fetchNewMessages } from '../imap-poll/imap.ts'
Deno.test('imap module imports', () => {
  if (typeof fetchNewMessages !== 'function') throw new Error('not exported')
})
```

```bash
cd supabase/functions && deno test --allow-all _tests/imap_dryrun_test.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions
git commit -m "feat(fn): IMAP wrapper"
```

### Task 5.2: Threading matcher

**Files:**
- Create: `supabase/functions/imap-poll/threading.ts`
- Create: `supabase/functions/_tests/threading_test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { extractThreadIds, isBounce } from '../imap-poll/threading.ts'

Deno.test('extracts thread message ids from In-Reply-To + References', () => {
  const ids = extractThreadIds({ inReplyTo: '<abc@logiccsupplies.ca>', references: ['<def@x.com>', '<abc@logiccsupplies.ca>'] })
  assertEquals(ids.includes('<abc@logiccsupplies.ca>'), true)
})

Deno.test('detects bounce by subject', () => {
  assertEquals(isBounce('Delivery Status Notification (Failure)', ''), true)
  assertEquals(isBounce('Mail Delivery Failed', ''), true)
  assertEquals(isBounce('Hey there', ''), false)
})

Deno.test('detects bounce by from address', () => {
  assertEquals(isBounce('Re: foo', 'mailer-daemon@spacemail.com'), true)
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd supabase/functions && deno test --allow-all _tests/threading_test.ts
```

- [ ] **Step 3: Implement `threading.ts`**

```ts
export type MessageHeaders = { inReplyTo: string | null, references: string[] }

export function extractThreadIds(h: MessageHeaders): string[] {
  const ids = new Set<string>()
  if (h.inReplyTo) ids.add(h.inReplyTo.trim())
  for (const r of h.references) if (r) ids.add(r.trim())
  return [...ids]
}

const BOUNCE_SUBJECTS = [
  'delivery status notification',
  'mail delivery failed',
  'undeliverable',
  'returned mail',
  'delivery failure',
]

const BOUNCE_FROMS = ['mailer-daemon', 'postmaster', 'no-reply', 'bounces']

export function isBounce(subject: string, from: string): boolean {
  const s = subject.toLowerCase()
  if (BOUNCE_SUBJECTS.some(b => s.includes(b))) return true
  const f = from.toLowerCase()
  if (BOUNCE_FROMS.some(b => f.startsWith(b))) return true
  return false
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add supabase/functions
git commit -m "feat(fn): threading matcher + tests"
```

### Task 5.3: IMAP poll orchestrator

**Files:**
- Create: `supabase/functions/imap-poll/index.ts`

- [ ] **Step 1: Write `index.ts`**

```ts
import { adminClient, decryptSecret } from '../_shared/db.ts'
import { fetchNewMessages, type ImapCreds } from './imap.ts'
import { extractThreadIds, isBounce } from './threading.ts'

Deno.serve(async () => {
  const db = adminClient()
  const { data: mailboxes } = await db.from('mailboxes').select('*').eq('status', 'active')
  const summary: Record<string, { processed: number, replies: number, bounces: number, error?: string }> = {}

  for (const mb of mailboxes ?? []) {
    summary[mb.email] = { processed: 0, replies: 0, bounces: 0 }
    try {
      const pass = await decryptSecret(db, mb.imap_pass_encrypted as Uint8Array)
      const creds: ImapCreds = { host: mb.imap_host, port: mb.imap_port, username: mb.smtp_user, password: pass }
      const msgs = await fetchNewMessages(creds, Number(mb.last_imap_uid_seen))
      let maxUid = Number(mb.last_imap_uid_seen)
      for (const m of msgs) {
        maxUid = Math.max(maxUid, m.uid)
        summary[mb.email].processed++
        const threadIds = extractThreadIds({ inReplyTo: m.inReplyTo, references: m.references })
        if (threadIds.length === 0 && !isBounce(m.subject, m.from)) continue
        // Match to a lead.
        const { data: lead } = await db.from('leads').select('id, status').in('thread_message_id', threadIds.length > 0 ? threadIds : ['__none__']).maybeSingle()
        if (lead && lead.status !== 'replied' && lead.status !== 'bounced') {
          if (isBounce(m.subject, m.from)) {
            await db.from('leads').update({ status: 'bounced' }).eq('id', lead.id)
            summary[mb.email].bounces++
          } else {
            await db.from('leads').update({ status: 'replied' }).eq('id', lead.id)
            summary[mb.email].replies++
          }
          await db.from('replies').insert({ lead_id: lead.id, mailbox_id: mb.id, imap_uid: m.uid, snippet: m.subject })
        }
      }
      await db.from('mailboxes').update({ last_imap_uid_seen: maxUid, last_error: null }).eq('id', mb.id)
    } catch (e) {
      summary[mb.email].error = String(e)
      await db.from('mailboxes').update({ last_error: String(e) }).eq('id', mb.id)
    }
  }
  return new Response(JSON.stringify({ ok: true, summary }), { headers: { 'content-type': 'application/json' } })
})
```

- [ ] **Step 2: Deploy locally and smoke**

```bash
supabase functions serve imap-poll --no-verify-jwt
curl -i -X POST http://localhost:54321/functions/v1/imap-poll \
  -H "Authorization: Bearer $(supabase status -o json | jq -r .ANON_KEY)"
```

Expected: 200, summary returned. With a real Mailtrap inbox seeded with a "reply" to a known Message-ID, lead status flips to `replied`.

- [ ] **Step 3: Schedule cron (10 min)**

Add to `supabase/migrations/0008_cron.sql` (or new migration `0009_imap_cron.sql`):
```sql
select cron.schedule(
  'imap-poll',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/imap-poll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
  $$
);
```

```bash
supabase migration up
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(fn): IMAP poll for replies + bounces"
```

---

## Phase 6 — Settings + Dashboard

### Task 6.1: Settings page (mailbox config + schedule)

**Files:**
- Create: `web/src/pages/Settings.tsx`
- Modify: `web/src/lib/api.ts`, `web/src/App.tsx`

- [ ] **Step 1: Add API**

In `web/src/lib/api.ts`:
```ts
export const settingsApi = {
  upsertMailbox: async (input: {
    display_name: string, email: string,
    smtp_host: string, smtp_port: number, smtp_user: string, smtp_pass: string,
    imap_host: string, imap_port: number, imap_pass: string,
  }) => {
    const { data, error } = await supabase.rpc('upsert_mailbox', {
      p_display_name: input.display_name,
      p_email: input.email,
      p_smtp_host: input.smtp_host,
      p_smtp_port: input.smtp_port,
      p_smtp_user: input.smtp_user,
      p_smtp_pass: input.smtp_pass,
      p_imap_host: input.imap_host,
      p_imap_port: input.imap_port,
      p_imap_pass: input.imap_pass,
    })
    if (error) throw error
    return data
  },
}
```

- [ ] **Step 2: Create `Settings.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailboxesApi, settingsApi } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Settings() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const { data: mb } = useQuery({ queryKey: ['mailbox', session?.user.id], queryFn: () => mailboxesApi.mine(session!.user.id), enabled: !!session })
  const [form, setForm] = useState({
    display_name: '', email: session?.user.email ?? '',
    smtp_host: 'mail.spacemail.com', smtp_port: 587, smtp_user: session?.user.email ?? '', smtp_pass: '',
    imap_host: 'mail.spacemail.com', imap_port: 993, imap_pass: '',
  })
  const save = useMutation({
    mutationFn: () => settingsApi.upsertMailbox(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailbox'] }),
  })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <section className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Ta mailbox d'envoi</h2>
        {mb && <p className="text-xs text-green-600 mb-3">✓ Configurée: {mb.email}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label>Nom affiché<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} placeholder="Olivier Martel"/></label>
          <label>Email<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email"/></label>
          <label>SMTP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.smtp_host} onChange={e => setForm({...form, smtp_host: e.target.value})}/></label>
          <label>SMTP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={form.smtp_port} onChange={e => setForm({...form, smtp_port: Number(e.target.value)})}/></label>
          <label>SMTP user<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.smtp_user} onChange={e => setForm({...form, smtp_user: e.target.value})}/></label>
          <label>SMTP password<input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={form.smtp_pass} onChange={e => setForm({...form, smtp_pass: e.target.value})}/></label>
          <label>IMAP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.imap_host} onChange={e => setForm({...form, imap_host: e.target.value})}/></label>
          <label>IMAP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={form.imap_port} onChange={e => setForm({...form, imap_port: Number(e.target.value)})}/></label>
          <label className="col-span-2">IMAP password<input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={form.imap_pass} onChange={e => setForm({...form, imap_pass: e.target.value})}/></label>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 bg-slate-900 text-white text-sm px-4 py-2 rounded">{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {save.isError && <p className="text-red-600 text-xs mt-2">{String(save.error)}</p>}
        {save.isSuccess && <p className="text-green-600 text-xs mt-2">Sauvegardé ✓</p>}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add route + smoke test**

```tsx
import Settings from './pages/Settings'
<Route path="/settings" element={<Protected><Settings /></Protected>} />
```

Smoke: ouvre /settings, sauvegarde Mailtrap creds, vérifie en SQL `select email, smtp_pass_encrypted from mailboxes;` (le mot de passe doit être bytea encodé, pas en clair).

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): settings page for mailbox creds"
```

### Task 6.2: Dashboard with real stats

**Files:**
- Modify: `web/src/pages/Dashboard.tsx`, `web/src/lib/api.ts`

- [ ] **Step 1: Add stats API**

```ts
export const statsApi = {
  overview: async () => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const [sentToday, repliesWeek, queue] = await Promise.all([
      supabase.from('sends').select('id', { count: 'exact', head: true }).gte('sent_at', todayStart.toISOString()).eq('status', 'sent'),
      supabase.from('replies').select('id', { count: 'exact', head: true }).gte('detected_at', weekAgo.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['queued','in_progress']),
    ])
    const totalSent = (await supabase.from('sends').select('id', { count: 'exact', head: true }).eq('status','sent')).count ?? 0
    const totalReplies = (await supabase.from('replies').select('id', { count: 'exact', head: true })).count ?? 0
    return {
      sentToday: sentToday.count ?? 0,
      repliesWeek: repliesWeek.count ?? 0,
      queue: queue.count ?? 0,
      replyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
    }
  },
}
```

- [ ] **Step 2: Rewrite `Dashboard.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../lib/api'

const cards = [
  { key: 'sentToday', label: 'Envoyés aujourd\'hui', fmt: (n: number) => String(n) },
  { key: 'repliesWeek', label: 'Réponses 7j', fmt: (n: number) => String(n), color: 'text-green-600' },
  { key: 'queue', label: 'En queue', fmt: (n: number) => String(n) },
  { key: 'replyRate', label: 'Taux de réponse', fmt: (n: number) => `${n.toFixed(1)}%` },
] as const

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: statsApi.overview, refetchInterval: 30000 })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Vue d'ensemble</h1>
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key} className="bg-white border rounded-xl p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`text-2xl font-bold mt-1 ${'color' in c ? (c.color as string) : ''}`}>{data ? c.fmt(data[c.key]) : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Smoke + Commit**

```bash
git add web/src
git commit -m "feat(web): dashboard with real stats"
```

---

## Phase 7 — Deploy + Polish

### Task 7.1: Deploy Supabase to prod

**Files:**
- Modify: `supabase/config.toml` (project ref)

- [ ] **Step 1: Create Supabase project**

Via dashboard at supabase.com: create project `loggic-outreach`, region `ca-central-1` (Montréal). Note URL + service_role key.

- [ ] **Step 2: Link local to remote**

```bash
cd ~/Desktop/loggic-outreach
supabase link --project-ref YOUR_REF
supabase db push  # applies all migrations
```

- [ ] **Step 3: Set encryption key on prod**

In Supabase Studio → SQL editor:
```sql
alter database postgres set app.encryption_key to '<generated key>';
alter database postgres set app.functions_url to 'https://YOUR_REF.supabase.co/functions/v1';
alter database postgres set app.service_role_key to '<service_role_key>';
```

- [ ] **Step 4: Deploy functions**

```bash
supabase functions deploy send-tick --no-verify-jwt
supabase functions deploy imap-poll --no-verify-jwt
```

- [ ] **Step 5: Verify cron jobs scheduled**

```sql
select jobname, schedule, active from cron.job;
```

Both `send-tick` and `imap-poll` should be active.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "chore: link to prod project"
```

### Task 7.2: Deploy frontend to Vercel

- [ ] **Step 1: Push repo to GitHub**

```bash
gh repo create olimartel6/loggic-outreach --private --source=. --remote=origin --push
```

- [ ] **Step 2: Import in Vercel**

vercel.com → New Project → Import GitHub repo. Set root dir = `web/`. Add env vars:
- `VITE_SUPABASE_URL` = https://YOUR_REF.supabase.co
- `VITE_SUPABASE_ANON_KEY` = prod anon key

Deploy.

- [ ] **Step 3: Set custom domain**

Vercel project → Domains → add `outreach.logiccsupplies.ca`. Update DNS at Spaceship: CNAME `outreach` → `cname.vercel-dns.com`.

- [ ] **Step 4: Configure Supabase Auth redirect URLs**

Supabase Studio → Auth → URL Configuration:
- Site URL: `https://outreach.logiccsupplies.ca`
- Redirect URLs: add `https://outreach.logiccsupplies.ca/*`

- [ ] **Step 5: End-to-end prod smoke**

1. Visit https://outreach.logiccsupplies.ca → see login.
2. Magic link to olivier@logiccsupplies.ca → land on dashboard.
3. Settings → enter real Spacemail creds → save.
4. Create campaign "Test prod", 1 step, subject "Test {first_name}", body "Hi {first_name}".
5. Import CSV with 1 lead = your secondary email.
6. Activate campaign.
7. Wait 2-4 min → email arrives in inbox.
8. Reply to it → wait 10 min → check Leads page, status = "Réponse".

- [ ] **Step 6: Commit**

```bash
git add . && git commit --allow-empty -m "chore: prod deployed"
```

### Task 7.3: Cutover doc + cancel Instantly

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with prod URLs + runbook**

Add sections: "URLs", "How to add a user (whitelist)", "How to rotate encryption key", "How to debug send-tick (check `cron.job_run_details` and Edge Function logs in Supabase dashboard)".

- [ ] **Step 2: Run 2-week parallel (Instantly + Loggic Outreach)**

Track in a simple sheet: how many sends, how many replies, any deliverability issues.

- [ ] **Step 3: Cancel Instantly subscription after 2 successful weeks**

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: runbook + cutover plan"
```

---

## Self-Review checklist for the implementer

Before declaring "done":

1. **Spec coverage:**
   - ✅ Auth magic link + whitelist → Task 1.4 + 1.6
   - ✅ DB schema → 1.3, 4.1, 4.2
   - ✅ Campaigns + steps CRUD → 2.3, 2.4
   - ✅ Variables → 4.3
   - ✅ CSV import → 3.1, 3.2
   - ✅ Lead manuel → covered via `insertOne` in 3.2
   - ✅ Stop-on-reply → 5.3
   - ✅ Bounce detection → 5.2, 5.3
   - ✅ Horaire/limite quotidienne → 4.6 (`isWithinSchedule`, daily limit query)
   - ✅ Dashboard → 6.2
   - ✅ Leads view + filters → 3.3
   - ✅ Settings → 6.1
   - ✅ Chiffrement → 4.1, 4.2
   - ✅ Coût $0 → free tiers; verify in 7.1-7.2
   - ✅ 2 semaines délai → Phases 1-7 ≈ 2 semaines focus

2. **Hors-scope respecté:** pas de warmup, pas d'unibox, pas d'A/B, pas d'AI gen, pas d'opens/clicks tracking.

3. **TDD:** chaque module testable (templates, threading, SMTP, IMAP) a un test Deno.

4. **Tests à exécuter avant cutover:**
   - `npm --workspace web run build` (frontend compile)
   - `deno test --allow-all` dans `supabase/functions/`
   - Manual end-to-end via Mailtrap (Task 4.6 step 4) puis prod (Task 7.2 step 5).
