# SchoolOS Platform + CareerBuddy

SchoolOS is a multi-portal school operating system with Admin, Student, and Parent apps, a TypeScript core API, shared packages, Prisma/PostgreSQL data modeling, optional AI support, and Docker deployment support.

## What This Project Is

- A unified ERP + LMS-style platform for schools.
- Three frontend apps:
  - Admin dashboard for academics, admissions, analytics, finance, communication, and school operations.
  - Student portal for assignments, announcements, insights, fees, results, and CareerBuddy workflows.
  - Parent portal for child progress, attendance, results, announcements, insights, and Android packaging.
- A core API service that implements authentication, authorization, and school-domain business logic.
- AI support services:
  - `services/ai-engine` for Python/FastAPI AI endpoints.
  - `services/careerbuddy-engine` for lightweight CareerBuddy service support.

## Feature Highlights

- Admissions and enquiry workflows.
- Academic management for years, classes, sections, subjects, and teacher assignments.
- Attendance management for students and teachers.
- Exams, grading, results, and report-card-ready APIs.
- Assignment, quiz, announcement, PTM, event, and finance workflows.
- CareerBuddy assessment, recommendations, reporting, and analytics.
- Deterministic and AI-assisted academic analytics with risk detection.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Capacitor (Parent Portal Android packaging)

### Backend

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT auth
- Zod validation
- Helmet + CORS + express-rate-limit

### AI

- Python FastAPI
- httpx + pydantic
- LM Studio-compatible chat completion integration

### Platform

- npm workspaces monorepo
- Docker + docker-compose
- Nginx SPA serving configs

## Monorepo Layout

```text
schoolos-platform/
|- apps/
|- services/
|- packages/
|- prisma/
|- docker/
|- docs/
|- package.json
`- tsconfig.base.json
```

## Runtime Architecture

- Frontend apps run on Vite in development and as static SPAs in containerized deployments.
- `services/core-api` owns the main system-of-record reads and writes.
- PostgreSQL stores operational data via Prisma.
- `services/core-api` can use deterministic logic or optional AI-backed flows.
- `services/ai-engine` can expose standalone AI endpoints.

## Quick Start

LM Studio is optional for local development. If it is unavailable, the platform falls back to deterministic AI behavior.

```bash
npm install
cp .env.example .env
# Set DATABASE_URL in .env
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npx tsx prisma/seed.ts
npm run dev
```

Demo logins:

- Admin: `admin@schoolos.demo` / `Admin@123`
- Teacher: `priya.sharma@demoschool.edu` / `Teacher@123`
- Parent: `raj.kumar@example.com` / `Parent@123`
- Student: `student1@schoolos.demo` / `Student@123`

## Key API Groups

- `/api/auth`
- `/api/users`, `/api/schools`
- `/api/enquiries`, `/api/admissions`
- `/api/academics`
- `/api/students`, `/api/teachers`, `/api/classes`, `/api/timetable`
- `/api/attendance`
- `/api/assignments`, `/api/grades`, `/api/quizzes`
- `/api/announcements`, `/api/events`, `/api/ptm`
- `/api/finance`, `/api/innovation`, `/api/analytics`
- `/api/careerbuddy`, `/api/integrations`
- `/api/exams`

## Deployment Notes

SchoolOS supports separate hosting for each portal and the API service:

- `admin.schoolos.example.com` -> `apps/admin-dashboard`
- `student.schoolos.example.com` -> `apps/student-portal`
- `parent.schoolos.example.com` -> `apps/parent-portal`
- `api.schoolos.example.com` -> `services/core-api`

Frontend apps use `VITE_API_URL` when set, and same-origin `/api/...` fallback when unset.

## PWA Support

PWA support is enabled for:

- `apps/student-portal`
- `apps/parent-portal`

Current placeholder assets are stored in each app's `public` directory.

## Build Validation Commands

- `npm run build -w core-api`
- `npm run build -w admin-dashboard`
- `npm run build -w student-portal`
- `npm run build -w parent-portal`
- `npm run build`

## Where To Read Next

- `docs/README.md`
- `docs/ENTERPRISE-FEATURES.md`
- `docs/PRODUCTION.md`
- `docs/CAREERBUDDY-PRD.md`
- `docs/ADMIN-GUIDE.md`
- `docs/SCHOOLOS-PRD-GAP-ANALYSIS.md`

## License

Proprietary / Demo.

## Complete File Structure

Current project file list snapshot, excluding dependency, cache, and build-output internals such as `node_modules`, `dist`, `build`, `.gradle`, `.idea`, and `*.tsbuildinfo`.

```text
.env
.env.example
.gitignore
package-lock.json
package.json
README.md
tsconfig.base.json
apps/admin-dashboard/.env.example
apps/admin-dashboard/.env.production
apps/admin-dashboard/capacitor.config.ts
apps/admin-dashboard/index.html
apps/admin-dashboard/package.json
apps/admin-dashboard/postcss.config.js
apps/admin-dashboard/tailwind.config.js
apps/admin-dashboard/tsconfig.json
apps/admin-dashboard/vite.config.ts
apps/admin-dashboard/src/App.tsx
apps/admin-dashboard/src/index.css
apps/admin-dashboard/src/main.tsx
apps/admin-dashboard/src/components/ErrorBoundary.tsx
apps/admin-dashboard/src/components/Layout.tsx
apps/admin-dashboard/src/contexts/AuthContext.tsx
apps/admin-dashboard/src/contexts/ToastContext.tsx
apps/admin-dashboard/src/lib/api.ts
apps/admin-dashboard/src/pages/Academics.tsx
apps/admin-dashboard/src/pages/Admissions.tsx
apps/admin-dashboard/src/pages/Analytics.tsx
apps/admin-dashboard/src/pages/Announcements.tsx
apps/admin-dashboard/src/pages/Assignments.tsx
apps/admin-dashboard/src/pages/Attendance.tsx
apps/admin-dashboard/src/pages/CareerBuddy.tsx
apps/admin-dashboard/src/pages/Classes.tsx
apps/admin-dashboard/src/pages/Enquiries.tsx
apps/admin-dashboard/src/pages/Events.tsx
apps/admin-dashboard/src/pages/Exams.tsx
apps/admin-dashboard/src/pages/Finance.tsx
apps/admin-dashboard/src/pages/InnovationLab.tsx
apps/admin-dashboard/src/pages/Login.tsx
apps/admin-dashboard/src/pages/Overview.tsx
apps/admin-dashboard/src/pages/Ptm.tsx
apps/admin-dashboard/src/pages/Quizzes.tsx
apps/admin-dashboard/src/pages/Students.tsx
apps/admin-dashboard/src/pages/Teachers.tsx
apps/admin-dashboard/src/pages/Timetable.tsx
apps/admin-dashboard/src/pages/Users.tsx
apps/parent-portal/.env.example
apps/parent-portal/.env.production
apps/parent-portal/capacitor.config.ts
apps/parent-portal/index.html
apps/parent-portal/package.json
apps/parent-portal/postcss.config.js
apps/parent-portal/tailwind.config.js
apps/parent-portal/tsconfig.json
apps/parent-portal/vite.config.ts
apps/parent-portal/android/.gitignore
apps/parent-portal/android/build.gradle
apps/parent-portal/android/capacitor.settings.gradle
apps/parent-portal/android/gradle.properties
apps/parent-portal/android/gradlew
apps/parent-portal/android/gradlew.bat
apps/parent-portal/android/local.properties
apps/parent-portal/android/settings.gradle
apps/parent-portal/android/variables.gradle
apps/parent-portal/android/app/.gitignore
apps/parent-portal/android/app/build.gradle
apps/parent-portal/android/app/capacitor.build.gradle
apps/parent-portal/android/app/proguard-rules.pro
apps/parent-portal/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java
apps/parent-portal/android/app/src/main/AndroidManifest.xml
apps/parent-portal/android/app/src/main/assets/capacitor.config.json
apps/parent-portal/android/app/src/main/assets/capacitor.plugins.json
apps/parent-portal/android/app/src/main/assets/public/cordova.js
apps/parent-portal/android/app/src/main/assets/public/cordova_plugins.js
apps/parent-portal/android/app/src/main/assets/public/index.html
apps/parent-portal/android/app/src/main/assets/public/manifest.webmanifest
apps/parent-portal/android/app/src/main/assets/public/PWA-ASSETS.md
apps/parent-portal/android/app/src/main/assets/public/pwa-icon.svg
apps/parent-portal/android/app/src/main/assets/public/sw.js
apps/parent-portal/android/app/src/main/assets/public/workbox-b20fbdff.js
apps/parent-portal/android/app/src/main/assets/public/assets/index-CAbzvjLQ.js
apps/parent-portal/android/app/src/main/assets/public/assets/index-DSkYxYRK.css
apps/parent-portal/android/app/src/main/assets/public/assets/workbox-window.prod.es5-vqzQaGvo.js
apps/parent-portal/android/app/src/main/java/com/schoolos/parent/MainActivity.java
apps/parent-portal/android/app/src/main/res/drawable/ic_launcher_background.xml
apps/parent-portal/android/app/src/main/res/drawable/splash.png
apps/parent-portal/android/app/src/main/res/drawable-land-hdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-land-mdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-land-xhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-land-xxhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-land-xxxhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-port-hdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-port-mdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-port-xhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-port-xxhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-port-xxxhdpi/splash.png
apps/parent-portal/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml
apps/parent-portal/android/app/src/main/res/layout/activity_main.xml
apps/parent-portal/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
apps/parent-portal/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
apps/parent-portal/android/app/src/main/res/mipmap-hdpi/ic_launcher.png
apps/parent-portal/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
apps/parent-portal/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
apps/parent-portal/android/app/src/main/res/mipmap-mdpi/ic_launcher.png
apps/parent-portal/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
apps/parent-portal/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
apps/parent-portal/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
apps/parent-portal/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
apps/parent-portal/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
apps/parent-portal/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
apps/parent-portal/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
apps/parent-portal/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
apps/parent-portal/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
apps/parent-portal/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
apps/parent-portal/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
apps/parent-portal/android/app/src/main/res/values/ic_launcher_background.xml
apps/parent-portal/android/app/src/main/res/values/strings.xml
apps/parent-portal/android/app/src/main/res/values/styles.xml
apps/parent-portal/android/app/src/main/res/xml/config.xml
apps/parent-portal/android/app/src/main/res/xml/file_paths.xml
apps/parent-portal/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java
apps/parent-portal/android/capacitor-cordova-android-plugins/build.gradle
apps/parent-portal/android/capacitor-cordova-android-plugins/cordova.variables.gradle
apps/parent-portal/android/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml
apps/parent-portal/android/capacitor-cordova-android-plugins/src/main/java/.gitkeep
apps/parent-portal/android/capacitor-cordova-android-plugins/src/main/res/.gitkeep
apps/parent-portal/android/gradle/wrapper/gradle-wrapper.jar
apps/parent-portal/android/gradle/wrapper/gradle-wrapper.properties
apps/parent-portal/public/PWA-ASSETS.md
apps/parent-portal/public/pwa-icon.svg
apps/parent-portal/src/App.tsx
apps/parent-portal/src/index.css
apps/parent-portal/src/main.tsx
apps/parent-portal/src/components/Layout.tsx
apps/parent-portal/src/contexts/AuthContext.tsx
apps/parent-portal/src/lib/api.ts
apps/parent-portal/src/pages/Announcements.tsx
apps/parent-portal/src/pages/Attendance.tsx
apps/parent-portal/src/pages/ChildDetail.tsx
apps/parent-portal/src/pages/Dashboard.tsx
apps/parent-portal/src/pages/Insights.tsx
apps/parent-portal/src/pages/Login.tsx
apps/parent-portal/src/pages/Results.tsx
apps/student-portal/.env.example
apps/student-portal/.env.production
apps/student-portal/capacitor.config.ts
apps/student-portal/index.html
apps/student-portal/package.json
apps/student-portal/postcss.config.js
apps/student-portal/tailwind.config.js
apps/student-portal/tsconfig.json
apps/student-portal/vite.config.ts
apps/student-portal/public/PWA-ASSETS.md
apps/student-portal/public/pwa-icon.svg
apps/student-portal/src/App.tsx
apps/student-portal/src/index.css
apps/student-portal/src/main.tsx
apps/student-portal/src/components/Layout.tsx
apps/student-portal/src/contexts/AuthContext.tsx
apps/student-portal/src/lib/api.ts
apps/student-portal/src/pages/Announcements.tsx
apps/student-portal/src/pages/Assignments.tsx
apps/student-portal/src/pages/CareerBuddy.tsx
apps/student-portal/src/pages/Dashboard.tsx
apps/student-portal/src/pages/Fees.tsx
apps/student-portal/src/pages/Insights.tsx
apps/student-portal/src/pages/Login.tsx
apps/student-portal/src/pages/Results.tsx
docker/docker-compose.yml
docker/Dockerfile.admin
docker/Dockerfile.ai-engine
docker/Dockerfile.core-api
docker/Dockerfile.parent
docker/Dockerfile.student
docker/nginx-spa.conf
docker/nginx.conf
docs/ADMIN-GUIDE.md
docs/CAREERBUDDY-PRD.md
docs/ENTERPRISE-FEATURES.md
docs/PRODUCTION.md
docs/README.md
docs/SCHOOLOS-PRD-GAP-ANALYSIS.md
packages/shared-types/package.json
packages/shared-types/tsconfig.json
packages/shared-types/src/index.ts
packages/shared-utils/package.json
packages/shared-utils/tsconfig.json
packages/shared-utils/src/index.ts
packages/shared-utils/src/validation.ts
prisma/schema.prisma
prisma/seed.ts
services/ai-engine/main.py
services/ai-engine/requirements.txt
services/careerbuddy-engine/package.json
services/careerbuddy-engine/tsconfig.json
services/careerbuddy-engine/src/index.ts
services/core-api/package.json
services/core-api/tsconfig.json
services/core-api/src/index.ts
services/core-api/src/config/env.ts
services/core-api/src/lib/genai.ts
services/core-api/src/lib/health.ts
services/core-api/src/lib/prisma.ts
services/core-api/src/middleware/audit.ts
services/core-api/src/middleware/auth.ts
services/core-api/src/middleware/errorHandler.ts
services/core-api/src/middleware/rateLimit.ts
services/core-api/src/middleware/rbac.ts
services/core-api/src/middleware/requestId.ts
services/core-api/src/middleware/validate.ts
services/core-api/src/routes/academics.ts
services/core-api/src/routes/admissions.ts
services/core-api/src/routes/analytics.ts
services/core-api/src/routes/announcements.ts
services/core-api/src/routes/assignments.ts
services/core-api/src/routes/attendance.ts
services/core-api/src/routes/auth.ts
services/core-api/src/routes/careerbuddy.ts
services/core-api/src/routes/classes.ts
services/core-api/src/routes/enquiries.ts
services/core-api/src/routes/events.ts
services/core-api/src/routes/exams.ts
services/core-api/src/routes/finance.ts
services/core-api/src/routes/grades.ts
services/core-api/src/routes/innovation.ts
services/core-api/src/routes/integrations.ts
services/core-api/src/routes/ptm.ts
services/core-api/src/routes/quizzes.ts
services/core-api/src/routes/schools.ts
services/core-api/src/routes/students.ts
services/core-api/src/routes/teachers.ts
services/core-api/src/routes/timetable.ts
services/core-api/src/routes/users.ts
```
