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
