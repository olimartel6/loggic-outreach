-- Add Telegram alert config to app_secrets
insert into private.app_secrets (key, value) values
  ('telegram_bot_token', '8646963746:AAE5DeBHfjltwjQPv4iX0Krlpi4j-A61fH0'),
  ('telegram_alert_chat_id', '8337860528')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Concurrent-safety: unique index on (lead_id, step_id) for sent rows blocks accidental double-logs.
-- Existing sends.status='failed' rows for the same (lead_id, step_id) are allowed — they're retries.
create unique index if not exists sends_lead_step_sent_uniq
  on public.sends (lead_id, step_id)
  where status = 'sent';

-- Retry mechanism: column to track attempts
alter table public.leads
  add column if not exists retry_count int not null default 0,
  add column if not exists last_retry_at timestamptz;

-- Helper: lock & claim next lead for a mailbox (atomic, race-free)
create or replace function public.claim_next_lead(p_mailbox_id uuid, p_now timestamptz)
returns table (
  id uuid, campaign_id uuid, email text, first_name text, last_name text,
  company text, demo_link text, custom1 text, custom_subject text, custom_body text,
  status text, current_step int, next_send_at timestamptz, mailbox_id uuid,
  thread_message_id text, last_subject text, retry_count int
) language plpgsql security definer as $$
declare claimed_id uuid;
begin
  -- Atomically pick + claim the lead so concurrent send-tick runs can't double up.
  with cand as (
    select l.id
    from public.leads l
    join public.campaigns c on c.id = l.campaign_id
    where l.status in ('queued', 'in_progress')
      and l.next_send_at <= p_now
      and c.status = 'active'
      and (l.mailbox_id is null or l.mailbox_id = p_mailbox_id)
    order by l.next_send_at asc nulls first, l.created_at asc
    limit 1
    for update skip locked
  )
  update public.leads
  set mailbox_id = p_mailbox_id
  from cand
  where leads.id = cand.id
  returning leads.id into claimed_id;

  if claimed_id is null then return; end if;

  return query
    select l.id, l.campaign_id, l.email, l.first_name, l.last_name,
           l.company, l.demo_link, l.custom1, l.custom_subject, l.custom_body,
           l.status, l.current_step, l.next_send_at, l.mailbox_id,
           l.thread_message_id, l.last_subject, l.retry_count
    from public.leads l where l.id = claimed_id;
end$$;

grant execute on function public.claim_next_lead(uuid, timestamptz) to service_role;
