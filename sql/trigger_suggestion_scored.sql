-- Trigger: notify Parent Picker when a suggestion finishes scoring.
-- Fires on pp_locations UPDATE when status changes from 'pending_scoring' to 'pending_review'.
-- Uses pg_net to POST to the PP webhook, which sends the scored-notification email.
--
-- Prerequisites:
--   pg_net extension (already enabled on Supabase)
--   Vault secrets (already created):
--     vault.create_secret('<url>', 'pp_webhook_url', '...');
--     vault.create_secret('<key>', 'pp_webhook_key', '...');
--
-- Status: DEPLOYED 2026-02-22

CREATE OR REPLACE FUNCTION pp_notify_suggestion_scored()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_url text;
  webhook_key text;
BEGIN
  IF OLD.status = 'pending_scoring' AND NEW.status = 'pending_review' THEN
    SELECT decrypted_secret INTO webhook_url
      FROM vault.decrypted_secrets WHERE name = 'pp_webhook_url';
    SELECT decrypted_secret INTO webhook_key
      FROM vault.decrypted_secrets WHERE name = 'pp_webhook_key';

    IF webhook_url IS NOT NULL AND webhook_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || webhook_key
        ),
        body := jsonb_build_object('location_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pp_suggestion_scored ON pp_locations;

CREATE TRIGGER trg_pp_suggestion_scored
  AFTER UPDATE ON pp_locations
  FOR EACH ROW
  WHEN (OLD.status = 'pending_scoring' AND NEW.status = 'pending_review')
  EXECUTE FUNCTION pp_notify_suggestion_scored();
