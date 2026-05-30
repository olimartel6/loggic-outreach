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
