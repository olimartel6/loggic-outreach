-- Per-lead custom subject/body (overrides template variables). Used when Claude Code
-- pre-personalizes emails per prospect and ships them in the CSV.
alter table public.leads
  add column custom_subject text,
  add column custom_body text;

-- Public view of distinct domains we've already loaded into a campaign.
-- Claude Code reads this to dedup new prospect lists before importing.
create or replace view public.contacted_domains as
select distinct lower(split_part(email, '@', 2)) as domain
from public.leads
order by 1;

grant select on public.contacted_domains to anon, authenticated;
