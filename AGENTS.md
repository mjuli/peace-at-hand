<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Journey progress is derived from active `checks` rows (reset_at null); pure rules live in src/lib/journey.ts with tests. Why: resets must never touch `sessions`.
- Journey data is read/written from the browser via the Cloud client with RLS (src/lib/journey-data.ts). Why: all data is per-user and RLS-scoped.
- Practice completion uses the authenticated SECURITY INVOKER record_practice RPC with a stable session ID and per-user transaction lock. Why: session and its check must commit atomically, and retries must not advance twice.
- Sounds are synthesized with Web Audio in src/lib/bell.ts; optional real files go in public/sounds and are registered in AMBIENT_FILES/BELL_FILES. Why: no licensed audio available, structure ready for files.
- Per-user preferences live in the `settings` table (auto-created on signup); "return suggestion" logic is pure in src/lib/return-suggestion.ts with tests.
- History metrics and achievement rules are pure in src/lib/stats.ts and src/lib/achievements.ts (tested); achievements are recomputed from full history and inserted idempotently by syncAchievements (src/lib/history-data.ts). Why: retroactive unlocks and resets never revoke achievements.
- Extra-time rules and total duration live in src/lib/extra-time.ts; the timer saves planned completion once before count-up, then updates that same session without new checks. Why: completed progress survives leaving the timer and all history uses a single duration formula.
- Legacy early-phase completion is a one-time backfill of checks marked `is_legacy_credit` with no session; reset them normally, exclude them from practice achievements and estimate activity dates, but include them in progress. Why: preserve existing phase positions without inventing meditation history or practice frequency.
