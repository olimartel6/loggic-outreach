create table public.dm_drafts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_email text,
  business_handle text,
  business_url text,
  channel text not null check (channel in ('instagram','messenger','linkedin','other')),
  draft_text text not null,
  status text not null default 'pending' check (status in ('pending','sent','skipped')),
  submitted_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.dm_drafts enable row level security;
create policy "auth users all on dm_drafts" on public.dm_drafts for all to authenticated using (true) with check (true);

create index dm_drafts_status_idx on public.dm_drafts(status, created_at desc);

-- Extend the contacted_domains view to include DM drafts (sent ones)
create or replace view public.contacted_domains as
select distinct lower(split_part(email, '@', 2)) as domain
from public.leads
where email is not null and email ~ '@'
union
select distinct lower(split_part(business_email, '@', 2)) as domain
from public.dm_drafts
where status = 'sent' and business_email is not null and business_email ~ '@'
union
select distinct lower(regexp_replace(business_url, '^https?://(www\.)?([^/]+).*$', '\2'))
from public.dm_drafts
where status = 'sent' and business_url is not null and business_url ~ 'https?://'
order by 1;
