-- Bug fix: `LIKE '\x%'` in 0010 treated `\` as escape char, so the comparison
-- effectively matched `like 'x%'` and never stripped the `\x` PostgREST prefix.
-- Cipher strings then got passed to decode() with the literal backslash,
-- causing "invalid hexadecimal digit" failures in send-tick.

create or replace function public.decrypt_secret_hex(cipher_hex text)
returns text language plpgsql security definer as $$
declare raw_hex text;
begin
  raw_hex := case when starts_with(cipher_hex, '\x') then substr(cipher_hex, 3) else cipher_hex end;
  return private.decrypt_secret(decode(raw_hex, 'hex'));
end$$;

revoke all on function public.decrypt_secret_hex(text) from public, anon, authenticated;
grant execute on function public.decrypt_secret_hex(text) to service_role;
