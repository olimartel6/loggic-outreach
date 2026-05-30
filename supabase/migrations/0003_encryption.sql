create schema if not exists private;
create extension if not exists pgcrypto;

-- Server-side only: read from app.encryption_key set via supabase secrets
create or replace function private.encrypt_secret(plain text)
returns bytea language plpgsql security definer as $$
declare key text := current_setting('app.encryption_key', true);
begin
  if key is null or length(key) < 32 then raise exception 'ENCRYPTION_KEY missing or too short'; end if;
  return pgp_sym_encrypt(plain, key);
end$$;

create or replace function private.decrypt_secret(cipher bytea)
returns text language plpgsql security definer as $$
declare key text := current_setting('app.encryption_key', true);
begin
  if key is null then raise exception 'ENCRYPTION_KEY missing'; end if;
  return pgp_sym_decrypt(cipher, key);
end$$;

revoke all on function private.encrypt_secret(text) from public, anon, authenticated;
revoke all on function private.decrypt_secret(bytea) from public, anon, authenticated;
-- Only service_role (Edge Functions) can call.
grant execute on function private.encrypt_secret(text), private.decrypt_secret(bytea) to service_role;
