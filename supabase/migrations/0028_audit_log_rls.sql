-- Restrict audit_log reads. Previously any authenticated user could read it (USING (true)),
-- which exposed hashes of mailbox bytea in the audit trail.
drop policy if exists "auth users read audit_log" on public.audit_log;

-- Only the original Oli email can read audit. Hardcoded; rotate manually if needed.
create policy "owner email reads audit_log" on public.audit_log for select to authenticated using (
  (select email from auth.users where id = auth.uid()) = 'oliviermartel2006@gmail.com'
);
