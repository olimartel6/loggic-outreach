-- Ensure leads.updated_at is bumped on every row change.
-- imap-poll updates status='bounced' but didn't touch updated_at — daily-summary missed bounces.
create or replace function private.bump_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists leads_bump_updated_at on public.leads;
create trigger leads_bump_updated_at
  before update on public.leads
  for each row execute function private.bump_updated_at();

-- Also bump for mailboxes — same risk (status changes without bumping updated_at).
drop trigger if exists mailboxes_bump_updated_at on public.mailboxes;
create trigger mailboxes_bump_updated_at
  before update on public.mailboxes
  for each row execute function private.bump_updated_at();
