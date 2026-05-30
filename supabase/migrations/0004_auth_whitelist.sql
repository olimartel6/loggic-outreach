-- Whitelist: only specific emails can create accounts.
-- To add a user, write a NEW migration that updates this function — do NOT edit
-- this file after it's been applied (Supabase won't re-run it).
create or replace function public.enforce_whitelist()
returns trigger language plpgsql security definer as $$
declare
  allowed_emails text[] := array['oliviermartel2006@gmail.com', 'olivier@logiccsupplies.ca', 'charles-antoine@logiccsupplies.ca'];
begin
  if new.email is null or not (new.email = any(allowed_emails)) then
    raise exception 'Email % is not authorized', new.email;
  end if;
  return new;
end$$;

drop trigger if exists enforce_whitelist_trigger on auth.users;
create trigger enforce_whitelist_trigger
  before insert on auth.users
  for each row execute function public.enforce_whitelist();
