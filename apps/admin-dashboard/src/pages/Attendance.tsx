import { useEffect, useMemo, useState } from "react";
import { useToast } from "../contexts/ToastContext";
import { apiGet, apiPatch, apiPost } from "../lib/api";

type TabKey = "students" | "teachers" | "reports";

type ClassRow = { id: string; name: string; grade: number; section?: string | null };
type SectionRow = { id: string; name: string; classId: string };
type YearRow = { id: string; name: string; isActive: boolean };
type StudentRow = { id: string; firstName: string; lastName: string; admissionNumber: string; grade: number; classId: string | null };
type TeacherRow = { id: string; firstName: string; lastName: string; email: string };

type SessionRow = {
  id: string;
  date: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
  class: { id: string; name: string; grade: number };
  section: { id: string; name: string };
  academicYear: { id: string; name: string; isActive: boolean };
  _count?: { records: number };
};

type SessionDetail = SessionRow & {
  records: Array<{
    id: string;
    status: "Present" | "Absent" | "Late";
    remarks: string | null;
    studentId: string;
    student: { id: string; firstName: string; lastName: string; admissionNumber: string; grade: number };
  }>;
};

type TeacherAttendanceRow = {
  id: string;
  teacherId: string;
  date: string;
  status: "Present" | "Absent" | "Leave";
  remarks: string | null;
  teacher: { id: string; firstName: string; lastName: string; email: string };
};

type StudentReportResponse = {
  student?: { id: string; firstName: string; lastName: string; admissionNumber: string; grade: number };
  summary: { total: number; present: number; absent: number; late: number; attendancePercent: number };
  monthly: Array<{ month: string; present: number; absent: number; late: number; total: number; attendancePercent: number }>;
};

type ClassReportResponse = {
  classId: string;
  totalSessions: number;
  summary: { totalRecords: number; present: number; absent: number; late: number; attendancePercent: number };
  students: Array<{ studentId: string; admissionNumber?: string; name: string; present: number; absent: number; late: number; total: number; attendancePercent: number }>;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "students", label: "Student Attendance" },
  { id: "teachers", label: "Teacher Attendance" },
  { id: "reports", label: "Reports" },
];

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function classLabel(c: ClassRow) {
  if (c.name && c.name.trim()) return `${c.name} (Grade ${c.grade})`;
  return `Grade ${c.grade}${c.section ? ` - ${c.section}` : ""}`;
}

function sectionLabel(s: SectionRow) {
  return s.name?.trim() ? s.name : "Unnamed section";
}

export default function Attendance() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("students");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessionSections, setSessionSections] = useState<SectionRow[]>([]);
  const [reportSections, setReportSections] = useState<SectionRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [sessionSectionsLoading, setSessionSectionsLoading] = useState(false);
  const [reportSectionsLoading, setReportSectionsLoading] = useState(false);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [sessionForm, setSessionForm] = useState({ classId: "", sectionId: "", academicYearId: "", date: toDateInput(new Date()) });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [recordDrafts, setRecordDrafts] = useState<Record<string, { status: "Present" | "Absent" | "Late"; remarks: string; recordId?: string }>>({});

  const [teacherForm, setTeacherForm] = useState({ teacherId: "", date: toDateInput(new Date()), status: "Present" as "Present" | "Absent" | "Leave", remarks: "" });
  const [teacherItems, setTeacherItems] = useState<TeacherAttendanceRow[]>([]);

  const [studentReportForm, setStudentReportForm] = useState({ studentId: "", from: "", to: "" });
  const [classReportForm, setClassReportForm] = useState({ classId: "", sectionId: "", academicYearId: "", from: "", to: "" });
  const [studentReport, setStudentReport] = useState<StudentReportResponse | null>(null);
  const [classReport, setClassReport] = useState<ClassReportResponse | null>(null);

  const activeYear = useMemo(() => years.find((y) => y.isActive), [years]);
  const studentsForSession = useMemo(() => students.filter((s) => s.classId === sessionForm.classId), [students, sessionForm.classId]);

  const canCreateSession = !!sessionForm.classId && !!sessionForm.sectionId && !!sessionForm.academicYearId && !!sessionForm.date;

  async function loadSectionsForClass(classId: string, mode: "session" | "report") {
    if (mode === "session") setSessionSectionsLoading(true);
    else setReportSectionsLoading(true);
    try {
      if (!classId) {
        if (mode === "session") setSessionSections([]);
        else setReportSections([]);
        return;
      }

      const data = await apiGet<Paged<SectionRow>>(`/api/academics/sections?page=1&pageSize=100&classId=${encodeURIComponent(classId)}`);
      if (mode === "session") setSessionSections(data.items ?? []);
      else setReportSections(data.items ?? []);
    } finally {
      if (mode === "session") setSessionSectionsLoading(false);
      else setReportSectionsLoading(false);
    }
  }

  async function loadStaticData() {
    setLoadError("");
    setClassesLoading(true);
    setYearsLoading(true);
    const [classRes, yearRes, studentRes, teacherRes] = await Promise.allSettled([
      apiGet<Paged<ClassRow>>("/api/academics/classes?page=1&pageSize=100"),
      apiGet<Paged<YearRow>>("/api/academics/years?page=1&pageSize=50"),
      apiGet<Paged<StudentRow>>("/api/students?page=1&pageSize=100"),
      apiGet<Paged<TeacherRow>>("/api/teachers?page=1&pageSize=100"),
    ]);

    const classItems = classRes.status === "fulfilled" ? (classRes.value.items ?? []) : [];
    const yearItems = yearRes.status === "fulfilled" ? (yearRes.value.items ?? []) : [];
    const studentItems = studentRes.status === "fulfilled" ? (studentRes.value.items ?? []) : [];
    const teacherItems = teacherRes.status === "fulfilled" ? (teacherRes.value.items ?? []) : [];

    setClasses(classItems);
    setYears(yearItems);
    setStudents(studentItems);
    setTeachers(teacherItems);
    setClassesLoading(false);
    setYearsLoading(false);

    const loadErrors: string[] = [];
    if (classRes.status === "rejected") loadErrors.push(classRes.reason instanceof Error ? classRes.reason.message : "Failed to load classes");
    if (yearRes.status === "rejected") loadErrors.push(yearRes.reason instanceof Error ? yearRes.reason.message : "Failed to load academic years");
    if (studentRes.status === "rejected") loadErrors.push(studentRes.reason instanceof Error ? studentRes.reason.message : "Failed to load students");
    if (teacherRes.status === "rejected") loadErrors.push(teacherRes.reason instanceof Error ? teacherRes.reason.message : "Failed to load teachers");
    if (loadErrors.length > 0) {
      const message = loadErrors[0];
      setLoadError(message);
      addToast(message, "error");
    }

    const yearId = yearItems.find((y) => y.isActive)?.id ?? yearItems[0]?.id ?? "";
    const classId = classItems[0]?.id ?? "";

    setSessionForm((prev) => ({
      ...prev,
      classId: prev.classId || classId,
      sectionId: prev.sectionId || "",
      academicYearId: prev.academicYearId || yearId,
    }));

    setClassReportForm((prev) => ({
      ...prev,
      classId: prev.classId || classId,
      sectionId: prev.sectionId || "",
      academicYearId: prev.academicYearId || yearId,
    }));

    const initialSessionClassId = classId;
    const initialReportClassId = classId;
    await Promise.all([
      loadSectionsForClass(initialSessionClassId, "session"),
      loadSectionsForClass(initialReportClassId, "report"),
    ]);
  }

  async function loadSessions() {
    const qs = new URLSearchParams({ page: "1", pageSize: "100" });
    if (sessionForm.classId) qs.set("classId", sessionForm.classId);
    if (sessionForm.sectionId) qs.set("sectionId", sessionForm.sectionId);
    if (sessionForm.academicYearId) qs.set("academicYearId", sessionForm.academicYearId);
    const data = await apiGet<Paged<SessionRow>>(`/api/attendance/sessions?${qs.toString()}`);
    setSessions(data.items ?? []);
  }

  async function loadTeacherAttendance() {
    const data = await apiGet<Paged<TeacherAttendanceRow>>("/api/attendance/teachers?page=1&pageSize=100");
    setTeacherItems(data.items ?? []);
  }

  async function refresh() {
    try {
      await loadStaticData();
      await Promise.all([loadSessions(), loadTeacherAttendance()]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load attendance data");
      addToast(error instanceof Error ? error.message : "Failed to load attendance data", "error");
      setClassesLoading(false);
      setYearsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!sessionForm.classId) {
      setSessionSections([]);
      setSessionForm((prev) => ({ ...prev, sectionId: "" }));
      return;
    }
    loadSectionsForClass(sessionForm.classId, "session").catch((error) =>
      addToast(error instanceof Error ? error.message : "Failed to load sections", "error")
    );
  }, [sessionForm.classId]);

  useEffect(() => {
    if (!classReportForm.classId) {
      setReportSections([]);
      setClassReportForm((prev) => ({ ...prev, sectionId: "" }));
      return;
    }
    loadSectionsForClass(classReportForm.classId, "report").catch((error) =>
      addToast(error instanceof Error ? error.message : "Failed to load report sections", "error")
    );
  }, [classReportForm.classId]);

  useEffect(() => {
    if (!sessionForm.classId) return;
    if (sessionSections.length === 0) {
      setSessionForm((prev) => ({ ...prev, sectionId: "" }));
      return;
    }
    if (!sessionSections.some((s) => s.id === sessionForm.sectionId)) {
      setSessionForm((prev) => ({ ...prev, sectionId: sessionSections[0].id }));
    }
  }, [sessionSections, sessionForm.classId]);

  useEffect(() => {
    if (!classReportForm.classId) return;
    if (reportSections.length === 0) {
      setClassReportForm((prev) => ({ ...prev, sectionId: "" }));
      return;
    }
    if (classReportForm.sectionId && !reportSections.some((s) => s.id === classReportForm.sectionId)) {
      setClassReportForm((prev) => ({ ...prev, sectionId: "" }));
    }
  }, [reportSections, classReportForm.classId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    apiGet<SessionDetail>(`/api/attendance/sessions/${selectedSessionId}`)
      .then((detail) => {
        setSessionDetail(detail);
        const nextDrafts: Record<string, { status: "Present" | "Absent" | "Late"; remarks: string; recordId?: string }> = {};
        for (const record of detail.records) {
          nextDrafts[record.studentId] = { status: record.status, remarks: record.remarks ?? "", recordId: record.id };
        }
        for (const student of studentsForSession) {
          if (!nextDrafts[student.id]) nextDrafts[student.id] = { status: "Present", remarks: "" };
        }
        setRecordDrafts(nextDrafts);
      })
      .catch((error) => addToast(error instanceof Error ? error.message : "Failed to load session details", "error"));
  }, [selectedSessionId, studentsForSession]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateSession) return;
    try {
      setSessionSubmitting(true);
      const created = await apiPost<SessionRow>("/api/attendance/sessions", sessionForm);
      addToast("Attendance session ready", "success");
      await loadSessions();
      setSelectedSessionId(created.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create session", "error");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function saveStudentRecord(studentId: string) {
    const draft = recordDrafts[studentId];
    if (!draft || !selectedSessionId) return;

    try {
      if (draft.recordId) {
        await apiPatch(`/api/attendance/mark/${draft.recordId}`, { status: draft.status, remarks: draft.remarks || null });
      } else {
        const created = await apiPost<{ id: string }>("/api/attendance/mark", {
          sessionId: selectedSessionId,
          studentId,
          status: draft.status,
          remarks: draft.remarks || undefined,
        });
        setRecordDrafts((prev) => ({ ...prev, [studentId]: { ...draft, recordId: created.id } }));
      }
      addToast("Attendance saved", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save attendance", "error");
    }
  }

  async function saveTeacherAttendance(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/attendance/teachers", teacherForm);
      addToast("Teacher attendance saved", "success");
      setTeacherForm((prev) => ({ ...prev, remarks: "" }));
      await loadTeacherAttendance();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to save teacher attendance", "error");
    }
  }

  async function updateTeacherAttendance(id: string, status: "Present" | "Absent" | "Leave") {
    try {
      await apiPatch(`/api/attendance/teachers/${id}`, { status });
      addToast("Teacher attendance updated", "success");
      await loadTeacherAttendance();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update teacher attendance", "error");
    }
  }

  async function runStudentReport(e: React.FormEvent) {
    e.preventDefault();
    if (!studentReportForm.studentId) {
      addToast("Select a student", "error");
      return;
    }

    try {
      const qs = new URLSearchParams();
      if (studentReportForm.from) qs.set("from", studentReportForm.from);
      if (studentReportForm.to) qs.set("to", studentReportForm.to);
      const data = await apiGet<StudentReportResponse>(`/api/attendance/report/student/${studentReportForm.studentId}?${qs.toString()}`);
      setStudentReport(data);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load student report", "error");
    }
  }

  async function runClassReport(e: React.FormEvent) {
    e.preventDefault();
    if (!classReportForm.classId) {
      addToast("Select a class", "error");
      return;
    }

    try {
      const qs = new URLSearchParams();
      if (classReportForm.sectionId) qs.set("sectionId", classReportForm.sectionId);
      if (classReportForm.academicYearId) qs.set("academicYearId", classReportForm.academicYearId);
      if (classReportForm.from) qs.set("from", classReportForm.from);
      if (classReportForm.to) qs.set("to", classReportForm.to);
      const data = await apiGet<ClassReportResponse>(`/api/attendance/report/class/${classReportForm.classId}?${qs.toString()}`);
      setClassReport(data);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load class report", "error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
      <p className="mt-1 text-slate-500">Manage daily student and teacher attendance with analytics-ready reports.</p>
      {loadError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}

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

      {activeTab === "students" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <div className="space-y-6">
            <form onSubmit={createSession} className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="font-semibold">Create attendance session</h2>
              <select value={sessionForm.classId} onChange={(e) => setSessionForm((prev) => ({ ...prev, classId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
                <option value="">Select class</option>
                {classesLoading && <option value="" disabled>Loading classes...</option>}
                {!classesLoading && classes.length === 0 && <option value="" disabled>No classes found</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
              </select>
              <select
                value={sessionForm.sectionId}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, sectionId: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2"
                disabled={!sessionForm.classId || sessionSectionsLoading}
                required
              >
                {!sessionForm.classId && <option value="">Select a class to load sections</option>}
                {sessionForm.classId && sessionSectionsLoading && <option value="">Loading sections...</option>}
                {sessionForm.classId && !sessionSectionsLoading && sessionSections.length === 0 && <option value="">No sections found</option>}
                {sessionForm.classId && !sessionSectionsLoading && sessionSections.length > 0 && <option value="">Select section</option>}
                {sessionSections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
              </select>
              <select value={sessionForm.academicYearId} onChange={(e) => setSessionForm((prev) => ({ ...prev, academicYearId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
                <option value="">Select year</option>
                {yearsLoading && <option value="" disabled>Loading academic years...</option>}
                {!yearsLoading && years.length === 0 && <option value="" disabled>No academic years found</option>}
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (Active)" : ""}</option>)}
              </select>
              <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required />
              <button type="submit" disabled={!canCreateSession || sessionSubmitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-60">{sessionSubmitting ? "Opening..." : "Create / Open Session"}</button>
            </form>

            <div className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Recent sessions</h2>
              <div className="mt-3 space-y-2 max-h-80 overflow-auto pr-1">
                {sessions.length === 0 && <p className="text-sm text-slate-500">No sessions found.</p>}
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${selectedSessionId === s.id ? "border-primary-500 bg-primary-50" : "border-slate-200 bg-white"}`}
                  >
                    <p className="text-sm font-medium text-slate-800">{new Date(s.date).toLocaleDateString()} - {s.class?.name ?? "Class"} {s.section?.name ?? "Section"}</p>
                    <p className="text-xs text-slate-500">{s.academicYear?.name} - Records: {s._count?.records ?? 0}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Mark attendance</h2>
            {!selectedSessionId && <p className="mt-2 text-sm text-slate-500">Select a session to start marking attendance.</p>}
            {selectedSessionId && (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  {sessionDetail ? `${new Date(sessionDetail.date).toLocaleDateString()} - ${sessionDetail.class.name} ${sessionDetail.section.name} (${sessionDetail.academicYear.name})` : "Loading session..."}
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Student</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Remarks</th>
                        <th className="px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsForSession.map((student) => {
                        const draft = recordDrafts[student.id] ?? { status: "Present" as const, remarks: "" };
                        return (
                          <tr key={student.id} className="border-b border-slate-100">
                            <td className="px-2 py-2">{student.firstName} {student.lastName} ({student.admissionNumber})</td>
                            <td className="px-2 py-2">
                              <select
                                value={draft.status}
                                onChange={(e) => setRecordDrafts((prev) => ({ ...prev, [student.id]: { ...draft, status: e.target.value as "Present" | "Absent" | "Late" } }))}
                                className="rounded border px-2 py-1"
                              >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={draft.remarks}
                                onChange={(e) => setRecordDrafts((prev) => ({ ...prev, [student.id]: { ...draft, remarks: e.target.value } }))}
                                className="w-full rounded border px-2 py-1"
                                placeholder="Optional"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => saveStudentRecord(student.id)} className="rounded border border-primary-600 px-2 py-1 text-primary-700">Save</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "teachers" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={saveTeacherAttendance} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Mark teacher attendance</h2>
            <select value={teacherForm.teacherId} onChange={(e) => setTeacherForm((prev) => ({ ...prev, teacherId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
            <input type="date" value={teacherForm.date} onChange={(e) => setTeacherForm((prev) => ({ ...prev, date: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required />
            <select value={teacherForm.status} onChange={(e) => setTeacherForm((prev) => ({ ...prev, status: e.target.value as "Present" | "Absent" | "Leave" }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
            </select>
            <input value={teacherForm.remarks} onChange={(e) => setTeacherForm((prev) => ({ ...prev, remarks: e.target.value }))} className="w-full rounded-lg border px-3 py-2" placeholder="Optional remarks" />
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Save</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Recent teacher attendance</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Teacher</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Quick update</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-2 py-2">{item.teacher.firstName} {item.teacher.lastName}</td>
                      <td className="px-2 py-2">{item.status}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button type="button" className="rounded border px-2 py-1" onClick={() => updateTeacherAttendance(item.id, "Present")}>Present</button>
                          <button type="button" className="rounded border px-2 py-1" onClick={() => updateTeacherAttendance(item.id, "Absent")}>Absent</button>
                          <button type="button" className="rounded border px-2 py-1" onClick={() => updateTeacherAttendance(item.id, "Leave")}>Leave</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Student report</h2>
            <form onSubmit={runStudentReport} className="mt-3 grid gap-2">
              <select value={studentReportForm.studentId} onChange={(e) => setStudentReportForm((prev) => ({ ...prev, studentId: e.target.value }))} className="rounded-lg border px-3 py-2" required>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={studentReportForm.from} onChange={(e) => setStudentReportForm((prev) => ({ ...prev, from: e.target.value }))} className="rounded-lg border px-3 py-2" />
                <input type="date" value={studentReportForm.to} onChange={(e) => setStudentReportForm((prev) => ({ ...prev, to: e.target.value }))} className="rounded-lg border px-3 py-2" />
              </div>
              <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Generate</button>
            </form>

            {studentReport && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-800">{studentReport.student ? `${studentReport.student.firstName} ${studentReport.student.lastName}` : "Student"}</p>
                <p className="mt-1 text-sm text-slate-600">Present: {studentReport.summary.present} | Absent: {studentReport.summary.absent} | Late: {studentReport.summary.late}</p>
                <p className="text-sm text-slate-700">Attendance: {studentReport.summary.attendancePercent}%</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Class report</h2>
            <form onSubmit={runClassReport} className="mt-3 grid gap-2">
              <select value={classReportForm.classId} onChange={(e) => setClassReportForm((prev) => ({ ...prev, classId: e.target.value }))} className="rounded-lg border px-3 py-2" required>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
              </select>
              <select value={classReportForm.sectionId} onChange={(e) => setClassReportForm((prev) => ({ ...prev, sectionId: e.target.value }))} className="rounded-lg border px-3 py-2" disabled={!classReportForm.classId || reportSectionsLoading}>
                <option value="">{!classReportForm.classId ? "Select class first" : reportSectionsLoading ? "Loading sections..." : reportSections.length === 0 ? "No sections found" : "All sections"}</option>
                {reportSections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
              </select>
              <select value={classReportForm.academicYearId} onChange={(e) => setClassReportForm((prev) => ({ ...prev, academicYearId: e.target.value }))} className="rounded-lg border px-3 py-2">
                <option value="">All years</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (Active)" : ""}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={classReportForm.from} onChange={(e) => setClassReportForm((prev) => ({ ...prev, from: e.target.value }))} className="rounded-lg border px-3 py-2" />
                <input type="date" value={classReportForm.to} onChange={(e) => setClassReportForm((prev) => ({ ...prev, to: e.target.value }))} className="rounded-lg border px-3 py-2" />
              </div>
              <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Generate</button>
            </form>

            {classReport && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">Sessions: {classReport.totalSessions}</p>
                <p className="text-sm text-slate-700">Records: {classReport.summary.totalRecords}</p>
                <p className="text-sm font-medium text-slate-800">Class attendance: {classReport.summary.attendancePercent}%</p>
                <div className="mt-3 max-h-44 overflow-auto rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Student</th>
                        <th className="px-2 py-2">Present</th>
                        <th className="px-2 py-2">Absent</th>
                        <th className="px-2 py-2">Late</th>
                        <th className="px-2 py-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classReport.students.map((row) => (
                        <tr key={row.studentId} className="border-b border-slate-100">
                          <td className="px-2 py-2">{row.name}</td>
                          <td className="px-2 py-2">{row.present}</td>
                          <td className="px-2 py-2">{row.absent}</td>
                          <td className="px-2 py-2">{row.late}</td>
                          <td className="px-2 py-2">{row.attendancePercent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeYear && <p className="mt-6 text-xs text-slate-500">Active academic year: {activeYear.name}</p>}
    </div>
  );
}
