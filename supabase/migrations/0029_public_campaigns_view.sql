-- Hermes (CA's Antigravity agent) needs to discover campaign UUIDs by name
-- before calling /submit-leads. Anon key alone can't read public.campaigns due to RLS.
-- This view exposes ONLY id+name+status — no schedule, no created_by, no other fields.

create or replace view public.campaigns_public as
select id, name, status from public.campaigns;

revoke all on public.campaigns_public from public;
grant select on public.campaigns_public to anon, authenticated;
