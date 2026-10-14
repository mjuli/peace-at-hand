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
- Sounds are synthesized with Web Audio in src/lib/bell.ts; optional real files go in public/sounds and are registered in AMBIENT_FILES/BELL_FILES. Why: no licensed audio available, structure ready for files.
- Per-user preferences live in the `settings` table (auto-created on signup); "return suggestion" logic is pure in src/lib/return-suggestion.ts with tests.
