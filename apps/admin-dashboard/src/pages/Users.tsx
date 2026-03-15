import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { apiPost, apiPatch, apiDelete } from "../lib/api";
import { apiUrl } from "../lib/api";

type UserRow = {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
  studentId: string | null;
  parentId: string | null;
  teacherId: string | null;
  createdAt: string;
  school?: { name: string };
  student?: { firstName: string; lastName: string };
  parent?: { firstName: string; lastName: string };
  teacher?: { firstName: string; lastName: string };
};

type LinkOptions = {
  students: Array<{ id: string; firstName: string; lastName: string; admissionNumber: string; grade: number }>;
  teachers: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  parents: Array<{ id: string; firstName: string; lastName: string; email: string }>;
};

const ROLES = ["school_admin", "teacher", "parent", "student", "integration_service"] as const;

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Users() {
  const { addToast } = useToast();
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "student" as string,
    schoolId: "",
    studentId: "",
    teacherId: "",
    parentId: "",
  });
  const [linkOptions, setLinkOptions] = useState<LinkOptions>({ students: [], teachers: [], parents: [] });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  function load() {
    const q = new URLSearchParams({ page: "1", pageSize: "100" });
    if (roleFilter) q.set("role", roleFilter);
    fetch(apiUrl(`/api/users?${q}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data.items);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [roleFilter]);

  useEffect(() => {
    fetch(apiUrl("/api/users/link-options"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setLinkOptions(d.data);
      });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await apiPost("/api/users", {
        email: form.email,
        password: form.password,
        role: form.role,
        schoolId: form.schoolId || undefined,
        studentId: form.role === "student" ? (form.studentId || undefined) : undefined,
        teacherId: form.role === "teacher" ? (form.teacherId || undefined) : undefined,
        parentId: form.role === "parent" ? (form.parentId || undefined) : undefined,
      });
      addToast("User created", "success");
      setShowForm(false);
      setForm({ email: "", password: "", role: "student", schoolId: "", studentId: "", teacherId: "", parentId: "" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleUpdateRole(userId: string) {
    try {
      await apiPatch(`/api/users/${userId}`, { role: editRole });
      addToast("Role updated", "success");
      setEditingId(null);
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Remove this user? They will not be able to log in.")) return;
    try {
      await apiDelete(`/api/users/${userId}`);
      addToast("User removed", "success");
      load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users & roles</h1>
          <p className="text-slate-500 mt-1">Add or remove users and assign privileges (roles)</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium"
          >
            Add user
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-6 p-4 bg-white rounded-xl border max-w-md">
          <h2 className="font-medium mb-3">Create user (login account)</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="block text-sm text-slate-600">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 mt-0.5"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 mt-0.5"
                minLength={8}
                placeholder="Min 8 chars, letter + number"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600">Role (privileges)</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, studentId: "", teacherId: "", parentId: "" }))}
                className="w-full rounded-lg border px-3 py-2 mt-0.5"
              >
                <option value="school_admin">School admin</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
                <option value="integration_service">Integration service</option>
              </select>
            </div>
            {form.role === "student" && (
              <div>
                <label className="block text-sm text-slate-600">Link student</label>
                <select
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                  required
                >
                  <option value="">Select student</option>
                  {linkOptions.students.map((s) => (
                    <option key={s.id} value={s.id}>{s.admissionNumber} - {s.firstName} {s.lastName} (Grade {s.grade})</option>
                  ))}
                </select>
                {linkOptions.students.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">No students found. Create a student first, or use Students page with Create login.</p>
                )}
              </div>
            )}
            {form.role === "teacher" && (
              <div>
                <label className="block text-sm text-slate-600">Link teacher (optional)</label>
                <select
                  value={form.teacherId}
                  onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                >
                  <option value="">Auto-create teacher profile from email</option>
                  {linkOptions.teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>
                  ))}
                </select>
              </div>
            )}
            {form.role === "parent" && (
              <div>
                <label className="block text-sm text-slate-600">Link parent (optional)</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 mt-0.5"
                >
                  <option value="">Auto-create parent profile from email</option>
                  {linkOptions.parents.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.email})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-primary-600 text-white px-4 py-2 text-sm">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Role</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Linked to</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3">
                  {editingId === u.id ? (
                    <span className="flex items-center gap-2">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{roleLabel(r)}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleUpdateRole(u.id)} className="text-blue-600 text-sm">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-slate-500 text-sm">Cancel</button>
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-slate-100">{roleLabel(u.role)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {u.student && `${u.student.firstName} ${u.student.lastName} (student)`}
                  {u.parent && `${u.parent.firstName} ${u.parent.lastName} (parent)`}
                  {u.teacher && `${u.teacher.firstName} ${u.teacher.lastName} (teacher)`}
                  {!u.student && !u.parent && !u.teacher && "-"}
                </td>
                <td className="px-4 py-3">
                  {editingId !== u.id && (
                    <>
                      <button type="button" onClick={() => { setEditingId(u.id); setEditRole(u.role); }} className="text-blue-600 text-sm mr-2">Change role</button>
                      <button type="button" onClick={() => handleDelete(u.id)} className="text-red-600 text-sm">Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="px-4 py-8 text-center text-slate-500">No users found for this role filter.</p>}
      </div>
    </div>
  );
}
