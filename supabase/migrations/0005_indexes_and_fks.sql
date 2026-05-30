-- Add explicit on-delete behavior to FKs for audit-trail tables.
-- Default NO ACTION causes opaque FK errors when deleting mailboxes/steps in Settings UI.
alter table public.sends drop constraint sends_step_id_fkey;
alter table public.sends add constraint sends_step_id_fkey
  foreign key (step_id) references public.sequence_steps(id) on delete restrict;

alter table public.sends drop constraint sends_mailbox_id_fkey;
alter table public.sends add constraint sends_mailbox_id_fkey
  foreign key (mailbox_id) references public.mailboxes(id) on delete restrict;

alter table public.replies drop constraint replies_mailbox_id_fkey;
alter table public.replies add constraint replies_mailbox_id_fkey
  foreign key (mailbox_id) references public.mailboxes(id) on delete restrict;

-- Indexes required by Phase 2/3/5/6 access patterns.
create index if not exists leads_campaign_idx on public.leads(campaign_id);
create index if not exists sends_lead_idx on public.sends(lead_id);
create index if not exists replies_lead_idx on public.replies(lead_id);
