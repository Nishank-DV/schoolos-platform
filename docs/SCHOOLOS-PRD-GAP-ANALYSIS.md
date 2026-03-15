# SchoolOS Master PRD – Gap Analysis

This document maps the **SchoolOS Master PRD (Final)** to the current codebase. Each PRD section is marked as **Done**, **Partial**, or **Not started**, with concrete gaps listed.

---

## 1. Core ERP Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| **Student Lifecycle** | | |
| Enquiry CRM | **Done** | Enquiry model, list/create/patch, Enquiries admin page |
| Admission workflow | **Partial** | Students created directly; no staged admission/enrollment steps |
| Enrollment automation | **Not started** | No automation or document checks |
| Document uploads | **Partial** | Document model exists; no upload API or UI |
| Student demographic management | **Done** | Student CRUD, grade, section, class, parent |
| Academic history | **Partial** | Grades per subject/term; no formal “history” or transfer record |
| Transfer & promotion workflow | **Not started** | No transfer/promotion state machine |
| **Attendance** | | |
| Manual | **Done** | POST/list attendance by student/date |
| QR Code / Biometric / Bus GPS | **Not started** | No QR, biometric, or GPS integration |
| Late entry alerts | **Not started** | Status can be "late"; no alert pipeline |
| Parent instant notification | **Not started** | No push/SMS/notification on attendance |
| **Staff Management** | | |
| Teacher profile, qualification, salary, performance, leave | **Partial** | Teacher CRUD; no qualification/salary/leave/performance models |
| **Timetable** | **Partial** | TimetableSlot model, list/create/delete slots, Timetable admin page; no conflict detection or substitute UI |
| **Transport** | **Not started** | No routes, GPS, bus attendance, emergency alerts |
| **Hostel** | **Not started** | No room allocation, meal tracking, health log |
| **Documents (generation)** | **Not started** | No ID cards, bonafide, TC, report cards, template builder |

---

## 2. Academic & LMS Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Curriculum planner (Yearly → Term → Weekly) | **Not started** | No curriculum/unit planning |
| Lesson plan builder | **Not started** | No lesson plans |
| Digital content upload | **Not started** | No content repository |
| Assignment creation | **Done** | Assignments with class/subject, due date, max marks |
| Auto grading (MCQ) | **Done** | Quiz engine with MCQ, auto-grade on submit |
| Manual grading (rubric) | **Partial** | Marks/feedback on submissions; no rubric model |
| Quiz engine | **Done** | Quiz, QuizQuestion, QuizAttempt; create quiz, add questions, student start/submit; Quizzes admin page |
| Exam hall ticket generator | **Not started** | No exam/hall ticket |
| Report card designer | **Not started** | No template designer or PDF report cards |
| Gradebook analytics | **Partial** | Grades list; no analytics view or attendance–grade correlation |
| Attendance–performance correlation | **Not started** | Not in analytics |
| SCORM / Plagiarism / ePortfolio | **Not started** | None in codebase |

---

## 3. Parent Intelligence App

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| **Dashboard** | | |
| Attendance %, Fee dues, Homework, Exam schedule, Performance graph | **Partial** | Attendance, fees, homework (via child); no exam schedule or performance graph on parent UI |
| **AI Layer** | **Partial** | Weak subject API, monthly summary API (grade/attendance-based); no behavioral trend or full AI report |
| **Communication** | | |
| Direct teacher chat | **Not started** | No chat |
| School announcements | **Partial** | Announcements exist; parent app does not show them yet |
| Event calendar | **Done** | Event model/API, Events admin page |
| PTM booking | **Done** | PtmSlot, PtmBooking; list/create slots, parent book, PTM admin page |
| Emergency broadcast | **Not started** | No broadcast channel |
| **Premium** (Career roadmap, benchmark, growth forecasting) | **Not started** | CareerBuddy report shown; no premium tier or benchmarking |

---

## 4. Student Experience App

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Homework tracker, Assignment upload, Quiz attempt | **Done** | Assignments + submit; Quiz start/submit with auto-grade |
| Progress tracking, Skill score | **Partial** | Grades shown; no skill score or formal progress |
| Innovation portfolio | **Partial** | Innovation logs in backend; limited student-facing portfolio |
| Badge system | **Not started** | No badges |
| Career dashboard | **Done** | CareerBuddy report and assessment |
| Peer collaboration group | **Not started** | No groups |
| Mentor feedback | **Not started** | No mentor/feedback model |

---

## 5. Innovation & Lab Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Robotics / AI / IoT session tracking | **Partial** | InnovationLog has type (robotics, ai_experiment, iot); no “session” or kit allocation |
| Lab inventory, Kit allocation | **Not started** | No inventory or kit models |
| Hackathon module | **Partial** | Type "hackathon" in InnovationLog; no dedicated hackathon workflow |
| Innovation showcase gallery | **Not started** | No gallery or public showcase |
| Research journal | **Partial** | Type "research" in InnovationLog; no journal UI |
| Skill certification tracking | **Done** | SkillCertification model + API |
| Mentor evaluation scoring | **Not started** | No mentor evaluation model |

---

## 6. AI & Predictive Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| **Management** | | |
| School performance dashboard | **Partial** | Analytics overview (counts, attendance rate, avg grade) |
| Class comparison heatmap | **Not started** | No heatmap |
| Teacher performance matrix | **Not started** | No teacher analytics |
| Dropout risk prediction | **Not started** | No risk model |
| Attendance anomaly detection | **Not started** | No anomaly pipeline |
| **Students** | | |
| Skill growth chart, Learning gap, Adaptive suggestion, Career stream | **Partial** | CareerBuddy stream/career; learning-gaps stub only |
| **Parents** | | |
| Personalized alerts, Weekly summary, Predictive academic outlook | **Partial** | Monthly summary API (attendance + low subjects + suggestion); no push alerts or predictive outlook |

---

## 7. Communication & Community Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Multi-channel (App / SMS / Email) | **Partial** | In-app announcements only |
| Auto translation (100+ languages) | **Not started** | No translation |
| Notice board | **Partial** | Announcements serve as notice board |
| Forms & permission slips | **Not started** | No forms |
| Event RSVP | **Partial** | Events model/API; no RSVP flow yet |
| Surveys & polls | **Not started** | No surveys |
| Alumni / Internship / Scholarship board | **Not started** | None |

---

## 8. Finance & Billing Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Fee structure, Installments | **Done** | FeeStructure + payments with due dates |
| Late fee automation | **Partial** | FeeStructure.lateFeePercent field; automation logic not wired |
| Discount management | **Partial** | FeeStructure.discountPercent field; rules not wired |
| Payment gateway | **Not started** | No gateway integration |
| Auto reconciliation | **Not started** | No reconciliation |
| Financial dashboard, Revenue reports, Outstanding alerts | **Partial** | Dashboard stub; no revenue/outstanding reports |

---

## 9. Enterprise & Integration Engine

| PRD Feature | Status | Notes |
|-------------|--------|--------|
| Multi-school management | **Done** | School model, schoolId scoping |
| Chain dashboard | **Not started** | No chain/group dashboard |
| Role-based access control | **Done** | RBAC with roles |
| Two-factor authentication | **Not started** | No 2FA |
| API access | **Partial** | REST API; no public API key/docs for external consumers |
| Google / Microsoft SSO | **Not started** | No SSO |
| Library / Biometric / Zoom–Meet / Data export & compliance | **Not started** | None |

---

## 10. Security Framework (PRD Section 5)

| Item | Status | Notes |
|------|--------|--------|
| Encrypted DB, TLS, Backup, RBAC, Audit logs | **Partial** | RBAC + audit on key mutations; TLS/backup/encryption are deployment concerns |
| GDPR / Indian Data Protection / Penetration testing | **Not started** | Documented in ENTERPRISE-FEATURES; no compliance tooling in code |

---

## 11. Tech Stack (PRD Section 6)

| Item | Status | Notes |
|------|--------|--------|
| React (Admin) | **Done** | Admin dashboard is React + Vite |
| React Native (Parent & Student) | **Partial** | Parent and Student are **React web apps**, not React Native |
| Node.js backend | **Done** | Express in core-api |
| Python microservices (AI) | **Done** | ai-engine (FastAPI) + genai in core-api |
| PostgreSQL | **Done** | Prisma + PostgreSQL |
| AWS / Render / Supabase | **Partial** | Docker + env; no cloud-specific wiring |

---

## Summary: Why It Feels Incomplete

- The **Master PRD** describes a **full 9-engine school OS** with many sub-features per engine.
- The **current build** is a **focused MVP**: Core ERP (students, staff, classes, attendance), LMS (assignments, grades), one Innovation module (logs + certifications), one AI module (CareerBuddy), simple Finance and Communication (announcements).
- **Recently added for MVP alignment**: Enquiry CRM, Timetable (slots), Quiz engine (MCQ + attempts), Events, PTM slots & booking, FeeStructure late fee/discount fields, Parent AI (weak subjects + monthly summary APIs). Admin nav: Enquiries, Timetable, Quizzes, Events, PTM.
- **Still not implemented**: Full admission workflow, Transport, Hostel, Document generation, Report card designer, Multi-channel messaging, Payment gateway, 2FA/SSO, Chain dashboard, React Native apps.

**Recommendation:** Treat this codebase as **MVP Phase 1**. Use this gap analysis to plan Phase 2 by engine. After schema changes, run `npx prisma generate` and `npx prisma db push` (close any process using the DB/client first if on Windows).
