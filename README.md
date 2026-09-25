# Vajra Moon

Website for Vajra Moon, a free Buddhist meditation pop-up in Manchester city centre.

- **Live site:** https://vajramoon.co.uk
- **Exclusions admin / API (Cloudflare Worker):** https://vajra-moon-admin.vajramoon.workers.dev

## Deploying

**Pushing to `main` deploys automatically.** What gets deployed depends on what changed:

| Changed files | Deployed to | How |
| --- | --- | --- |
| `index.html`, `assets/`, `CNAME` | GitHub Pages (the live site) | GitHub Pages builds from `main` |
| `admin-api/**` | Cloudflare Worker + D1 | `.github/workflows/deploy-admin.yml` |

A push touching both deploys to both. Nothing else needs running by hand.

## The site (GitHub Pages)

A single static page, `index.html`, with images in `assets/`. There is no build step. Pages serves the repo root from `main`, and the custom domain is set by `CNAME` (DNS is managed at Fasthosts).

The "next session" date is worked out in the browser: the 2nd and 4th Friday of each month, 6-8pm, minus any cancelled dates fetched from the Worker's public API. If the API can't be reached, the page falls back to the plain 2nd and 4th Friday rule. The API address is the `EXCLUSIONS_URL` constant in `index.html`.

## Cancellations (Cloudflare)

`admin-api/` is a Cloudflare Worker with a D1 (SQLite) database, in the dedicated **Vajra Moon** Cloudflare account. It is used to record sessions that are not running.

- **Admin page:** https://vajra-moon-admin.vajramoon.workers.dev/ - asks for the passphrase (kept in the browser's localStorage), then lets you add and delete cancelled dates, with an optional private reason. Past dates are hidden unless you press "Show past". There is a Log out button.
- **Public API:** `GET /api/exclusions` returns `{"dates": ["YYYY-MM-DD", ...]}` (upcoming dates only, no reasons). No passphrase needed.
- **Protected API** (needs `Authorization: Bearer <passphrase>`):
  - `GET /api/admin/exclusions` - all dates with reasons
  - `POST /api/exclusions` - body `{"date": "YYYY-MM-DD", "reason": "..."}`
  - `DELETE /api/exclusions/YYYY-MM-DD`

| Item | Where |
| --- | --- |
| Worker code | `admin-api/src/index.js` |
| Admin page | `admin-api/public/index.html` |
| Database schema | `admin-api/migrations/` |
| Worker + D1 config | `admin-api/wrangler.toml` |

### Deploy setup

- The GitHub Actions workflow applies any new D1 migrations, then deploys the Worker. It uses two repo secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- The admin passphrase is a Worker secret named `ADMIN_PASSPHRASE`, not stored in git. To set or change it, run from `admin-api/`:
  ```
  npx wrangler secret put ADMIN_PASSPHRASE
  ```

### Local development

```
cd admin-api
npm install
echo 'ADMIN_PASSPHRASE=test' > .dev.vars   # git-ignored
npm run migrate:local
npm run dev                                # http://localhost:8787
```

## History

The previous version of the site is tagged `v1-legacy-site`.
