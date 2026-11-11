# Evidence index

These files record authentic Module 06 results. Historical account preflight and current deployment evidence are kept separate.

- preflight.md — initial checks and note about unrelated containers auto-started by Docker Desktop.
- cloudflare-free-plan.md — current Workers Free subscription, no-payment-method observation, D1 database count and documented quotas.
- local-validation.txt and local-smoke.txt — lint, dry-run build, local D1 migration and 26 local API/integration checks.
- docker-build.txt, docker-up.txt, docker-ps.txt, docker-smoke.txt, docker-runtime.txt, docker-cleanup.txt — real Docker Compose build, healthy runtime, 26 checks, logs and project-scoped cleanup.
- deploy.txt — Wrangler deployment output with public URL and version identifier.
- network-verification.txt and d1-remote-verification.txt — public DNS/HTTPS/health check and remote migration/schema/empty-row verification.
- remote-smoke.txt — 26 real public HTTPS checks against production, including CRUD and D1 persistence.
- worker-monitoring.json — sanitized sample from wrangler tail; excludes client IP, headers, URL, geolocation, TLS fingerprints and task content.
- app-desktop.png — real Chrome headless local screenshot of the public TaskFlow page.
- github-actions-validation.md — actual GitHub Actions CI/build/Docker/deploy run and per-job results.
- actions-deploy.txt — deployed Worker version, public smoke result and sanitized tail metrics.
- availability-action.md and post-actions-health.txt — actual public health probe and post-CI D1 checks.

No tokens, credentials, or personal task contents are included. The monitoring sample is point-in-time evidence, not a continuous uptime guarantee.






