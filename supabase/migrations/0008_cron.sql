create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run send-tick every 2 minutes.
select cron.schedule(
  'send-tick',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/send-tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
  $$
);
