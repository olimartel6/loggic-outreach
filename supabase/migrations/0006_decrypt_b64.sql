create or replace function public.decrypt_secret_b64(cipher_b64 text)
returns text language plpgsql security definer as $$
begin
  return private.decrypt_secret(decode(cipher_b64, 'base64'));
end$$;
revoke all on function public.decrypt_secret_b64(text) from public, anon, authenticated;
grant execute on function public.decrypt_secret_b64(text) to service_role;
