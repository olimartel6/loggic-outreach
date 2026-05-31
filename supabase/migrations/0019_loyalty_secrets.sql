-- Loyalty SaaS connection so Edge Functions can write to loyalty_businesses for auto-demo creation.
-- Real values are seeded out-of-band via `update private.app_secrets ...`
-- (the keys 'loyalty_url' and 'loyalty_service_role_key' MUST be populated before /build-demos works).
insert into private.app_secrets (key, value)
values
  ('loyalty_url', ''),
  ('loyalty_service_role_key', '')
on conflict (key) do nothing;

-- Expose private.app_secrets to service_role via a public view so Edge Functions can read via PostgREST.
create or replace view public.app_secrets as
select key, value from private.app_secrets;

revoke all on public.app_secrets from public, anon, authenticated;
grant select on public.app_secrets to service_role;
