-- Dedup helper for Telegram alerts. notifyTelegram() does the hash + check;
-- this RPC just upserts the last-sent timestamp into private.app_secrets.
create or replace function public.record_alert_dedup(p_key text, p_value text)
returns void language plpgsql security definer as $$
begin
  insert into private.app_secrets (key, value)
  values (p_key, p_value)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end$$;

revoke all on function public.record_alert_dedup(text, text) from public, anon, authenticated;
grant execute on function public.record_alert_dedup(text, text) to service_role;
