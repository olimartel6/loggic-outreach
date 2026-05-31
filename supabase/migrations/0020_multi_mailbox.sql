-- Allow multiple mailboxes per user (rotation strategy for volume scaling)
drop index if exists mailboxes_user_uniq;
create index if not exists mailboxes_user_idx on public.mailboxes(user_id);

-- Replace upsert_mailbox RPC: now takes optional p_mailbox_id (null = insert new, set = update existing).
-- Only the OWNER can update.
drop function if exists public.upsert_mailbox(text,text,text,int,text,text,text,int,text,text);
drop function if exists public.upsert_mailbox(text,text,text,int,text,text,text,int,text,text,int);

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
  p_daily_limit int default 5,
  p_mailbox_id uuid default null
) returns uuid language plpgsql security definer as $$
declare m_id uuid;
begin
  if p_mailbox_id is null then
    insert into public.mailboxes (
      user_id, display_name, email, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
      imap_host, imap_port, imap_user, imap_pass_encrypted, daily_limit
    ) values (
      auth.uid(), p_display_name, p_email, p_smtp_host, p_smtp_port, p_smtp_user, private.encrypt_secret(p_smtp_pass),
      p_imap_host, p_imap_port, p_imap_user, private.encrypt_secret(p_imap_pass), p_daily_limit
    )
    returning id into m_id;
  else
    update public.mailboxes set
      display_name = p_display_name,
      email = p_email,
      smtp_host = p_smtp_host,
      smtp_port = p_smtp_port,
      smtp_user = p_smtp_user,
      smtp_pass_encrypted = case when p_smtp_pass = '' then smtp_pass_encrypted else private.encrypt_secret(p_smtp_pass) end,
      imap_host = p_imap_host,
      imap_port = p_imap_port,
      imap_user = p_imap_user,
      imap_pass_encrypted = case when p_imap_pass = '' then imap_pass_encrypted else private.encrypt_secret(p_imap_pass) end,
      daily_limit = p_daily_limit,
      updated_at = now()
    where id = p_mailbox_id and user_id = auth.uid()
    returning id into m_id;
    if m_id is null then raise exception 'mailbox not found or not owned by current user'; end if;
  end if;
  return m_id;
end$$;

grant execute on function public.upsert_mailbox(text,text,text,int,text,text,text,int,text,text,int,uuid) to authenticated;

-- Delete mailbox (only owner)
create or replace function public.delete_mailbox(p_mailbox_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.mailboxes where id = p_mailbox_id and user_id = auth.uid();
  if not found then raise exception 'mailbox not found or not owned by current user'; end if;
end$$;
grant execute on function public.delete_mailbox(uuid) to authenticated;
