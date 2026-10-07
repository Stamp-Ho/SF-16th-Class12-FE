-- Run as postgres in the Supabase SQL Editor AFTER 20261007000200_boardgame_edit_leases.sql.
-- Enable Supabase Cron first (Integrations > Cron), or enable it below.
-- Supabase Cron: https://supabase.com/docs/guides/cron/quickstart
-- Seconds intervals require Supabase Postgres 15.1.1.61 or newer.
create extension if not exists pg_cron;

-- Re-running with the same job name updates the existing job.
select cron.schedule(
  'boardgame-edit-lease-cleanup',
  '30 seconds',
  $$select public.cleanup_expired_boardgame_edit_leases();$$
);

-- Manual cleanup:
-- select public.cleanup_expired_boardgame_edit_leases();
-- Inspect configuration / recent runs:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'boardgame-edit-lease-cleanup';
-- select status, return_message, start_time, end_time from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'boardgame-edit-lease-cleanup')
-- order by start_time desc limit 20;
-- Stop cleanup:
-- select cron.unschedule('boardgame-edit-lease-cleanup');
