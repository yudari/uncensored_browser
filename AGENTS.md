# uncensored_browser

## Agent skills

### Issue tracker

GitHub Issues on `yudari/uncensored_browser` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

After `/to-tickets` is approved, publish each ticket as a GitHub issue (`ready-for-agent`, parent link, blocked-by). Do not implement from chat-only ticket numbers.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Operator / Tray Client

See `docs/OPERATOR.md` and root `README.md`. The Tray Client has no main window: after `npm start` expect a tray icon (and optional notification); the terminal staying open is normal, not a hang. Use `npm run start:quick` when `dist/` is already built.
