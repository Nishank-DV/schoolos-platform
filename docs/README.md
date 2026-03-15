# SchoolOS Platform + CareerBuddy

Enterprise MVP for SchoolOS with integrated CareerBuddy AI career discovery (Grade 9 & 10).

## Tech stack

- **Frontend (Admin):** React, Vite, TypeScript, TailwindCSS  
- **Frontend (Student/Parent):** React, mobile-style UI  
- **Backend:** Node.js, Express, TypeScript  
- **AI:** Python (FastAPI) + Node genai adapter (LM Studio)  
- **Database:** PostgreSQL, Prisma ORM  
- **Auth:** JWT, RBAC  
- **Containers:** Docker, docker-compose  

## Project structure

```
schoolos-platform/
├── apps/
│   ├── admin-dashboard/   # React admin (port 3000)
│   ├── student-portal/    # React student (port 3001)
│   └── parent-portal/     # React parent (port 3002)
├── services/
│   ├── core-api/          # Express API (port 4000)
│   ├── ai-engine/         # Python FastAPI (port 5000)
│   └── careerbuddy-engine/ # Node CareerBuddy stub (port 5001)
├── packages/
│   ├── shared-types/
│   └── shared-utils/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── docker/
```

## Quick start (local, no Docker)

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker only for DB: `docker run -d -p 5432:5432 -e POSTGRES_USER=schoolos -e POSTGRES_PASSWORD=schoolos_secret -e POSTGRES_DB=schoolos postgres:16-alpine`)
- Python 3.12+ (optional, for AI engine)

### 2. Install and DB

```bash
cd schoolos-platform
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL="postgresql://schoolos:schoolos_secret@localhost:5432/schoolos"
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npx tsx prisma/seed.ts
```

### 3. Run services

**Terminal 1 – Core API**

```bash
npm run dev:api
```

**Terminal 2 – Admin dashboard**

```bash
npm run dev:admin
```

**Terminal 3 – Student portal**

```bash
npm run dev:student
```

**Terminal 4 – Parent portal (optional)**

```bash
npm run dev:parent
```

**Optional – AI engine (Python)**

```bash
cd services/ai-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 5000
```

### 4. Demo logins

| Role    | Email                     | Password   |
|---------|---------------------------|------------|
| Admin   | admin@schoolos.demo       | Admin@123  |
| Teacher| priya.sharma@demoschool.edu | Teacher@123 |
| Parent  | raj.kumar@example.com     | Parent@123 |
| Student | student1@schoolos.demo    | Student@123 |

- **Admin:** http://localhost:3000  
- **Student:** http://localhost:3001  
- **Parent:** http://localhost:3002  

## LM Studio (optional AI)

For AI-generated assessment questions and career recommendations:

1. Install [LM Studio](https://lmstudio.ai/) and run a model locally.
2. Start the server (e.g. port 1234).
3. Set in `.env` (or environment):

   - `LM_STUDIO_URL=http://localhost:1234/v1`
   - `LM_STUDIO_MODEL=local-model`
   - `LM_STUDIO_KEY=lm-studio`

If these are not set, the core-api uses built-in **mock** question and recommendation logic.

## Docker (full stack)

From repo root:

```bash
cd docker
docker-compose up -d
```

Then:

- Run migrations and seed once (inside `core-api` or from host with correct `DATABASE_URL`):

  - `npx prisma db push`
  - `npx tsx prisma/seed.ts`

- **Admin:** http://localhost:3000  
- **Student:** http://localhost:3001  
- **Parent:** http://localhost:3002  
- **API:** http://localhost:4000  

## API overview

- `POST /api/auth/login` – Login  
- `GET /api/schools`, `GET /api/students`, `GET /api/teachers`, `GET /api/classes` – ERP  
- `GET/POST /api/attendance` – Attendance  
- `GET/POST /api/assignments`, `GET /api/grades` – LMS  
- `GET/POST /api/announcements` – Communication  
- `GET /api/finance/*` – Finance  
- `GET/POST /api/innovation/logs` – Innovation lab  
- `GET /api/analytics/overview`, `GET /api/analytics/learning-gaps` – Analytics  
- `GET/POST /api/careerbuddy/*` – CareerBuddy (profile, sessions, questions, report)  
- `GET /api/students/:id/context` – Student context for CareerBuddy  
- `POST /api/integrations/careerbuddy/webhook` – CareerBuddy webhook  

## RBAC roles

- `superadmin`, `school_admin`, `teacher`, `parent`, `student`, `integration_service`  

## CareerBuddy flow

1. Student has a **career profile** (favorite subjects, hobbies, likes/dislikes) and **parental consent**.  
2. Student starts an **assessment session**; next question is fetched (AI or mock).  
3. Student answers; on completion, **career recommendations** and **stream recommendation** (e.g. MPC, PCB, Commerce, Humanities) are generated and stored.  
4. **Report** is available to student and (via parent/teacher views) to parents and teachers.  

## Security

- JWT in `Authorization: Bearer <token>`.  
- Input validation (e.g. Zod) and Prisma for DB safety.  
- Audit logging (AuditLog model).  
- Parental consent flag required for CareerBuddy assessment.  

## License

Proprietary / Demo.
