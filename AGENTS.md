# Project Instructions

- Do not run build commands automatically for verification.
- When finishing work, state that the task is complete and ask the user to verify it manually.
- **Fork history (what we changed vs upstream Huly and why):** [docs/ANEEVERSE-FORK-CHANGES.md](docs/ANEEVERSE-FORK-CHANGES.md)
- **Local UI (local Docker DB):** `local.cmd` — see [docs/LOCAL-AND-DEPLOY.md](docs/LOCAL-AND-DEPLOY.md).
- **Local UI (production data):** `prod-local.cmd` — SSH tunnel to live aneeverse.
- **Production deploy:** `deploy.cmd` — one command that validates, builds, ships only what changed, smoke-tests production, and rolls back on failure. `deploy.cmd status` shows what would happen. See [docs/HULY-PRODUCTION-DEPLOY.md](docs/HULY-PRODUCTION-DEPLOY.md).
- **Never run two front builds at once:** `rushx package` starts with `rm -rf ./dist`, so parallel builds corrupt each other's output.
- **`models/**` edits do nothing on their own.** The model is baked into the transactor image, and both local and production run the official `hardcoreeng` images, so model changes only take effect once the difference is written into `model_tx`. `local.cmd` and `deploy.cmd` do this automatically — see [Model changes](docs/HULY-PRODUCTION-DEPLOY.md#model-changes).
