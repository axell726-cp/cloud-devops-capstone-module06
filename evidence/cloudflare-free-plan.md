# Cloudflare Free plan and quota check — 2026-11-11

## Account observations

- The signed-in Cloudflare account Billing → Subscriptions panel showed Workers Free — Active.
- The same panel showed No payment method on file.
- Existing Wrangler OAuth authentication succeeded (wrangler whoami).
- wrangler d1 list --json showed 3 databases total, including taskflow-capstone-module06; this is below the documented Workers Free limit of 10 databases.
- The application uses the existing free workers.dev hostname. No card, paid plan, custom domain, R2 bucket, or paid service was enabled.

## Documented limits used for the estimate

As checked against Cloudflare documentation on 2026-11-11:

- Workers Free: 100,000 requests/day and 10 ms CPU per invocation.
- D1 Free: up to 10 databases, 500 MB per database, 5 GB account storage, 5 million rows read/day and 100,000 rows written/day.
- D1 queries stop returning results when the Free daily limits are exceeded; this capstone does not upgrade the plan automatically.

## Cost record

Expected Cloudflare charge: USD 0.00 while within the Free limits. This is based on the active Free subscription and the visible absence of a payment method, not a final invoice or a guaranteed account-wide hard cap. Billing dashboards may update later. The project makes no paid-resource requests and avoids R2.

Sources: https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/d1/platform/limits/, https://developers.cloudflare.com/d1/platform/pricing/, https://developers.cloudflare.com/d1/reference/faq/.
