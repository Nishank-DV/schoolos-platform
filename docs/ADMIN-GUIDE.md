# SchoolOS Admin Guide

How to manage the whole application as an admin: users, students, staff, privileges, and CareerBuddy.

---

## 1. Who is an admin?

- **Superadmin** – Can manage all schools, create school admins, and manage any user.
- **School admin** – Can manage only their own school: users in that school, students, teachers, classes, assignments, attendance, finance, announcements, and view CareerBuddy sessions.

Log in at **Admin Dashboard** (e.g. http://localhost:3000) with:
- Superadmin: (create via API or seed)
- School admin: `admin@schoolos.demo` / `Admin@123`

---

## 2. Managing users and privileges

Privileges are controlled by **roles**. Each login account is a **User** with one role.

### Roles and what they can do

| Role | Can do |
|------|--------|
| **superadmin** | Everything; manage all schools and users. |
| **school_admin** | Full management of their school: users, students, teachers, classes, assignments, attendance, finance, announcements, analytics, CareerBuddy view. |
| **teacher** | View/edit classes, assignments, grades, attendance (for their school). View analytics. |
| **parent** | View their linked children: attendance, grades, fees. |
| **student** | View own homework, grades; use CareerBuddy (if consent given). |
| **integration_service** | API access (e.g. get student context for CareerBuddy). |

### How to add or remove users

1. Go to **Users** in the sidebar.
2. **Add user**  
   - Click **Add user**.  
   - Enter **email**, **password** (min 8 chars), and **role**.  
   - School admin can only create users in their school; role is the privilege level.
3. **Change role (privilege)**  
   - In the Users table, click **Change role** for a user, pick a new role, then **Save**.
4. **Remove user**  
   - Click **Remove** for that user. They will no longer be able to log in.  
   - School admin can only remove users belonging to their school. Only superadmin can remove another superadmin.

### Linking a user to a student, parent, or teacher

- When you **create a user** with role `student`, `parent`, or `teacher`, you can optionally link them to an existing record:
  - **Student**: create the student first (see below), then create a user with role `student` and set `studentId` (via API or “Create login” when adding a student).
  - **Parent** / **Teacher**: create the parent/teacher record first (via API if needed), then create a user with the same role and set `parentId` or `teacherId`.
- In the admin UI, when you **Add student** you can check **Create login for this student** and enter email/password; that creates both the student and a linked user with role `student`.

---

## 3. Managing students

1. Go to **Students** in the sidebar.
2. **Add student**  
   - Click **Add student**.  
   - Fill: Admission #, First name, Last name, Grade, Section, Class (optional).  
   - Optionally check **Create login for this student** and set email/password so they can log in to the student portal.
3. **Remove student**  
   - Click **Remove** next to the student. This deletes the student record (and any login linked to them is handled by your data rules).

Editing students (e.g. change class, status) is supported via the API (`PATCH /api/students/:id`); you can add an edit form in the UI later.

---

## 4. Managing teachers and parents

- **Teachers**: Listed under **Teachers**. Adding/removing teachers is done via API: `POST` to create a teacher (you’d add a similar “Add teacher” form like students), then create a user with role `teacher` and `teacherId` to give them login and privileges.
- **Parents**: Similarly, parent records and then users with role `parent` and `parentId`. Parents see only their linked children.

Giving “certain privileges” to staff or parents means **creating or updating their user and setting the right role** (e.g. `teacher`, `parent`, `school_admin`).

---

## 5. CareerBuddy: “putting exams” and what admin can do

CareerBuddy in this MVP uses **AI-generated questions** during a student’s assessment (from LM Studio or the built-in mock). There is **no separate “exam” that an admin uploads or schedules**; each assessment is generated on the fly.

What admin **can** do:

- **View CareerBuddy usage**  
  Go to **CareerBuddy** in the sidebar to see assessment sessions: who started/completed, when, and (from reports) stream recommendation and career suggestions.
- **Control who can take assessments**  
  Students need **parental consent** on their career profile before they can start an assessment. Consent is set by the student/parent in the student portal (or via API).
- **Student context for AI**  
  Admin (or integration) can use `GET /api/students/:id/context` to pass student context (subjects, hobbies, etc.) into the AI/career engine.

If you later add “exams” (e.g. fixed question banks), that would be a new feature: e.g. an “Assessment templates” or “Question bank” section where admin creates/edits questions and assigns them to grades or streams.

---

## 6. Other admin tasks (quick reference)

| Task | Where | Notes |
|------|--------|------|
| Overview stats | **Overview** | Students, teachers, classes, attendance rate, average grade. |
| Classes | **Classes** | View classes and class teachers. |
| Assignments | **Assignments** | View/create/edit assignments (admin or teacher). |
| Attendance | **Attendance** | View/mark attendance. |
| Finance | **Finance** | Fee structures, payments, dashboard. |
| Innovation Lab | **Innovation Lab** | View (and add, via API) logs/certifications. |
| Analytics | **Analytics** | Overview and learning-gaps view. |
| Announcements | **Announcements** | Create/edit school-wide announcements. |

---

## 7. API summary for admins

- **Users**: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`
- **Students**: `GET /api/students`, `POST /api/students`, `PATCH /api/students/:id`, `DELETE /api/students/:id`
- **Teachers**: `GET /api/teachers`
- **Schools**: `GET /api/schools`, `POST /api/schools` (superadmin), `PATCH /api/schools/:id`
- **CareerBuddy**: `GET /api/careerbuddy/admin/sessions` (view sessions)

Use the Admin Dashboard for day-to-day management; use the API for bulk operations or integration.
