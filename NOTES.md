# CRUISER Source Files

Files extracted from the live worker at https://cruiser-sa.gerhardcttx.workers.dev/ (2026-06-28):

| File | Status | Notes |
|------|--------|-------|
| index.html | Complete | Reconstructed from DOM |
| style.css | Complete | Full CSS, Nature-Tech theme |
| gauge.js | Complete | HiDPI canvas speedometer |
| speedtest.js | Complete | Cloudflare speed endpoints |
| app.js | Complete | Full app logic |
| manifest.json | Complete | PWA manifest |
| worker.js | Minimal | Actual worker not extractable; see below |
| wrangler.toml | Complete | Assets binding configured |

## worker.js note

The deployed worker is a simple ASSETS passthrough. If Manus has Cloudflare CLI:
```
wrangler whoami
wrangler deployments list --name cruiser-sa
```

## Deploy

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Live URL: https://cruiser-sa.gerhardcttx.workers.dev/
Account: gerhardcttx (Cloudflare)
