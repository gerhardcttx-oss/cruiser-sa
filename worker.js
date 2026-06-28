// CRUISER — Cloudflare Worker entry point
// Serves static assets (index.html, style.css, gauge.js, speedtest.js, app.js, etc.)
// via the Workers Assets binding configured in wrangler.toml
//
// NOTE: The actual worker source could not be extracted from the Cloudflare dashboard
// due to auth constraints. This is a functionally equivalent minimal worker.
// If Manus has Cloudflare CLI access: `wrangler worker download cruiser-sa`
// will pull the exact deployed script.

export default {
  async fetch(request, env) {
    // Serve static assets from the [assets] directory defined in wrangler.toml
    return env.ASSETS.fetch(request);
  }
};
