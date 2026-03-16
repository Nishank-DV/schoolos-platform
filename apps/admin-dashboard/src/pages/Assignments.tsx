import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type TabKey = "assignments" | "submissions";

type ClassRow = { id: string; name: string; grade: number };
type SectionRow = { id: string; name: string; classId: string };
type SubjectRow = { id: string; name: string; classId: string | null };
type TeacherRow = { id: string; firstName: string; lastName: string; email: string };
type AcademicYearRow = { id: string; name: string; isActive: boolean };

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  class: { id: string; name: string; grade: number };
  section: { id: string; name: string };
  subject: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
  academicYear: { id: string; name: string; isActive: boolean };
  _count?: { submissions: number };
};

type SubmissionRow = {
  id: string;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  assignment: { id: string; title: string };
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "assignments", label: "Assignments" },
  { id: "submissions", label: "Submissions" },
];

export default function Assignments() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("assignments");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isClassOptionsLoading, setIsClassOptionsLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const [form, setForm] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
    teacherId: "",
    academicYearId: "",
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    maxMarks: 100,
  });

  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [gradingForm, setGradingForm] = useState({ grade: 0, feedback: "" });
  const [filter, setFilter] = useState({ assignmentId: "", status: "all" });

  const sectionsForClass = useMemo(() => sections.filter((s) => s.classId === form.classId), [sections, form.classId]);
  const subjectsForClass = useMemo(() => subjects.filter((s) => s.classId === form.classId || !s.classId), [subjects, form.classId]);

  async function loadDependentOptions(classId: string) {
    if (!classId) {
      setSections([]);
      setSubjects([]);
      return;
    }

    setIsClassOptionsLoading(true);
    try {
      const [sectionData, subjectData] = await Promise.all([
        apiGet<Paged<SectionRow>>(`/api/academics/sections?page=1&pageSize=200&classId=${encodeURIComponent(classId)}`),
        apiGet<Paged<SubjectRow>>(`/api/academics/subjects?page=1&pageSize=200&classId=${encodeURIComponent(classId)}`),
      ]);
      setSections(sectionData.items ?? []);
      setSubjects(subjectData.items ?? []);
    } finally {
      setIsClassOptionsLoading(false);
    }
  }

  async function loadAll() {
    setPageError("");
    setIsInitialLoading(true);
    const errors: string[] = [];

    const [classData, teacherData, yearData, assignmentData] = await Promise.allSettled([
        apiGet<Paged<ClassRow>>("/api/academics/classes?page=1&pageSize=200"),
        apiGet<Paged<TeacherRow>>("/api/teachers?page=1&pageSize=200"),
        apiGet<Paged<AcademicYearRow>>("/api/academics/years?page=1&pageSize=100"),
        apiGet<Paged<AssignmentRow>>("/api/assignments?page=1&pageSize=200"),
    ]);

    const classItems = classData.status === "fulfilled" ? (classData.value.items ?? []) : [];
    const teacherItems = teacherData.status === "fulfilled" ? (teacherData.value.items ?? []) : [];
    const yearItems = yearData.status === "fulfilled" ? (yearData.value.items ?? []) : [];
    const assignmentItems = assignmentData.status === "fulfilled" ? (assignmentData.value.items ?? []) : [];

    if (classData.status === "rejected") errors.push(classData.reason instanceof Error ? classData.reason.message : "Failed to load classes");
    if (teacherData.status === "rejected") errors.push(teacherData.reason instanceof Error ? teacherData.reason.message : "Failed to load teachers");
    if (yearData.status === "rejected") errors.push(yearData.reason instanceof Error ? yearData.reason.message : "Failed to load academic years");
    if (assignmentData.status === "rejected") errors.push(assignmentData.reason instanceof Error ? assignmentData.reason.message : "Failed to load assignments");

    setClasses(classItems);
    setTeachers(teacherItems);
    setYears(yearItems);
    setAssignments(assignmentItems);

    const fallbackYearId = yearItems.find((y) => y.isActive)?.id ?? yearItems[0]?.id ?? "";
    const fallbackClassId = classItems[0]?.id ?? "";

    const nextClassId = classItems.some((c) => c.id === form.classId) ? form.classId : fallbackClassId;
    const nextYearId = yearItems.some((y) => y.id === form.academicYearId) ? form.academicYearId : fallbackYearId;

    setForm((prev) => ({
      ...prev,
      classId: nextClassId,
      sectionId: "",
      subjectId: "",
      teacherId: teacherItems.some((t) => t.id === prev.teacherId) ? prev.teacherId : (teacherItems[0]?.id ?? ""),
      academicYearId: nextYearId,
    }));

    try {
      await loadDependentOptions(nextClassId);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Failed to load sections/subjects");
      setSections([]);
      setSubjects([]);
    }

    if (errors.length > 0) {
      const message = errors[0];
      setPageError(message);
      addToast(message, "error");
    }

    setIsInitialLoading(false);
  }

  async function loadSubmissions(assignmentId?: string) {
    if (!assignmentId) {
      setSubmissions([]);
      return;
    }

    try {
      const qs = new URLSearchParams({ page: "1", pageSize: "200" });
      const data = await apiGet<Paged<SubmissionRow>>(`/api/assignments/${encodeURIComponent(assignmentId)}/submissions?${qs.toString()}`);
      setSubmissions(data.items ?? []);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load submissions", "error");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleClassChange(classId: string) {
    setForm((prev) => ({ ...prev, classId, sectionId: "", subjectId: "" }));
    try {
      await loadDependentOptions(classId);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load sections and subjects", "error");
    }
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/assignments", {
        classId: form.classId,
        sectionId: form.sectionId,
        subjectId: form.subjectId,
        teacherId: form.teacherId,
        academicYearId: form.academicYearId,
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate,
        maxMarks: form.maxMarks,
      });
      addToast("Assignment created", "success");
      setForm({
        classId: "",
        sectionId: "",
        subjectId: "",
        teacherId: "",
        academicYearId: "",
        title: "",
        description: "",
        dueDate: new Date().toISOString().split("T")[0],
        maxMarks: 100,
      });
      await loadAll();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create assignment", "error");
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!confirm("Delete this assignment?")) return;
    try {
      await apiDelete(`/api/assignments/${id}`);
      addToast("Assignment deleted", "success");
      await loadAll();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete assignment", "error");
    }
  }

  async function handleGradeSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!gradingSubmissionId) return;
    try {
      await apiPatch(`/api/assignments/submissions/${gradingSubmissionId}`, {
        grade: gradingForm.grade || null,
        feedback: gradingForm.feedback || null,
      });
      addToast("Submission graded", "success");
      setGradingSubmissionId(null);
      setGradingForm({ grade: 0, feedback: "" });
      if (filter.assignmentId) await loadSubmissions(filter.assignmentId);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to grade submission", "error");
    }
  }

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      if (filter.status === "graded" && s.grade === null) return false;
      if (filter.status === "submitted" && s.grade !== null) return false;
      return true;
    });
  }, [submissions, filter.status]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
      <p className="mt-1 text-slate-500">Manage assignments and grade submissions.</p>
      {pageError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm ${activeTab === tab.id ? "bg-primary-600 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "assignments" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <form onSubmit={handleCreateAssignment} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create assignment</h2>
            <select
              value={form.classId}
              onChange={(e) => {
                handleClassChange(e.target.value);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            >
              <option value="">Select class</option>
              {isInitialLoading && <option value="" disabled>Loading classes...</option>}
              {!isInitialLoading && classes.length === 0 && <option value="" disabled>No classes found</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={form.sectionId} onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" disabled={!form.classId || isClassOptionsLoading} required>
              {!form.classId && <option value="">Select class first</option>}
              {form.classId && isClassOptionsLoading && <option value="">Loading sections...</option>}
              {form.classId && !isClassOptionsLoading && sectionsForClass.length === 0 && <option value="">No sections found</option>}
              {form.classId && !isClassOptionsLoading && sectionsForClass.length > 0 && <option value="">Select section</option>}
              {sectionsForClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" disabled={!form.classId || isClassOptionsLoading} required>
              {!form.classId && <option value="">Select class first</option>}
              {form.classId && isClassOptionsLoading && <option value="">Loading subjects...</option>}
              {form.classId && !isClassOptionsLoading && subjectsForClass.length === 0 && <option value="">No subjects found</option>}
              {form.classId && !isClassOptionsLoading && subjectsForClass.length > 0 && <option value="">Select subject</option>}
              {subjectsForClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={form.teacherId} onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
            <select value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select academic year</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="w-full rounded-lg border px-3 py-2 text-sm" required />
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required />
              <input type="number" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: Number(e.target.value) }))} placeholder="Max marks" className="w-full rounded-lg border px-3 py-2 text-sm" min={1} required />
            </div>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">
              Create
            </button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Assignments</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Subject</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Max</th>
                    <th className="px-2 py-2">Subs</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2">{a.title}</td>
                      <td className="px-2 py-2">{a.class.name}</td>
                      <td className="px-2 py-2">{a.subject.name}</td>
                      <td className="px-2 py-2">{new Date(a.dueDate).toLocaleDateString()}</td>
                      <td className="px-2 py-2">{a.maxMarks}</td>
                      <td className="px-2 py-2">{a._count?.submissions ?? 0}</td>
                      <td className="px-2 py-2 flex gap-1">
                        <button type="button" onClick={() => { handleDeleteAssignment(a.id); }} className="text-xs text-red-600 hover:text-red-800">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "submissions" && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <select
              value={filter.assignmentId}
              onChange={(e) => {
                setFilter((f) => ({ ...f, assignmentId: e.target.value }));
                loadSubmissions(e.target.value);
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All assignments</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
              <option value="all">All submissions</option>
              <option value="submitted">Submitted (not graded)</option>
              <option value="graded">Graded</option>
            </select>
          </div>

          {gradingSubmissionId && (
            <form onSubmit={handleGradeSubmission} className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="font-semibold">Grade submission</h2>
              <input
                type="number"
                value={gradingForm.grade}
                onChange={(e) => setGradingForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                placeholder="Grade"
                className="w-full rounded-lg border px-3 py-2"
                min={0}
              />
              <textarea
                value={gradingForm.feedback}
                onChange={(e) => setGradingForm((f) => ({ ...f, feedback: e.target.value }))}
                placeholder="Feedback (optional)"
                className="w-full rounded-lg border px-3 py-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">
                  Save
                </button>
                <button type="button" onClick={() => setGradingSubmissionId(null)} className="rounded-lg border px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Submissions</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Assignment</th>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Submitted</th>
                    <th className="px-2 py-2">Grade</th>
                    <th className="px-2 py-2">Feedback</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2">{s.assignment.title}</td>
                      <td className="px-2 py-2">
                        {s.student.firstName} {s.student.lastName}
                      </td>
                      <td className="px-2 py-2">{new Date(s.submittedAt).toLocaleDateString()}</td>
                      <td className="px-2 py-2">{s.grade ?? "-"}</td>
                      <td className="px-2 py-2 truncate">{s.feedback ?? "-"}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGradingSubmissionId(s.id);
                            setGradingForm({ grade: s.grade ?? 0, feedback: s.feedback ?? "" });
                          }}
                          className="text-xs text-primary-600 hover:text-primary-800"
                        >
                          Grade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
