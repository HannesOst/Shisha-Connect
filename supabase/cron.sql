-- Run ONCE in the Supabase SQL editor after deploying the edge functions.
-- Replace <PROJECT_REF> and <CRON_SECRET> (the same value you set with
-- `supabase secrets set CRON_SECRET=...`).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'shisha-connect-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
