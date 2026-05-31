-- Atomically re-encrypt all mailbox credentials with a new key.
-- Called by scripts/rotate-encryption-key.py. Runs in a single transaction —
-- if any decrypt fails (wrong old key, corrupted ciphertext), the whole rotation rolls back.

create or replace function private.rotate_encryption_key(p_new_key text)
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  v_old_key text;
  r record;
begin
  if length(p_new_key) < 32 then raise exception 'new key must be at least 32 chars'; end if;

  select value into v_old_key from private.app_secrets where key = 'encryption_key';
  if v_old_key is null then raise exception 'no current encryption_key in app_secrets'; end if;
  if v_old_key = p_new_key then raise exception 'new key matches current key'; end if;

  for r in select id, smtp_pass_encrypted, imap_pass_encrypted from public.mailboxes loop
    update public.mailboxes
    set smtp_pass_encrypted = pgp_sym_encrypt(pgp_sym_decrypt(r.smtp_pass_encrypted, v_old_key), p_new_key),
        imap_pass_encrypted = pgp_sym_encrypt(pgp_sym_decrypt(r.imap_pass_encrypted, v_old_key), p_new_key),
        updated_at = now()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  update private.app_secrets set value = p_new_key, updated_at = now() where key = 'encryption_key';

  return v_count;
end$$;

revoke all on function private.rotate_encryption_key(text) from public, anon, authenticated;
grant execute on function private.rotate_encryption_key(text) to service_role;

create or replace function public.rotate_encryption_key(p_new_key text)
returns int language plpgsql security definer as $$
begin
  return private.rotate_encryption_key(p_new_key);
end$$;
revoke all on function public.rotate_encryption_key(text) from public, anon, authenticated;
grant execute on function public.rotate_encryption_key(text) to service_role;
