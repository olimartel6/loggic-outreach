-- Per-mailbox daily email cap (overrides the campaign-level limit in send-tick).
-- Defaults to 20. Each user (mailbox owner) can edit from Settings.
alter table public.mailboxes
  add column daily_limit int not null default 20 check (daily_limit between 1 and 500);
