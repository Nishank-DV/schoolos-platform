import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type Tab = "announcements" | "status" | "overview";
type Priority = "low" | "normal" | "high";
type Audience = "all" | "students" | "parents";

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  audience: Audience;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Overview = {
  totalAnnouncements: number;
  byPriority: Record<Priority, number>;
  byAudience: Record<Audience, number>;
  published: number;
  draft: number;
  expired: number;
};

type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "announcements", label: "Announcements" },
  { id: "status", label: "Publish / Status" },
  { id: "overview", label: "Overview" },
];

function badgeClass(priority: Priority) {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-700";
}

export default function Announcements() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("announcements");
  const [items, setItems] = useState<Announcement[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"" | Priority>("");
  const [audienceFilter, setAudienceFilter] = useState<"" | Audience>("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal" as Priority,
    audience: "all" as Audience,
    isPublished: false,
    expiresAt: "",
  });

  async function loadAnnouncements() {
    const q = new URLSearchParams({ page: "1", pageSize: "100" });
    if (priorityFilter) q.set("priority", priorityFilter);
    if (audienceFilter) q.set("audience", audienceFilter);
    if (publishedFilter) q.set("isPublished", publishedFilter);
    const data = await apiGet<Paged<Announcement>>(`/api/announcements?${q.toString()}`);
    setItems(data.items ?? []);
  }

  async function loadOverview() {
    const data = await apiGet<Overview>("/api/announcements/report/overview");
    setOverview(data);
  }

  useEffect(() => {
    Promise.all([loadAnnouncements(), loadOverview()]).catch((error) => {
      addToast(error instanceof Error ? error.message : "Failed to load announcements", "error");
    });
  }, []);

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/announcements", {
        title: form.title,
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        isPublished: form.isPublished,
        expiresAt: form.expiresAt || null,
      });
      addToast("Announcement created", "success");
      setForm({ title: "", body: "", priority: "normal", audience: "all", isPublished: false, expiresAt: "" });
      await loadAnnouncements();
      await loadOverview();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create announcement", "error");
    }
  }

  async function saveAnnouncement(item: Announcement) {
    try {
      await apiPatch(`/api/announcements/${item.id}`, {
        title: item.title,
        body: item.body,
        priority: item.priority,
        audience: item.audience,
        isPublished: item.isPublished,
        expiresAt: item.expiresAt,
      });
      addToast("Announcement updated", "success");
      await loadAnnouncements();
      await loadOverview();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update announcement", "error");
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await apiDelete(`/api/announcements/${id}`);
      addToast("Announcement deleted", "success");
      await loadAnnouncements();
      await loadOverview();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete announcement", "error");
    }
  }

  async function togglePublish(item: Announcement) {
    try {
      if (item.isPublished) await apiPost(`/api/announcements/${item.id}/unpublish`, {});
      else await apiPost(`/api/announcements/${item.id}/publish`, {});
      addToast(item.isPublished ? "Announcement unpublished" : "Announcement published", "success");
      await loadAnnouncements();
      await loadOverview();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update publish state", "error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
      <p className="mt-1 text-slate-500">Create school-wide notices, target audiences, and control publication state.</p>

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

      {activeTab === "announcements" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <form onSubmit={createAnnouncement} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create Announcement</h2>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Title" required />
            <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" rows={5} placeholder="Announcement body" required />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))} className="rounded-lg border px-3 py-2 text-sm">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as Audience }))} className="rounded-lg border px-3 py-2 text-sm">
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="parents">Parents</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
                Publish immediately
              </label>
            </div>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create Announcement</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <div className="grid gap-2 md:grid-cols-4">
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "" | Priority)} className="rounded border px-2 py-2 text-sm">
                <option value="">All priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value as "" | Audience)} className="rounded border px-2 py-2 text-sm">
                <option value="">All audiences</option>
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="parents">Parents</option>
              </select>
              <select value={publishedFilter} onChange={(e) => setPublishedFilter(e.target.value as "" | "true" | "false")} className="rounded border px-2 py-2 text-sm">
                <option value="">All states</option>
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </select>
              <button type="button" onClick={() => loadAnnouncements().catch((error) => addToast(error instanceof Error ? error.message : "Failed to filter announcements", "error"))} className="rounded border px-2 py-2 text-sm">Apply Filters</button>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-1 text-xs ${badgeClass(item.priority)}`}>{item.priority}</span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.audience}</span>
                    <span className={`rounded px-2 py-1 text-xs ${item.isPublished ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{item.isPublished ? "published" : "draft"}</span>
                  </div>
                  <input value={item.title} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, title: e.target.value } : row))} className="w-full rounded border px-2 py-1 text-sm" />
                  <textarea value={item.body} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, body: e.target.value } : row))} className="w-full rounded border px-2 py-1 text-sm" rows={4} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <select value={item.priority} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, priority: e.target.value as Priority } : row))} className="rounded border px-2 py-1 text-sm">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                    <select value={item.audience} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, audience: e.target.value as Audience } : row))} className="rounded border px-2 py-1 text-sm">
                      <option value="all">All</option>
                      <option value="students">Students</option>
                      <option value="parents">Parents</option>
                    </select>
                    <input type="date" value={item.expiresAt ? item.expiresAt.slice(0, 10) : ""} onChange={(e) => setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, expiresAt: e.target.value || null } : row))} className="rounded border px-2 py-1 text-sm" />
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => saveAnnouncement(item)} className="rounded border px-2 py-1">Save</button>
                    <button type="button" onClick={() => togglePublish(item)} className="rounded border px-2 py-1">{item.isPublished ? "Unpublish" : "Publish"}</button>
                    <button type="button" onClick={() => deleteAnnouncement(item.id)} className="rounded border border-red-200 px-2 py-1 text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "status" && (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Publish Status</h2>
          <div className="mt-3 space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">Audience: {item.audience} · Created: {new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                <button type="button" onClick={() => togglePublish(item)} className={`rounded px-3 py-1 text-xs ${item.isPublished ? "bg-slate-100 text-slate-700" : "bg-primary-600 text-white"}`}>
                  {item.isPublished ? "Unpublish" : "Publish"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Total</p><p className="text-xl font-semibold">{overview?.totalAnnouncements ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Published / Draft</p><p className="text-xl font-semibold">{overview?.published ?? 0} / {overview?.draft ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Expired</p><p className="text-xl font-semibold">{overview?.expired ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">High Priority</p><p className="text-xl font-semibold text-red-700">{overview?.byPriority.high ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Student Audience</p><p className="text-xl font-semibold">{overview?.byAudience.students ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Parent Audience</p><p className="text-xl font-semibold">{overview?.byAudience.parents ?? 0}</p></div>
        </div>
      )}
    </div>
  );
}
