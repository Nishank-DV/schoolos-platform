import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type TabKey = "classes" | "sections" | "subjects" | "years" | "assignments";

type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  grade: number;
  section: string;
  teacherId: string | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
};

type SectionRow = {
  id: string;
  name: string;
  capacity: number;
  classId: string;
  class?: { id: string; name: string; grade: number };
};

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  classId: string | null;
  class?: { id: string; name: string; grade: number } | null;
};

type AcademicYearRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type TeacherRow = { id: string; firstName: string; lastName: string; email: string };

type AssignmentRow = {
  id: string;
  teacher: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string; code: string | null };
  class: { id: string; name: string; grade: number };
  section: { id: string; name: string };
  academicYear: { id: string; name: string; isActive: boolean };
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

const tabs: Array<{ id: TabKey; label: string }> = [
  { id: "classes", label: "Classes" },
  { id: "sections", label: "Sections" },
  { id: "subjects", label: "Subjects" },
  { id: "years", label: "Academic Years" },
  { id: "assignments", label: "Teacher Assignments" },
];

export default function Academics() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("classes");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  const [classForm, setClassForm] = useState({ name: "", description: "", grade: 9, section: "A", teacherId: "" });
  const [sectionForm, setSectionForm] = useState({ name: "", capacity: 40, classId: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", classId: "" });
  const [yearForm, setYearForm] = useState({ name: "", startDate: "", endDate: "", isActive: false });
  const [assignmentForm, setAssignmentForm] = useState({ teacherId: "", subjectId: "", classId: "", sectionId: "", academicYearId: "" });

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  async function loadClasses() {
    const data = await apiGet<Paged<ClassRow>>("/api/academics/classes?page=1&pageSize=100");
    setClasses(data.items ?? []);
  }

  async function loadSections(classId?: string) {
    const qs = new URLSearchParams({ page: "1", pageSize: "100" });
    if (classId) qs.set("classId", classId);
    const data = await apiGet<Paged<SectionRow>>(`/api/academics/sections?${qs.toString()}`);
    setSections(data.items ?? []);
  }

  async function loadSubjects(classId?: string) {
    const qs = new URLSearchParams({ page: "1", pageSize: "100" });
    if (classId) qs.set("classId", classId);
    const data = await apiGet<Paged<SubjectRow>>(`/api/academics/subjects?${qs.toString()}`);
    setSubjects(data.items ?? []);
  }

  async function loadYears() {
    const data = await apiGet<Paged<AcademicYearRow>>("/api/academics/years?page=1&pageSize=100");
    setYears(data.items ?? []);
  }

  async function loadAssignments() {
    const data = await apiGet<Paged<AssignmentRow>>("/api/academics/assignments?page=1&pageSize=100");
    setAssignments(data.items ?? []);
  }

  async function loadTeachers() {
    const data = await apiGet<Paged<TeacherRow>>("/api/teachers?page=1&pageSize=100");
    setTeachers(data.items ?? []);
  }

  async function refreshAll() {
    try {
      await Promise.all([loadClasses(), loadSections(), loadSubjects(), loadYears(), loadAssignments(), loadTeachers()]);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load academics data", "error");
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const sectionsForSelectedClass = useMemo(() => sections.filter((s) => s.classId === assignmentForm.classId), [sections, assignmentForm.classId]);
  const subjectsForSelectedClass = useMemo(
    () => subjects.filter((s) => (s.classId ?? "") === assignmentForm.classId),
    [subjects, assignmentForm.classId]
  );

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/academics/classes", {
        name: classForm.name,
        description: classForm.description || undefined,
        grade: classForm.grade,
        section: classForm.section,
        teacherId: classForm.teacherId || undefined,
      });
      addToast("Class created", "success");
      setClassForm({ name: "", description: "", grade: 9, section: "A", teacherId: "" });
      await loadClasses();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create class", "error");
    }
  }

  async function saveClass(item: ClassRow) {
    try {
      await apiPatch(`/api/academics/classes/${item.id}`, {
        name: item.name,
        description: item.description,
        grade: item.grade,
        section: item.section,
        teacherId: item.teacherId || null,
      });
      addToast("Class updated", "success");
      setEditingClassId(null);
      await loadClasses();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update class", "error");
    }
  }

  async function removeClass(id: string) {
    if (!confirm("Delete this class?")) return;
    try {
      await apiDelete(`/api/academics/classes/${id}`);
      addToast("Class deleted", "success");
      await loadClasses();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete class", "error");
    }
  }

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/academics/sections", {
        name: sectionForm.name,
        classId: sectionForm.classId,
        capacity: sectionForm.capacity,
      });
      addToast("Section created", "success");
      setSectionForm({ name: "", capacity: 40, classId: "" });
      await loadSections();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create section", "error");
    }
  }

  async function saveSection(item: SectionRow) {
    try {
      await apiPatch(`/api/academics/sections/${item.id}`, {
        name: item.name,
        classId: item.classId,
        capacity: item.capacity,
      });
      addToast("Section updated", "success");
      setEditingSectionId(null);
      await loadSections();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update section", "error");
    }
  }

  async function removeSection(id: string) {
    if (!confirm("Delete this section?")) return;
    try {
      await apiDelete(`/api/academics/sections/${id}`);
      addToast("Section deleted", "success");
      await loadSections();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete section", "error");
    }
  }

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/academics/subjects", {
        name: subjectForm.name,
        code: subjectForm.code || undefined,
        classId: subjectForm.classId,
      });
      addToast("Subject created", "success");
      setSubjectForm({ name: "", code: "", classId: "" });
      await loadSubjects();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create subject", "error");
    }
  }

  async function saveSubject(item: SubjectRow) {
    try {
      await apiPatch(`/api/academics/subjects/${item.id}`, {
        name: item.name,
        code: item.code,
        classId: item.classId,
      });
      addToast("Subject updated", "success");
      setEditingSubjectId(null);
      await loadSubjects();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update subject", "error");
    }
  }

  async function removeSubject(id: string) {
    if (!confirm("Delete this subject?")) return;
    try {
      await apiDelete(`/api/academics/subjects/${id}`);
      addToast("Subject deleted", "success");
      await loadSubjects();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete subject", "error");
    }
  }

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/academics/years", {
        name: yearForm.name,
        startDate: yearForm.startDate,
        endDate: yearForm.endDate,
        isActive: yearForm.isActive,
      });
      addToast("Academic year created", "success");
      setYearForm({ name: "", startDate: "", endDate: "", isActive: false });
      await loadYears();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create academic year", "error");
    }
  }

  async function activateYear(id: string) {
    try {
      await apiPatch(`/api/academics/years/${id}`, { isActive: true });
      addToast("Academic year activated", "success");
      await loadYears();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to activate year", "error");
    }
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/academics/assignments", assignmentForm);
      addToast("Teacher assignment created", "success");
      setAssignmentForm({ teacherId: "", subjectId: "", classId: "", sectionId: "", academicYearId: "" });
      await loadAssignments();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create assignment", "error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Academic Management</h1>
      <p className="mt-1 text-slate-500">Manage classes, sections, subjects, academic years, and teacher assignments.</p>

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

      {activeTab === "classes" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createClass} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create class</h2>
            <input value={classForm.name} onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))} placeholder="Class name" className="w-full rounded-lg border px-3 py-2" required />
            <input value={classForm.description} onChange={(e) => setClassForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full rounded-lg border px-3 py-2" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="number" value={classForm.grade} onChange={(e) => setClassForm((f) => ({ ...f, grade: Number(e.target.value) }))} placeholder="Grade" className="w-full rounded-lg border px-3 py-2" min={1} max={12} required />
              <input value={classForm.section} onChange={(e) => setClassForm((f) => ({ ...f, section: e.target.value }))} placeholder="Default section" className="w-full rounded-lg border px-3 py-2" required />
            </div>
            <select value={classForm.teacherId} onChange={(e) => setClassForm((f) => ({ ...f, teacherId: e.target.value }))} className="w-full rounded-lg border px-3 py-2">
              <option value="">Class teacher (optional)</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Classes</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Grade</th>
                    <th className="px-2 py-2">Section</th>
                    <th className="px-2 py-2">Teacher</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <input
                          value={item.name}
                          disabled={editingClassId !== item.id}
                          onChange={(e) => setClasses((prev) => prev.map((c) => (c.id === item.id ? { ...c, name: e.target.value } : c)))}
                          className={`w-full rounded border px-2 py-1 ${editingClassId === item.id ? "" : "border-transparent bg-transparent"}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={item.grade}
                          disabled={editingClassId !== item.id}
                          onChange={(e) => setClasses((prev) => prev.map((c) => (c.id === item.id ? { ...c, grade: Number(e.target.value) } : c)))}
                          className={`w-20 rounded border px-2 py-1 ${editingClassId === item.id ? "" : "border-transparent bg-transparent"}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.section}
                          disabled={editingClassId !== item.id}
                          onChange={(e) => setClasses((prev) => prev.map((c) => (c.id === item.id ? { ...c, section: e.target.value } : c)))}
                          className={`w-20 rounded border px-2 py-1 ${editingClassId === item.id ? "" : "border-transparent bg-transparent"}`}
                        />
                      </td>
                      <td className="px-2 py-2 text-slate-600">{item.teacher ? `${item.teacher.firstName} ${item.teacher.lastName}` : "-"}</td>
                      <td className="px-2 py-2">
                        {editingClassId === item.id ? (
                          <button type="button" onClick={() => saveClass(item)} className="text-blue-600 mr-2">Save</button>
                        ) : (
                          <button type="button" onClick={() => setEditingClassId(item.id)} className="text-blue-600 mr-2">Edit</button>
                        )}
                        <button type="button" onClick={() => removeClass(item.id)} className="text-red-600">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sections" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createSection} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create section</h2>
            <select value={sectionForm.classId} onChange={(e) => setSectionForm((f) => ({ ...f, classId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={sectionForm.name} onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))} placeholder="Section name" className="w-full rounded-lg border px-3 py-2" required />
            <input type="number" value={sectionForm.capacity} onChange={(e) => setSectionForm((f) => ({ ...f, capacity: Number(e.target.value) }))} placeholder="Capacity" className="w-full rounded-lg border px-3 py-2" min={0} required />
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Sections</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Capacity</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">
                        <input value={item.name} disabled={editingSectionId !== item.id} onChange={(e) => setSections((prev) => prev.map((s) => (s.id === item.id ? { ...s, name: e.target.value } : s)))} className={`w-full rounded border px-2 py-1 ${editingSectionId === item.id ? "" : "border-transparent bg-transparent"}`} />
                      </td>
                      <td className="px-2 py-2 text-slate-600">{item.class?.name ?? item.classId}</td>
                      <td className="px-2 py-2">
                        <input type="number" value={item.capacity} disabled={editingSectionId !== item.id} onChange={(e) => setSections((prev) => prev.map((s) => (s.id === item.id ? { ...s, capacity: Number(e.target.value) } : s)))} className={`w-24 rounded border px-2 py-1 ${editingSectionId === item.id ? "" : "border-transparent bg-transparent"}`} />
                      </td>
                      <td className="px-2 py-2">
                        {editingSectionId === item.id ? <button type="button" onClick={() => saveSection(item)} className="text-blue-600 mr-2">Save</button> : <button type="button" onClick={() => setEditingSectionId(item.id)} className="text-blue-600 mr-2">Edit</button>}
                        <button type="button" onClick={() => removeSection(item.id)} className="text-red-600">Delete</button>
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
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createSubject} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create subject</h2>
            <select value={subjectForm.classId} onChange={(e) => setSubjectForm((f) => ({ ...f, classId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} placeholder="Subject name" className="w-full rounded-lg border px-3 py-2" required />
            <input value={subjectForm.code} onChange={(e) => setSubjectForm((f) => ({ ...f, code: e.target.value }))} placeholder="Subject code" className="w-full rounded-lg border px-3 py-2" />
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Subjects</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Class</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-2 py-2"><input value={item.name} disabled={editingSubjectId !== item.id} onChange={(e) => setSubjects((prev) => prev.map((s) => (s.id === item.id ? { ...s, name: e.target.value } : s)))} className={`w-full rounded border px-2 py-1 ${editingSubjectId === item.id ? "" : "border-transparent bg-transparent"}`} /></td>
                      <td className="px-2 py-2"><input value={item.code ?? ""} disabled={editingSubjectId !== item.id} onChange={(e) => setSubjects((prev) => prev.map((s) => (s.id === item.id ? { ...s, code: e.target.value } : s)))} className={`w-24 rounded border px-2 py-1 ${editingSubjectId === item.id ? "" : "border-transparent bg-transparent"}`} /></td>
                      <td className="px-2 py-2 text-slate-600">{item.class?.name ?? "-"}</td>
                      <td className="px-2 py-2">
                        {editingSubjectId === item.id ? <button type="button" onClick={() => saveSubject(item)} className="text-blue-600 mr-2">Save</button> : <button type="button" onClick={() => setEditingSubjectId(item.id)} className="text-blue-600 mr-2">Edit</button>}
                        <button type="button" onClick={() => removeSubject(item.id)} className="text-red-600">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "years" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createYear} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create academic year</h2>
            <input value={yearForm.name} onChange={(e) => setYearForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. 2026-27)" className="w-full rounded-lg border px-3 py-2" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="date" value={yearForm.startDate} onChange={(e) => setYearForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required />
              <input type="date" value={yearForm.endDate} onChange={(e) => setYearForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yearForm.isActive} onChange={(e) => setYearForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Set active
            </label>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Academic years</h2>
            <ul className="mt-3 space-y-2">
              {years.map((year) => (
                <li key={year.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{year.name}</p>
                    <p className="text-xs text-slate-500">{new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {year.isActive ? <span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Active</span> : <button type="button" onClick={() => activateYear(year.id)} className="rounded border px-2 py-1 text-xs">Activate</button>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === "assignments" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <form onSubmit={createAssignment} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Assign teacher</h2>
            <select value={assignmentForm.academicYearId} onChange={(e) => setAssignmentForm((f) => ({ ...f, academicYearId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select academic year</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (Active)" : ""}</option>)}
            </select>
            <select value={assignmentForm.classId} onChange={(e) => setAssignmentForm((f) => ({ ...f, classId: e.target.value, sectionId: "", subjectId: "" }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={assignmentForm.sectionId} onChange={(e) => setAssignmentForm((f) => ({ ...f, sectionId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select section</option>
              {sectionsForSelectedClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={assignmentForm.subjectId} onChange={(e) => setAssignmentForm((f) => ({ ...f, subjectId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select subject</option>
              {subjectsForSelectedClass.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
            </select>
            <select value={assignmentForm.teacherId} onChange={(e) => setAssignmentForm((f) => ({ ...f, teacherId: e.target.value }))} className="w-full rounded-lg border px-3 py-2" required>
              <option value="">Select teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Assign</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Assignments</h2>
            <ul className="mt-3 space-y-2">
              {assignments.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-medium text-slate-900">{item.teacher.firstName} {item.teacher.lastName}</p>
                  <p className="text-slate-600">{item.subject.name} ({item.subject.code || "-"}) · {item.class.name} · Section {item.section.name}</p>
                  <p className="text-xs text-slate-500">{item.academicYear.name}{item.academicYear.isActive ? " (Active)" : ""}</p>
                </li>
              ))}
              {assignments.length === 0 && <li className="text-sm text-slate-500">No assignments yet.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
