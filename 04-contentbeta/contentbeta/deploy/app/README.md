# ContentBeta Next.js on VPS

Runs on Hostinger VPS `148.230.67.132`:

- App dir: `/opt/contentbeta`
- PM2 process: `contentbeta` → `next start` on `127.0.0.1:3000`
- Nginx + Let’s Encrypt → `https://studio.aneeverse.com`

## Deploy / update

From a machine with SSH access (see `scripts/vps-ssh.js` / `scripts/deploy-next-vps.js`):

```bash
node scripts/deploy-next-vps.js
```

Manual:

```bash
cd /opt/contentbeta
npm ci
npm run build
pm2 startOrReload deploy/app/ecosystem.config.cjs
pm2 save
```

## Env

Production env lives at `/opt/contentbeta/.env.local` (not in git).
Copy from local `.env.local` with VPS Supabase + n8n + ImageKit values.
