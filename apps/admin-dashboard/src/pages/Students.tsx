import { useEffect, useState, useMemo } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { apiPost, apiPatch, apiDelete } from "../lib/api";
import { apiUrl } from "../lib/api";

type Student = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  grade: number;
  section: string | null;
  status: string;
  school?: { id: string; name: string };
  parent?: { id: string; firstName: string; lastName: string };
  class?: { id: string; name: string };
};

type ClassRow = { id: string; name: string; grade: number };

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-800";
  if (status === "transferred") return "bg-amber-100 text-amber-800";
  if (status === "graduated") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

export default function Students() {
  const { addToast } = useToast();
  const [items, setItems] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    grade: 9,
    section: "A",
    classId: "",
    parentId: "",
    createLogin: false,
    loginEmail: "",
    loginPassword: "",
  });
  const [editing, setEditing] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ grade: 9, section: "", classId: "", status: "active" });
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (s) =>
        s.admissionNumber.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q)
    );
  }, [items, search]);

  function load() {
    setLoading(true);
    fetch(apiUrl("/api/students?page=1&pageSize=100"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items);
      })
      .catch(() => addToast("Failed to load students", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/classes?page=1&pageSize=50"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => { if (d.success) setClasses(d.data.items); });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const selectedClass = classes.find((c) => c.id === form.classId);
    if (selectedClass && selectedClass.grade !== form.grade) {
      setError(`Class ${selectedClass.name} is grade ${selectedClass.grade}. Please match the student grade.`);
      return;
    }
    if (form.createLogin && (!form.loginEmail || !form.loginPassword)) {
      setError("Login email and password are required when Create login is enabled.");
      return;
    }
    try {
      const body = {
        admissionNumber: form.admissionNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        grade: form.grade,
        section: form.section,
        classId: form.classId || undefined,
        parentId: form.parentId || undefined,
      };
      const d = await apiPost<{ id: string }>("/api/students", body);
      const studentId = d.id;
      if (form.createLogin && form.loginEmail && form.loginPassword) {
        try {
          await apiPost("/api/users", {
            email: form.loginEmail,
            password: form.loginPassword,
            role: "student",
            studentId,
          });
        } catch (e) {
          addToast("Student added but login creation failed: " + (e instanceof Error ? e.message : ""), "error");
        }
      }
      addToast("Student added successfully", "success");
      setShowForm(false);
      setForm({
        admissionNumber: "",
        firstName: "",
        lastName: "",
        grade: 9,
        section: "A",
        classId: "",
        parentId: "",
        createLogin: false,
        loginEmail: "",
        loginPassword: "",
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add student");
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await apiPatch(`/api/students/${editing.id}`, {
        grade: editForm.grade,
        section: editForm.section || null,
        classId: editForm.classId || null,
        status: editForm.status,
      });
      addToast("Student updated", "success");
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleDelete(studentId: string) {
    if (!confirm("Remove this student? This will also remove their login if linked.")) return;
    try {
      await apiDelete(`/api/students/${studentId}`);
      addToast("Student removed", "success");
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  function openEdit(s: Student) {
    setEditing(s);
    setEditForm({
      grade: s.grade,
      section: s.section ?? "",
      classId: s.class?.id ?? "",
      status: s.status,
    });
    setError("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 mt-1">Add, edit, or remove students</p>
          <p className="text-xs text-slate-400 mt-1">Showing {filtered.length} of {items.length} students</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name or admission #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56"
          />
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium"
          >
            Add student
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-6 p-4 bg-white rounded-xl border max-w-lg shadow-sm">
          <h2 className="font-medium mb-3">New student</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600">Admission #</label>
                <input
                  value={form.admissionNumber}
                  onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Grade</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                >
                  {[9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600">First name</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Last name</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600">Section</label>
                <input
                  value={form.section}
                  onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Class</label>
                <select
                  value={form.classId}
                  onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                >
                  <option value="">— Select —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">Choose a class from the same grade to avoid validation errors.</p>
              </div>
            </div>
            <div className="border-t pt-3 mt-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.createLogin}
                  onChange={(e) => setForm((f) => ({ ...f, createLogin: e.target.checked }))}
                />
                <span className="text-sm">Create login for this student</span>
              </label>
              {form.createLogin && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    placeholder="Login email"
                    value={form.loginEmail}
                    onChange={(e) => setForm((f) => ({ ...f, loginEmail: e.target.value }))}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Password (min 8, letter + number)"
                    value={form.loginPassword}
                    onChange={(e) => setForm((f) => ({ ...f, loginPassword: e.target.value }))}
                    className="rounded-lg border px-3 py-2 text-sm"
                    minLength={8}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm">Add student</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="mt-6 p-4 bg-white rounded-xl border max-w-md shadow-sm">
          <h2 className="font-medium mb-3">Edit: {editing.firstName} {editing.lastName}</h2>
          <form onSubmit={handleUpdate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600">Grade</label>
                <select
                  value={editForm.grade}
                  onChange={(e) => setEditForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                >
                  {[9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600">Section</label>
                <input
                  value={editForm.section}
                  onChange={(e) => setEditForm((f) => ({ ...f, section: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600">Class</label>
              <select
                value={editForm.classId}
                onChange={(e) => setEditForm((f) => ({ ...f, classId: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 mt-0.5"
              >
                <option value="">— Select —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 mt-0.5"
              >
                <option value="active">Active</option>
                <option value="transferred">Transferred</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Admission #</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Grade</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Class</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{s.admissionNumber}</td>
                <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
                <td className="px-4 py-3 text-sm">{s.grade}</td>
                <td className="px-4 py-3 text-sm">{s.class?.name ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${statusBadgeClass(s.status)}`}>{s.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => openEdit(s)} className="text-blue-600 text-sm mr-2">Edit</button>
                  <button type="button" onClick={() => handleDelete(s.id)} className="text-red-600 text-sm">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-slate-500">No students found</p>
        )}
      </div>
    </div>
  );
}
