-- Extend the leads.status check constraint to allow 'draft' (Hermes-submitted, awaiting Oli/CA approval).
alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('draft','queued','in_progress','replied','bounced','completed','unsubscribed','failed'));

-- Generate a submission token for Hermes (CA's agent) to authenticate against /submit-leads.
-- Stored in app_secrets so it can be rotated without redeploying functions.
insert into private.app_secrets (key, value)
values ('submission_token', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Service-role helper: check whether a token matches the stored submission_token.
-- Done as a function so we don't have to fetch the secret to the edge function
-- and string-compare client-side.
create or replace function public.check_submission_token(p_token text)
returns boolean language plpgsql security definer as $$
begin
  return exists (select 1 from private.app_secrets where key = 'submission_token' and value = p_token);
end$$;
revoke all on function public.check_submission_token(text) from public, anon, authenticated;
grant execute on function public.check_submission_token(text) to service_role;
