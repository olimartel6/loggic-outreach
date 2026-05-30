-- All authenticated users see and modify everything (2-person team, shared).
alter table public.mailboxes enable row level security;
alter table public.campaigns enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.leads enable row level security;
alter table public.sends enable row level security;
alter table public.replies enable row level security;

create policy "auth users read mailboxes" on public.mailboxes for select to authenticated using (true);
create policy "users manage their own mailbox" on public.mailboxes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "auth users all on campaigns" on public.campaigns for all to authenticated using (true) with check (true);
create policy "auth users all on sequence_steps" on public.sequence_steps for all to authenticated using (true) with check (true);
create policy "auth users all on leads" on public.leads for all to authenticated using (true) with check (true);
create policy "auth users read sends" on public.sends for select to authenticated using (true);
create policy "auth users read replies" on public.replies for select to authenticated using (true);
-- sends and replies are written only by service role (Edge Functions).
