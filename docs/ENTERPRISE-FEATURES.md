# SchoolOS Enterprise Edition – Features overview

This document summarizes production-oriented and enterprise features in the platform.

---

## Security and compliance

| Feature | Description |
|--------|-------------|
| **RBAC** | Roles: superadmin, school_admin, teacher, parent, student, integration_service. All API routes enforce role and school scope. |
| **Password policy** | New users: min 8 characters, at least one letter and one number. Enforced in API. |
| **JWT + refresh tokens** | Access token (configurable expiry); refresh token stored in DB and returned on login for future session renewal. |
| **Rate limiting** | Global limit per IP (configurable). Stricter limit on `/api/auth/login` to reduce brute force. |
| **Helmet** | Security headers (CSP configurable). |
| **Request ID** | Every request has a unique ID for tracing and support. |
| **Audit logging** | User create/update/delete and student create/delete written to `audit_logs` with userId, schoolId, resource, action. |
| **CORS** | Configurable allowed origins (set `CORS_ORIGIN` in production). |

---

## API and reliability

| Feature | Description |
|--------|-------------|
| **Health checks** | `GET /health` (liveness), `GET /health/ready` (readiness + DB ping). |
| **Structured errors** | JSON error responses with optional `requestId` and (in non-production) stack. |
| **Env validation** | Server validates required env at startup (e.g. `DATABASE_URL`). |
| **Request size limit** | JSON body limit (e.g. 1MB) to reduce DoS surface. |

---

## Database

| Feature | Description |
|--------|-------------|
| **Indexes** | Indexes on User (schoolId, role), Student (schoolId, classId, grade), Attendance (studentId, date), AuditLog (userId, schoolId, createdAt) for common queries. |
| **Prisma** | Type-safe ORM; use migrations in production (`prisma migrate deploy`). |

---

## Frontend (Admin dashboard)

| Feature | Description |
|--------|-------------|
| **Toasts** | Success/error/info notifications for user actions. |
| **Error boundary** | Catches React errors and shows a fallback with “Try again”. |
| **API client** | Central `api.ts` with auth header, request ID, and consistent error handling. |
| **Students** | Search (client-side), Add student, Edit (grade, section, class, status), Remove. Optional “Create login” on add. |
| **Users** | List, filter by role, Add user (email, password, role), Change role, Remove. |
| **Loading states** | Skeleton/loading on Students while data is fetched. |

---

## Multi-tenancy and scale

| Feature | Description |
|--------|-------------|
| **School scope** | school_admin and teacher see only their school. superadmin can see all. |
| **Pagination** | List endpoints support `page` and `pageSize` (max 100). |
| **Stateless API** | No in-memory session store; JWT and DB only. Horizontal scaling of API is supported. |

---

## Integrations and extensibility

| Feature | Description |
|--------|-------------|
| **CareerBuddy context** | `GET /api/students/:id/context` for AI/integration (optional API key via `INTEGRATION_API_KEY`). |
| **Webhook** | `POST /api/integrations/careerbuddy/webhook` for external events. |
| **SSO** | Placeholders only; integrate with your IdP for enterprise SSO. |

---

## Operational readiness

- **Logging**: App logs to stdout; integrate with your log aggregator.
- **Secrets**: No secrets in frontend; use env vars or a secrets manager for API and DB.
- **Backups**: Use your DB backup strategy; audit_logs can be retained for compliance.
- **Deployment**: Docker and docker-compose provided; use health checks and env-based config in production.

For a step-by-step production checklist, see [PRODUCTION.md](./PRODUCTION.md).
