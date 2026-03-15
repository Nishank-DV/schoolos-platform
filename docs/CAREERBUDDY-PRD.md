# CareerBuddy – PRD alignment

This document maps the [CareerBuddy PRD](PRD reference) to the current implementation.

---

## 1. Product positioning

| PRD | Implementation |
|-----|-----------------|
| Module inside SchoolOS, visible for Grade 9 & 10 | CareerBuddy appears in Student portal for logged-in students; backend restricts assessment to students with profile; teacher analytics filter by grade 9 & 10. |
| Navigation: SchoolOS → Modules → CareerBuddy | Student portal: **CareerBuddy** in nav. Admin: **CareerBuddy** in sidebar (sessions + teacher dashboard). |

---

## 2. Core functional components

### 5.1 Student Profile Context Engine

| PRD | Implementation |
|-----|-----------------|
| Collect: Name, Grade, School, Favorite subjects, Hobbies, Liked/Disliked activities | **CareerProfile** (Prisma): `favoriteSubjects`, `hobbies`, `likedActivities`, `dislikedActivities`. Name, grade, school come from linked **Student** and **School**. |
| Used by GenAI for adaptive questions | GenAI adapter uses profile in `generateAssessmentQuestion` and `generateCareerRecommendations`. |

### 5.2 GenAI Adaptive Assessment Engine

| PRD | Implementation |
|-----|-----------------|
| Dynamic questions via Generative AI | `genai.generateAssessmentQuestion(category, profile, previousResponses)` – LM Studio or fallback. |
| Adapts by profile + previous responses | Profile and `previousResponses` passed into prompt; category rotates interest / personality / aptitude. |
| **Interest discovery** (technology, science, business, design, social impact) | Themes in `INTEREST_THEMES`; prompts ask for one short question by theme. |
| **Personality indicators** (analytical, creativity, leadership, empathy, curiosity, collaboration) | `PERSONALITY_TRAITS` in genai; questions generated accordingly. |
| **Aptitude indicators** (logical, numerical, pattern, language) | `APTITUDE_AREAS` in genai. |

### 5.3 Career Recommendation Engine

| PRD | Implementation |
|-----|-----------------|
| Analyze interest, personality, aptitude | `analyzeAssessmentResponses` + `generateCareerRecommendations` use profile and responses. |
| Top career matches + Alternate careers | `topCareers` and `alternateCareers` (each with career name + optional overview, skills, education, demand). |
| Per career: overview, skills required, education path, future demand | Stored in **CareerRecommendation.details** (JSON). GenAI prompt asks for this format; fallback mock includes sample details. |

### 5.4 Stream Recommendation Engine

| PRD | Implementation |
|-----|-----------------|
| For Grade 10 (and 9) stream guidance | `generateStreamRecommendation(profile, responses)` – uses profile and grade. |
| Recommended stream (e.g. MPC) + Alternate streams (e.g. MPC+CS) | Returns `{ recommended, alternateStreams }`. Stored in **CareerReport**: `streamRecommendation`, `alternateStreams` (JSON array). |

### 5.5 Career Discovery Report

| PRD | Implementation |
|-----|-----------------|
| Student Interest Profile | **CareerReport.interestProfile** (text from `analyzeAssessmentResponses`). |
| Personality Indicators | **CareerReport.personalityIndicators** (JSON array). |
| Aptitude Indicators | **CareerReport.aptitudeIndicators** (JSON array). |
| Top Career Recommendations | From **CareerRecommendation** (category = top) with **details**. |
| Suggested Academic Streams | **CareerReport.streamRecommendation** + **alternateStreams**. |
| Skill Development Suggestions | **CareerReport.skillDevelopmentSuggestions** (text; from GenAI or default list). |
| Download as PDF / share with parents | Student report view has **Download / Print PDF** (browser print → save as PDF). Parent can view report on Child detail. |

---

## 3. Teacher dashboard (PRD §6)

| PRD | Implementation |
|-----|-----------------|
| Student assessment completion rate | **GET /api/careerbuddy/teacher/analytics** → `completionRate`, `completedCount`, `totalEligible`. |
| Class-level career interest distribution | **interestDistribution** (Engineering & Tech, Business, Creative, Research) derived from top career counts. |
| Popular career categories | **popularCareers** (career name + count). |
| Skill clusters among students | **skillClusters** (e.g. Programming & Tech, Analytical, Leadership). |
| UI | Admin **CareerBuddy** → tab **Teacher dashboard** with completion rate, interest distribution, popular careers, skill clusters. |

---

## 4. Parent access (PRD §7)

| PRD | Implementation |
|-----|-----------------|
| View student career discovery report | **GET /api/careerbuddy/reports/student/:studentId** (parent role; only own children). |
| Recommended streams + skill development suggestions | Parent **Child detail** page shows CareerBuddy section: recommended stream, alternate streams, top careers, skill development text. |

---

## 5. Data flow (PRD §9)

1. Student logs into SchoolOS → Student portal login.
2. Student opens CareerBuddy → **CareerBuddy** nav.
3. Profile context collected → **CareerProfile** (edit profile + parental consent).
4. GenAI generates contextual questions → **GET next-question** → `generateAssessmentQuestion`.
5. Student completes adaptive assessment → **POST respond** per question.
6. Responses stored → **AssessmentResponse**.
7. Recommendation engine runs → On **POST complete**, `generateCareerRecommendations` + `analyzeAssessmentResponses` + `generateStreamRecommendation`.
8. Career suggestions + report created → **CareerRecommendation** + **CareerReport** with all sections above.

---

## 6. Security and privacy (PRD §10)

| PRD | Implementation |
|-----|-----------------|
| Role-based access | RBAC: student (own profile/sessions/report), parent (own children’s report), teacher/admin (sessions + analytics). |
| Parental consent | **CareerProfile.parentalConsent** must be true to start assessment. |
| Student data not shared externally | No external sharing; APIs are authenticated and scoped. |

---

## 7. Database (PRD §8)

| PRD table | Implementation |
|-----------|----------------|
| students | **Student** (existing). |
| student_profiles | **CareerProfile** (favorite subjects, hobbies, liked/disliked activities, parental consent). |
| assessment_sessions | **AssessmentSession**. |
| assessment_questions | **AssessmentQuestion** (category: interest/personality/aptitude). |
| assessment_responses | **AssessmentResponse**. |
| career_recommendations | **CareerRecommendation** (career, category top/alternate, **details** JSON). |
| career_reports | **CareerReport** (stream, alternateStreams, interestProfile, personalityIndicators, aptitudeIndicators, skillDevelopmentSuggestions, summary, reportUrl). |

---

## 8. Optional / future (PRD Phases 2–3)

- **Career explorer library** (Phase 2): not implemented; could be a static or dynamic list of careers with descriptions.
- **AI career mentor chatbot** (Phase 3): not implemented.
- **PDF generation on server**: currently “Print → Save as PDF”; server-side PDF (e.g. Puppeteer or PDF lib) can be added for a dedicated download link.
