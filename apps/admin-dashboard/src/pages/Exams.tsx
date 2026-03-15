import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type TabKey = "exams" | "subjects" | "marks" | "results";
type ExamStatus = "draft" | "published" | "completed";

type ClassRow = { id: string; name: string; grade: number };
type YearRow = { id: string; name: string; isActive: boolean };
type SubjectRow = { id: string; name: string; code: string | null; classId: string | null };
type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string; classId: string | null };

type ExamRow = {
  id: string;
  classId: string;
  academicYearId: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  class: { id: string; name: string; grade: number };
  academicYear: { id: string; name: string; isActive: boolean };
  _count?: { examSubjects: number; results: number };
};

type ExamSubjectRow = {
  id: string;
  examId: string;
  subjectId: string;
  maxMarks: number;
  passMarks: number;
  subject: { id: string; name: string; code: string | null };
  _count?: { studentMarks: number };
};

type StudentMarkRow = {
  id: string;
  examSubjectId: string;
  studentId: string;
  marksObtained: number;
  grade: string | null;
  remarks: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
};

type ExamMarksResponse = {
  examId: string;
  subjects: Array<ExamSubjectRow & { studentMarks: StudentMarkRow[] }>;
};

type ExamResultRow = {
  id: string;
  studentId: string;
  totalMarks: number;
  percentage: number;
  gpa: number;
  rank: number | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
};

type ExamResultsResponse = {
  exam: ExamRow;
  results: ExamResultRow[];
  summary: { studentCount: number; averagePercentage: number; passCount: number; topper: { studentId: string; name: string; percentage: number } | null };
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "exams", label: "Exams" },
  { id: "subjects", label: "Exam Subjects" },
  { id: "marks", label: "Marks Entry" },
  { id: "results", label: "Results" },
];

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function Exams() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("exams");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [examSubjects, setExamSubjects] = useState<ExamSubjectRow[]>([]);
  const [examMarks, setExamMarks] = useState<ExamMarksResponse | null>(null);
  const [examResults, setExamResults] = useState<ExamResultsResponse | null>(null);

  const [examForm, setExamForm] = useState({
    classId: "",
    academicYearId: "",
    name: "",
    description: "",
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date()),
    status: "draft" as ExamStatus,
  });

  const [subjectForm, setSubjectForm] = useState({ subjectId: "", maxMarks: 100, passMarks: 35 });
  const [marksSubjectId, setMarksSubjectId] = useState("");
  const [marksDraft, setMarksDraft] = useState<Record<string, { marksObtained: number; remarks: string; markId?: string }>>({});
  const [examSubjectDrafts, setExamSubjectDrafts] = useState<Record<string, { maxMarks: number; passMarks: number }>>({});

  async function loadBaseData() {
    const [classRes, yearRes, subjectRes, studentRes, examRes] = await Promise.all([
      apiGet<Paged<ClassRow>>("/api/academics/classes?page=1&pageSize=200"),
      apiGet<Paged<YearRow>>("/api/academics/years?page=1&pageSize=100"),
      apiGet<Paged<SubjectRow>>("/api/academics/subjects?page=1&pageSize=200"),
      apiGet<Paged<StudentRow>>("/api/students?page=1&pageSize=500"),
      apiGet<Paged<ExamRow>>("/api/exams?page=1&pageSize=200"),
    ]);

    setClasses(classRes.items ?? []);
    setYears(yearRes.items ?? []);
    setSubjects(subjectRes.items ?? []);
    setStudents(studentRes.items ?? []);
    setExams(examRes.items ?? []);

    const defaultClassId = classRes.items?.[0]?.id ?? "";
    const defaultYearId = yearRes.items?.find((y) => y.isActive)?.id ?? yearRes.items?.[0]?.id ?? "";
    setExamForm((prev) => ({ ...prev, classId: prev.classId || defaultClassId, academicYearId: prev.academicYearId || defaultYearId }));
    setSelectedExamId((prev) => prev || examRes.items?.[0]?.id || "");
  }

  async function refreshExams() {
    const data = await apiGet<Paged<ExamRow>>("/api/exams?page=1&pageSize=200");
    setExams(data.items ?? []);
  }

  async function loadExamSubjects(examId: string) {
    if (!examId) {
      setExamSubjects([]);
      return;
    }
    const items = await apiGet<ExamSubjectRow[]>(`/api/exams/${examId}/subjects`);
    setExamSubjects(items ?? []);
  }

  async function loadExamMarks(examId: string) {
    if (!examId) {
      setExamMarks(null);
      return;
    }
    const data = await apiGet<ExamMarksResponse>(`/api/exams/${examId}/marks`);
    setExamMarks(data);
  }

  async function loadExamResults(examId: string) {
    if (!examId) {
      setExamResults(null);
      return;
    }
    const data = await apiGet<ExamResultsResponse>(`/api/results/exam/${examId}`);
    setExamResults(data);
  }

  useEffect(() => {
    loadBaseData().catch((error) => addToast(error instanceof Error ? error.message : "Failed to load exam data", "error"));
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    loadExamSubjects(selectedExamId).catch((error) => addToast(error instanceof Error ? error.message : "Failed to load exam subjects", "error"));
    loadExamMarks(selectedExamId).catch((error) => addToast(error instanceof Error ? error.message : "Failed to load marks", "error"));
    loadExamResults(selectedExamId).catch((error) => addToast(error instanceof Error ? error.message : "Failed to load results", "error"));
  }, [selectedExamId]);

  useEffect(() => {
    const draft: Record<string, { maxMarks: number; passMarks: number }> = {};
    for (const item of examSubjects) {
      draft[item.id] = { maxMarks: Number(item.maxMarks), passMarks: Number(item.passMarks) };
    }
    setExamSubjectDrafts(draft);
  }, [examSubjects]);

  const selectedExam = useMemo(() => exams.find((item) => item.id === selectedExamId) ?? null, [exams, selectedExamId]);

  const subjectOptions = useMemo(() => {
    const classId = selectedExam?.classId;
    if (!classId) return subjects;
    return subjects.filter((s) => s.classId === classId || !s.classId);
  }, [subjects, selectedExam?.classId]);

  const studentsForSelectedExam = useMemo(() => {
    if (!selectedExam) return [];
    return students.filter((s) => s.classId === selectedExam.classId);
  }, [students, selectedExam]);

  useEffect(() => {
    if (!marksSubjectId || !examMarks) {
      setMarksDraft({});
      return;
    }
    const subject = examMarks.subjects.find((item) => item.id === marksSubjectId);
    const nextDraft: Record<string, { marksObtained: number; remarks: string; markId?: string }> = {};
    for (const student of studentsForSelectedExam) {
      const existing = subject?.studentMarks.find((m) => m.studentId === student.id);
      nextDraft[student.id] = {
        marksObtained: existing ? Number(existing.marksObtained) : 0,
        remarks: existing?.remarks ?? "",
        markId: existing?.id,
      };
    }
    setMarksDraft(nextDraft);
  }, [marksSubjectId, examMarks, studentsForSelectedExam]);

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/exams", examForm);
      addToast("Exam created", "success");
      setExamForm((prev) => ({ ...prev, name: "", description: "", status: "draft" }));
      await refreshExams();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create exam", "error");
    }
  }

  async function updateExamStatus(id: string, status: ExamStatus) {
    try {
      await apiPatch(`/api/exams/${id}`, { status });
      addToast("Exam updated", "success");
      await refreshExams();
      if (selectedExamId === id) await loadExamResults(id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update exam", "error");
    }
  }

  async function deleteExam(id: string) {
    if (!confirm("Delete this exam?")) return;
    try {
      await apiDelete(`/api/exams/${id}`);
      addToast("Exam deleted", "success");
      await refreshExams();
      if (selectedExamId === id) setSelectedExamId("");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete exam", "error");
    }
  }

  async function addExamSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamId) return addToast("Select exam first", "error");
    try {
      await apiPost(`/api/exams/${selectedExamId}/subjects`, subjectForm);
      addToast("Exam subject added", "success");
      setSubjectForm({ subjectId: "", maxMarks: 100, passMarks: 35 });
      await loadExamSubjects(selectedExamId);
      await loadExamMarks(selectedExamId);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to add exam subject", "error");
    }
  }

  async function updateExamSubject(id: string, maxMarks: number, passMarks: number) {
    try {
      await apiPatch(`/api/exam-subjects/${id}`, { maxMarks, passMarks });
      addToast("Exam subject updated", "success");
      if (selectedExamId) {
        await loadExamSubjects(selectedExamId);
        await loadExamMarks(selectedExamId);
        await loadExamResults(selectedExamId);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update exam subject", "error");
    }
  }

  async function removeExamSubject(id: string) {
    if (!confirm("Remove this subject from exam?")) return;
    try {
      await apiDelete(`/api/exam-subjects/${id}`);
      addToast("Exam subject removed", "success");
      if (selectedExamId) {
        await loadExamSubjects(selectedExamId);
        await loadExamMarks(selectedExamId);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to remove exam subject", "error");
    }
  }

  async function saveMarks() {
    if (!selectedExamId || !marksSubjectId) return addToast("Select exam and subject", "error");
    try {
      const payload = {
        items: studentsForSelectedExam.map((student) => ({
          examSubjectId: marksSubjectId,
          studentId: student.id,
          marksObtained: Number(marksDraft[student.id]?.marksObtained ?? 0),
          remarks: marksDraft[student.id]?.remarks || undefined,
        })),
      };
      await apiPost(`/api/exams/${selectedExamId}/marks`, payload);
      addToast("Marks saved", "success");
      await loadExamMarks(selectedExamId);
      await loadExamResults(selectedExamId);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save marks", "error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Exam & Grading</h1>
      <p className="mt-1 text-slate-500">Manage exams, map subjects, enter marks, and publish report-ready results.</p>

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

      {activeTab === "exams" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <form onSubmit={handleCreateExam} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create Exam</h2>
            <select value={examForm.classId} onChange={(e) => setExamForm((f) => ({ ...f, classId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select class</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={examForm.academicYearId} onChange={(e) => setExamForm((f) => ({ ...f, academicYearId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select academic year</option>
              {years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={examForm.name} onChange={(e) => setExamForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Exam name" required />
            <textarea value={examForm.description} onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Description (optional)" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={examForm.startDate} onChange={(e) => setExamForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required />
              <input type="date" value={examForm.endDate} onChange={(e) => setExamForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required />
            </div>
            <select value={examForm.status} onChange={(e) => setExamForm((f) => ({ ...f, status: e.target.value as ExamStatus }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
            </select>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create Exam</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Exams</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Exam</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Year</th>
                    <th className="px-2 py-2">Dates</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => setSelectedExamId(exam.id)} className="text-left text-primary-700 hover:underline">
                          {exam.name}
                        </button>
                      </td>
                      <td className="px-2 py-2">{exam.class.name}</td>
                      <td className="px-2 py-2">{exam.academicYear.name}</td>
                      <td className="px-2 py-2">{new Date(exam.startDate).toLocaleDateString()} - {new Date(exam.endDate).toLocaleDateString()}</td>
                      <td className="px-2 py-2">
                        <select value={exam.status} onChange={(e) => updateExamStatus(exam.id, e.target.value as ExamStatus)} className="rounded border px-2 py-1 text-xs">
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => deleteExam(exam.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "subjects" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <form onSubmit={addExamSubject} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Map Subjects to Exam</h2>
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select exam</option>
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            <select value={subjectForm.subjectId} onChange={(e) => setSubjectForm((f) => ({ ...f, subjectId: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" required>
              <option value="">Select subject</option>
              {subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={subjectForm.maxMarks} onChange={(e) => setSubjectForm((f) => ({ ...f, maxMarks: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={1} required />
              <input type="number" value={subjectForm.passMarks} onChange={(e) => setSubjectForm((f) => ({ ...f, passMarks: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={0} required />
            </div>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Add Subject</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Exam Subjects</h2>
            <div className="mt-3 space-y-2">
              {examSubjects.length === 0 && <p className="text-sm text-slate-500">No subjects mapped yet.</p>}
              {examSubjects.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{item.subject.name}</p>
                      <p className="text-xs text-slate-500">Marks entered: {item._count?.studentMarks ?? 0}</p>
                    </div>
                    <button type="button" onClick={() => removeExamSubject(item.id)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={examSubjectDrafts[item.id]?.maxMarks ?? Number(item.maxMarks)}
                      onChange={(e) => setExamSubjectDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], maxMarks: Number(e.target.value) } }))}
                      className="rounded border px-2 py-1 text-sm"
                      min={1}
                    />
                    <input
                      type="number"
                      value={examSubjectDrafts[item.id]?.passMarks ?? Number(item.passMarks)}
                      onChange={(e) => setExamSubjectDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], passMarks: Number(e.target.value) } }))}
                      className="rounded border px-2 py-1 text-sm"
                      min={0}
                    />
                    <button
                      type="button"
                      onClick={() => updateExamSubject(item.id, examSubjectDrafts[item.id]?.maxMarks ?? Number(item.maxMarks), examSubjectDrafts[item.id]?.passMarks ?? Number(item.passMarks))}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Update
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "marks" && (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Marks Entry</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">Select exam</option>
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            <select value={marksSubjectId} onChange={(e) => setMarksSubjectId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">Select exam subject</option>
              {examSubjects.map((item) => <option key={item.id} value={item.id}>{item.subject.name}</option>)}
            </select>
          </div>

          {marksSubjectId && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Admission No.</th>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Marks</th>
                    <th className="px-2 py-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsForSelectedExam.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{student.admissionNumber}</td>
                      <td className="px-2 py-2">{student.firstName} {student.lastName}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={marksDraft[student.id]?.marksObtained ?? 0}
                          onChange={(e) => setMarksDraft((prev) => ({ ...prev, [student.id]: { ...prev[student.id], marksObtained: Number(e.target.value) } }))}
                          className="w-24 rounded border px-2 py-1"
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={marksDraft[student.id]?.remarks ?? ""}
                          onChange={(e) => setMarksDraft((prev) => ({ ...prev, [student.id]: { ...prev[student.id], remarks: e.target.value } }))}
                          className="w-full rounded border px-2 py-1"
                          placeholder="Optional remarks"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={saveMarks} className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Save Marks</button>
            </div>
          )}
        </div>
      )}

      {activeTab === "results" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="grid gap-2 md:grid-cols-2">
              <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Select exam</option>
                {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
              </select>
            </div>
          </div>

          {examResults && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="text-xl font-semibold">{examResults.summary.studentCount}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">Average %</p>
                  <p className="text-xl font-semibold">{examResults.summary.averagePercentage}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-slate-500">Pass Count</p>
                  <p className="text-xl font-semibold">{examResults.summary.passCount}</p>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Rank</th>
                      <th className="px-2 py-2">Admission No.</th>
                      <th className="px-2 py-2">Student</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Percentage</th>
                      <th className="px-2 py-2">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examResults.results.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="px-2 py-2">{item.rank ?? "-"}</td>
                        <td className="px-2 py-2">{item.student.admissionNumber}</td>
                        <td className="px-2 py-2">{item.student.firstName} {item.student.lastName}</td>
                        <td className="px-2 py-2">{Number(item.totalMarks)}</td>
                        <td className="px-2 py-2">{Number(item.percentage).toFixed(2)}%</td>
                        <td className="px-2 py-2">{Number(item.gpa).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
