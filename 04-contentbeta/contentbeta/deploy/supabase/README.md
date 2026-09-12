# Self-hosted Supabase (ContentBeta)

Minimal Docker stack on Hostinger VPS `148.230.67.132`:

- `db` — `supabase/postgres` (host `127.0.0.1:5433`)
- `auth` — GoTrue
- `rest` — PostgREST
- `kong` — API gateway on `127.0.0.1:8010`
- Nginx + Let’s Encrypt → `https://supabase.aneeverse.com`

Media stays on ImageKit (no Storage service).

## On the VPS

```bash
cd /opt/contentbeta-supabase
docker compose ps
docker compose logs -f auth rest
# Keys (root only): /opt/contentbeta-supabase/CONTENTBETA_KEYS.txt
```

## First-boot note

After the Postgres volume is created, role passwords for `authenticator` / `supabase_auth_admin` must match `POSTGRES_PASSWORD` in `.env`. If auth/rest fail with SASL errors, run as `supabase_admin` (image default password = `POSTGRES_PASSWORD` from first init):

```sql
ALTER ROLE authenticator WITH PASSWORD '<POSTGRES_PASSWORD>';
ALTER ROLE supabase_auth_admin WITH PASSWORD '<POSTGRES_PASSWORD>';
```

## Local app

Point `.env.local` at:

- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.aneeverse.com`
- anon + service role JWTs from `CONTENTBETA_KEYS.txt`

## Schema changes / migrations

After applying SQL (`apply-migrations.sh` or ad-hoc `ALTER TABLE`), **always reload PostgREST** so new columns are visible to the REST API:

```bash
docker kill -s SIGUSR1 contentbeta-rest 2>/dev/null || docker restart contentbeta-rest
```

`apply-migrations.sh` does this automatically. Skipping the reload causes n8n Save nodes to fail with “column not found in the schema cache” even though Postgres has the column.

Guard with:

```bash
node scripts/check-n8n-supabase-schema.js
```
