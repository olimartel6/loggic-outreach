select cron.schedule(
  'imap-poll',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.functions_url') || '/imap-poll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
  $$
);
