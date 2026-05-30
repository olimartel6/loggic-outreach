-- Add imap_user column, backfill from smtp_user for existing rows, enforce NOT NULL.
alter table public.mailboxes add column imap_user text;
update public.mailboxes set imap_user = smtp_user where imap_user is null;
alter table public.mailboxes alter column imap_user set not null;

-- Update upsert_mailbox RPC to accept imap_user. Drop old signature first.
drop function if exists public.upsert_mailbox(text, text, text, int, text, text, text, int, text);

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
  p_imap_pass text
) returns uuid language plpgsql security definer as $$
declare m_id uuid;
begin
  insert into public.mailboxes (
    user_id, display_name, email, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
    imap_host, imap_port, imap_user, imap_pass_encrypted
  ) values (
    auth.uid(), p_display_name, p_email, p_smtp_host, p_smtp_port, p_smtp_user, private.encrypt_secret(p_smtp_pass),
    p_imap_host, p_imap_port, p_imap_user, private.encrypt_secret(p_imap_pass)
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
    updated_at = now()
  returning id into m_id;
  return m_id;
end$$;

grant execute on function public.upsert_mailbox(text,text,text,int,text,text,text,int,text,text) to authenticated;
