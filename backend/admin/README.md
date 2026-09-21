# Dashboard and usage controls

Run the frontend with `npm run dev` in `frontend`. Run the backend from the repository root with `.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`.

The dashboard shows recorded call minutes, local credits, latency when supplied, call counts, average duration, a 14-day UTC usage chart, outcomes, and per-agent filtering. Appointments no longer generate fictional call usage.

Onboarding requires sequential completion, explicit unavailable choices, voice/model selection, and conversation-rule acceptance. Business hours, catalogue, capabilities and rules are retained with the created agent.

In Usage & Credits, check the Fish Audio connection, paste the actual provider agent ID, verify/link, then sync sessions. Set `FISH_API_KEY` (or `FISH_AUDIO_API_KEY`) on the server. Secrets never go to the browser. The adapter uses the official Fish Audio wallet, agent and paginated session APIs. Completed/failed sessions with measured duration import once by provider session ID; unknown duration is not estimated. Existing local agent IDs remain stable.

Minute top-ups convert at the saved local credits-per-minute rate. Calls round up to whole billable minutes and retain the rate at ingestion. Balance limits reject oversized top-ups rather than silently losing credits. These local allocations are separate from Fish Audio account credit and do not purchase credits or stop calls initiated in Fish Audio. Provider session summaries do not include latency, so that metric remains unavailable until measured telemetry is logged through `/admin/call_logs`.

Local usage records, provider mappings, created agent configurations and balances persist in `backend/admin/data/state.json`, excluded from Git. `SCADOVA_ADMIN_STATE` can override this path. This file store supports the existing single-process local admin deployment; use transactional shared storage before running multiple backend workers. Existing business persistence remains in Supabase.

Verification: `python -m unittest discover -s backend/tests -p test_usage.py`; `npm --prefix frontend run build`. Browser checks cover missing required fields, future-step locking, unavailable choices, review navigation, sidebar collapse, live Fish connection and mobile overflow.
