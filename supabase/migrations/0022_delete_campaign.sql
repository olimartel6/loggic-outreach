-- Hard-delete a campaign with proper cascade order.
-- Default cascade would race against `sends.step_id` ON DELETE RESTRICT (added in 0005)
-- when sequence_steps tries to delete before sends are cleared via lead_id cascade.
-- This function orders the deletes explicitly.

create or replace function public.delete_campaign(p_campaign_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.leads where campaign_id = p_campaign_id;
  delete from public.sequence_steps where campaign_id = p_campaign_id;
  delete from public.campaigns where id = p_campaign_id;
end$$;

grant execute on function public.delete_campaign(uuid) to authenticated;
