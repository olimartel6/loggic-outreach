drop function if exists public.decrypt_secret_b64(text);

-- PostgREST returns bytea as hex-encoded string ("\x..."). Accept hex directly.
create or replace function public.decrypt_secret_hex(cipher_hex text)
returns text language plpgsql security definer as $$
declare
  raw_hex text;
begin
  -- Strip leading "\x" if present (PostgREST format), then decode.
  raw_hex := case when cipher_hex like '\x%' then substr(cipher_hex, 3) else cipher_hex end;
  return private.decrypt_secret(decode(raw_hex, 'hex'));
end$$;

-- Test helper: returns encrypted bytea as hex for round-trip tests. Service role only.
create or replace function public.test_encrypt_helper(plain text)
returns text language plpgsql security definer as $$
begin
  return encode(private.encrypt_secret(plain), 'hex');
end$$;

revoke all on function public.decrypt_secret_hex(text) from public, anon, authenticated;
grant execute on function public.decrypt_secret_hex(text) to service_role;

revoke all on function public.test_encrypt_helper(text) from public, anon, authenticated;
grant execute on function public.test_encrypt_helper(text) to service_role;
