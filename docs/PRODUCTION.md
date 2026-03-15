# SchoolOS – Production deployment checklist

Use this checklist to run SchoolOS in a production / enterprise environment.

---

## 1. Environment

- [ ] Set `NODE_ENV=production`.
- [ ] Set `DATABASE_URL` to your production PostgreSQL (use connection pooling, e.g. PgBouncer, if needed).
- [ ] Set `JWT_SECRET` to a strong random value (min 32 chars). Never use the default in production.
- [ ] Set `CORS_ORIGIN` to your frontend origin(s), e.g. `https://admin.schoolos.example.com`. Avoid `*` in production.
- [ ] Optionally set `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` (default 100 req/min per IP).
- [ ] For LM Studio / AI: set `LM_STUDIO_URL`, `LM_STUDIO_MODEL`, `LM_STUDIO_KEY` if using local AI.

---

## 2. Database

- [ ] Run migrations: `npx prisma migrate deploy` (create migrations from schema first with `prisma migrate dev` in dev).
- [ ] Ensure DB user has minimal required privileges (no superuser if not needed).
- [ ] Enable SSL for DB connections if required (`?sslmode=require` in `DATABASE_URL`).
- [ ] Schedule regular backups and test restore.

---

## 3. API (core-api)

- [ ] Serve over HTTPS (reverse proxy: Nginx, Caddy, or cloud load balancer).
- [ ] Rate limiting is enabled by default; tune via env if needed.
- [ ] Helmet is enabled; adjust CSP if you need inline scripts.
- [ ] Health: `GET /health` (liveness), `GET /health/ready` (readiness, includes DB check). Use in orchestrator probes.
- [ ] Logging: ensure logs go to stdout/stderr or your logging pipeline (no PII in logs).
- [ ] Request IDs: `X-Request-ID` is set; use it in support and logs.

---

## 4. Security

- [ ] Passwords: enforced policy (min 8 chars, letter + number) for new users. Existing users keep current hashes.
- [ ] JWT: use short expiry (e.g. 15m–1h) and refresh tokens for long sessions if you implement refresh endpoint.
- [ ] Audit: sensitive actions (user create/update/delete, student create/delete) are written to `audit_logs`. Retain and monitor.
- [ ] No secrets in frontend; keep `JWT_SECRET` and DB credentials only on the server.

---

## 5. Frontend (Admin / Student / Parent)

- [ ] Build: `npm run build` per app; serve static assets via CDN or same reverse proxy.
- [ ] Set API base URL if not same origin (e.g. env `VITE_API_URL` and use in `api.ts`).
- [ ] Prefer HTTPS only (HSTS, redirect HTTP → HTTPS at proxy).

---

## 6. Docker (optional)

- [ ] Use multi-stage builds; don’t ship dev deps in production image.
- [ ] In `docker-compose`, set env from a secure store (secrets manager or env files with restricted permissions).
- [ ] For DB, use a dedicated volume and backup strategy.
- [ ] Map `/health` and `/health/ready` to your orchestrator health checks.

---

## 7. Monitoring and ops

- [ ] Monitor `/health/ready` and DB latency; alert on 503 or high latency.
- [ ] Track rate-limit hits and auth failures; alert on abuse patterns.
- [ ] Retain and optionally ship `audit_logs` for compliance and security reviews.
- [ ] Plan for DB and app upgrades (Prisma, Node, OS).

---

## 8. Optional hardening

- [ ] Add refresh-token rotation and revocation (table already exists).
- [ ] Consider SSO (SAML/OIDC) placeholders for enterprise; integrate with your IdP.
- [ ] API keys for `integration_service` role: use `INTEGRATION_API_KEY` and validate on integration routes.
- [ ] Per-school or per-role feature flags if you need gradual rollouts.
