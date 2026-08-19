# Project Instructions

- Do not run build commands automatically for verification.
- When finishing work, state that the task is complete and ask the user to verify it manually.
- **Local UI (local Docker DB):** `local.cmd` — see [docs/LOCAL-AND-DEPLOY.md](docs/LOCAL-AND-DEPLOY.md). Applies the fork Client model on start.
- **Local UI (production data):** `prod-local.cmd` — SSH tunnel to live aneeverse.
- **Production deploy:** `ship.cmd` or [docs/HULY-PRODUCTION-DEPLOY.md](docs/HULY-PRODUCTION-DEPLOY.md). Use `./scripts/huly-deploy-production.sh front`, `model-tracker`, or `model-company` — do not redo full VPS install for UI/model patches.
