-- Extend upsert_mailbox RPC with p_daily_limit (defaults to 20). Drop old signature first.
drop function if exists public.upsert_mailbox(text, text, text, int, text, text, text, int, text, text);

create or replace function public.upsert_mailbox(
  p_display_name text,
  p_email text,
  p_smtp_host text,
  p_smtp_port int,
  p_smtp_user text,
  p_smtp_pass text,
  p_imap_host text,
  p_imap_port int,
  p_imap_user text,
  p_imap_pass text,
  p_daily_limit int default 20
) returns uuid language plpgsql security definer as $$
declare m_id uuid;
begin
  insert into public.mailboxes (
    user_id, display_name, email, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
    imap_host, imap_port, imap_user, imap_pass_encrypted, daily_limit
  ) values (
    auth.uid(), p_display_name, p_email, p_smtp_host, p_smtp_port, p_smtp_user, private.encrypt_secret(p_smtp_pass),
    p_imap_host, p_imap_port, p_imap_user, private.encrypt_secret(p_imap_pass), p_daily_limit
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    smtp_host = excluded.smtp_host,
    smtp_port = excluded.smtp_port,
    smtp_user = excluded.smtp_user,
    smtp_pass_encrypted = excluded.smtp_pass_encrypted,
    imap_host = excluded.imap_host,
    imap_port = excluded.imap_port,
    imap_user = excluded.imap_user,
    imap_pass_encrypted = excluded.imap_pass_encrypted,
    daily_limit = excluded.daily_limit,
    updated_at = now()
  returning id into m_id;
  return m_id;
end$$;

grant execute on function public.upsert_mailbox(text,text,text,int,text,text,text,int,text,text,int) to authenticated;
