-- Move app secrets out of GUC params (postgres role can't ALTER DATABASE SET app.*).
-- Store in a private table; secrets are inserted via service_role at deploy time.

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on table private.app_secrets from public, anon, authenticated;
grant select, insert, update on table private.app_secrets to service_role;

create or replace function private.get_secret(p_key text)
returns text language sql security definer stable as $$
  select value from private.app_secrets where key = p_key
$$;

revoke all on function private.get_secret(text) from public, anon, authenticated;
grant execute on function private.get_secret(text) to service_role, postgres;

-- Replace encrypt/decrypt to read from the table.
create or replace function private.encrypt_secret(plain text)
returns bytea language plpgsql security definer as $$
declare k text := private.get_secret('encryption_key');
begin
  if k is null or length(k) < 32 then raise exception 'encryption_key missing or too short'; end if;
  return pgp_sym_encrypt(plain, k);
end$$;

create or replace function private.decrypt_secret(cipher bytea)
returns text language plpgsql security definer as $$
declare k text := private.get_secret('encryption_key');
begin
  if k is null then raise exception 'encryption_key missing'; end if;
  return pgp_sym_decrypt(cipher, k);
end$$;

-- Update cron jobs to read from the table instead of GUC.
select cron.unschedule('send-tick');
select cron.unschedule('imap-poll');

select cron.schedule(
  'send-tick',
  '*/2 * * * *',
  $cron$
  select net.http_post(
    url := private.get_secret('functions_url') || '/send-tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || private.get_secret('service_role_key'))
  );
  $cron$
);

select cron.schedule(
  'imap-poll',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := private.get_secret('functions_url') || '/imap-poll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || private.get_secret('service_role_key'))
  );
  $cron$
);
