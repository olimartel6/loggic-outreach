-- Audit log captures who/when/what for key mutations. Lightweight (no payload-heavy details).
create table public.audit_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  user_id uuid,
  user_email text,
  action text not null check (action in ('insert','update','delete')),
  target_table text not null,
  target_id text,
  details jsonb
);

create index audit_log_ts_idx on public.audit_log (ts desc);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

alter table public.audit_log enable row level security;
create policy "auth users read audit_log" on public.audit_log for select to authenticated using (true);
-- inserts come from triggers (security definer) — no direct user writes

-- Generic audit trigger function. Captures the action + the row's primary key + minimal details.
create or replace function private.audit_trigger() returns trigger language plpgsql security definer as $$
declare
  v_user_email text;
  v_target_id text;
begin
  begin
    select email into v_user_email from auth.users where id = auth.uid();
  exception when others then v_user_email := null;
  end;

  if tg_op = 'INSERT' then v_target_id := new.id::text;
  elsif tg_op = 'UPDATE' then v_target_id := new.id::text;
  elsif tg_op = 'DELETE' then v_target_id := old.id::text;
  end if;

  insert into public.audit_log (user_id, user_email, action, target_table, target_id, details)
  values (
    auth.uid(),
    v_user_email,
    lower(tg_op),
    tg_table_name,
    v_target_id,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object(
        'changed',
        (select jsonb_object_agg(key, value)
         from jsonb_each(to_jsonb(new))
         where to_jsonb(new) -> key is distinct from to_jsonb(old) -> key)
      )
      when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
    end
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end$$;

-- Attach to tables of interest
create trigger audit_campaigns_trg after insert or update or delete on public.campaigns for each row execute function private.audit_trigger();
create trigger audit_sequence_steps_trg after insert or update or delete on public.sequence_steps for each row execute function private.audit_trigger();
create trigger audit_mailboxes_trg after insert or update or delete on public.mailboxes for each row execute function private.audit_trigger();
-- leads: skip for now — too high-volume (every bulk insert = N rows). If wanted later, filter to status changes only.

-- Heartbeat RPC for healthcheck: send-tick calls this on each invocation so the healthcheck endpoint
-- can verify the cron is firing. We write to private.app_secrets directly (the public view is read-only).
create or replace function public.heartbeat_send_tick()
returns void language plpgsql security definer as $$
begin
  insert into private.app_secrets (key, value)
  values ('last_send_tick_at', now()::text)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end$$;
revoke all on function public.heartbeat_send_tick() from public, anon, authenticated;
grant execute on function public.heartbeat_send_tick() to service_role;

-- Daily summary cron at 22:00 UTC (18:00 EDT / 17:00 EST). Hits the Edge Function.
select cron.schedule(
  'daily-summary',
  '0 22 * * *',
  $$
  select net.http_post(
    url := private.get_secret('functions_url') || '/daily-summary',
    headers := jsonb_build_object('Authorization', 'Bearer ' || private.get_secret('service_role_key'))
  );
  $$
);
