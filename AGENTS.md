# Project Instructions

- Do not run a separate build just to verify. After a code change that can reach production, run `deploy.cmd` before finishing (`$env:HULY_NO_PAUSE = '1'`). Skip that only when the user says not to deploy, or the edit cannot ship (docs-only).
- When finishing work, state that the task is complete. After a deploy, give the live URL and ask the user to hard-refresh with Ctrl+F5.
- **Fork history (what we changed vs upstream Huly and why):** [docs/ANEEVERSE-FORK-CHANGES.md](docs/ANEEVERSE-FORK-CHANGES.md)
- **Local UI (local Docker DB):** `local.cmd` — see [docs/LOCAL-AND-DEPLOY.md](docs/LOCAL-AND-DEPLOY.md).
- **Local UI (production data):** `prod-local.cmd` — SSH tunnel to live aneeverse.
- **Production deploy:** `deploy.cmd` — one command that validates, builds, ships only what changed, smoke-tests production, and rolls back on failure. `deploy.cmd status` shows what would happen. See [docs/HULY-PRODUCTION-DEPLOY.md](docs/HULY-PRODUCTION-DEPLOY.md).
- **Custom account image:** `account.cmd` — required for anything under `server/account` (API tokens). See [Account service changes](docs/HULY-PRODUCTION-DEPLOY.md#account-service-changes).
- **Custom calendar image:** shipped by `deploy.cmd` when `services/calendar` changes (Google Meet Join + event-id fix).
- **Never run two front builds at once:** `rushx package` starts with `rm -rf ./dist`, so parallel builds corrupt each other's output.
- **`models/**` edits do nothing on their own.** The model is baked into the transactor image, and both local and production run the official `hardcoreeng` images, so model changes only take effect once the difference is written into `model_tx`. `local.cmd` and `deploy.cmd` do this automatically — see [Model changes](docs/HULY-PRODUCTION-DEPLOY.md#model-changes).
- **`server/**` edits do nothing on their own either, and `model_tx` cannot help.** A service is a compiled bundle inside its image. `server/account` is the one we build and ship (`account.cmd` locally, the `account` stage in `deploy.cmd`); every other service still runs stock, so changes there need a custom image built by hand.
