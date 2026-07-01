# Bugs Fixed

## TOKEN_REFRESHED re-render cascade

Problem:
AuthContext was triggering unnecessary rerenders during Supabase TOKEN_REFRESHED events.

Cause:
Session updates were re-triggering state updates even when the authenticated user had not changed.

Fix:
Added sessionRef optimization and skipped redundant state updates for same-user TOKEN_REFRESHED events.

Result:
Reduced unnecessary rerenders and improved auth performance stability.

## ActiveCollab full sync partial runs

Problem:
ActiveCollab admin sync showed repeated partial runs: projects synced, but tasks/time records stayed near zero.

Cause:
The task sync batched duplicate ActiveCollab task IDs into one upsert, causing Postgres to reject the whole batch. Time-record sync was calling raw proxy endpoints that are unavailable in this environment instead of the working project-hours proxy.

Fix:
De-duplicated task batches before upsert, restored tracked-hours field mapping from the proxy payload, and made time-record sync use the managed project-hours proxy first.

Result:
The next manual or cron sync should write tasks and project time records instead of returning zero counts.