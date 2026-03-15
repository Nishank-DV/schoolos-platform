import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type AdmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "documents_pending"
  | "documents_verified"
  | "offered"
  | "admitted"
  | "rejected"
  | "withdrawn";

type AdmissionListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  desiredGrade: string;
  desiredSection: string | null;
  status: AdmissionStatus;
  createdAt: string;
  enquiry?: { id: string; name: string; status: string } | null;
  student?: { id: string; admissionNumber: string; firstName: string; lastName: string; grade: number } | null;
  _count?: { documents: number; notes: number; stageHistory: number };
};

type AdmissionDocument = {
  id: string;
  type: string;
  title: string;
  fileUrl: string | null;
  status: string;
  verifiedAt: string | null;
};

type AdmissionNote = {
  id: string;
  body: string;
  authorUserId: string | null;
  createdAt: string;
};

type AdmissionStageHistory = {
  id: string;
  fromStatus: AdmissionStatus | null;
  toStatus: AdmissionStatus;
  note: string | null;
  createdAt: string;
};

type AdmissionDetail = AdmissionListItem & {
  phone: string | null;
  source: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  admittedAt: string | null;
  rejectedAt: string | null;
  school?: { id: string; name: string };
  documents: AdmissionDocument[];
  notes: AdmissionNote[];
  stageHistory: AdmissionStageHistory[];
};

type PagedAdmissions = {
  items: AdmissionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const STATUSES: AdmissionStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "documents_pending",
  "documents_verified",
  "offered",
  "admitted",
  "rejected",
  "withdrawn",
];

const NEXT_STAGE_MAP: Record<AdmissionStatus, AdmissionStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["documents_pending", "documents_verified", "offered", "rejected", "withdrawn"],
  documents_pending: ["documents_verified", "under_review", "rejected", "withdrawn"],
  documents_verified: ["offered", "under_review", "rejected", "withdrawn"],
  offered: ["admitted", "rejected", "withdrawn"],
  admitted: [],
  rejected: [],
  withdrawn: [],
};

export default function Admissions() {
  const { addToast } = useToast();
  const [items, setItems] = useState<AdmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdmissionDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    desiredGrade: "9",
    desiredSection: "",
    source: "",
    enquiryId: "",
  });
  const [documentForm, setDocumentForm] = useState({ type: "birth_certificate", title: "", fileUrl: "", status: "pending" });
  const [convertForm, setConvertForm] = useState({
    admissionNumber: "",
    section: "",
    classId: "",
    parentId: "",
    createUser: false,
    userEmail: "",
    userPassword: "",
  });

  async function loadApplications(preserveSelection = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (gradeFilter) params.set("desiredGrade", gradeFilter);
      const data = await apiGet<PagedAdmissions>(`/api/admissions?${params.toString()}`);
      setItems(data.items ?? []);
      if (!preserveSelection && data.items[0]) setSelectedId(data.items[0].id);
      if (preserveSelection && selectedId && data.items.some((item) => item.id === selectedId)) return;
      if (!selectedId && data.items[0]) setSelectedId(data.items[0].id);
      if (selectedId && !data.items.some((item) => item.id === selectedId)) {
        setSelectedId(data.items[0]?.id ?? null);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load admissions", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      const data = await apiGet<AdmissionDetail>(`/api/admissions/${id}`);
      setDetail(data);
      setConvertForm((current) => ({
        ...current,
        section: current.section || data.desiredSection || "",
        userEmail: current.userEmail || data.email || "",
      }));
    } catch (error) {
      setDetail(null);
      addToast(error instanceof Error ? error.message : "Failed to load admission detail", "error");
    }
  }

  useEffect(() => {
    loadApplications(false);
  }, [statusFilter, gradeFilter]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  const nextStages = useMemo(() => {
    if (!detail) return [];
    return NEXT_STAGE_MAP[detail.status] ?? [];
  }, [detail]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await apiPost<AdmissionDetail>("/api/admissions", {
        ...createForm,
        enquiryId: createForm.enquiryId || undefined,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        desiredSection: createForm.desiredSection || undefined,
        source: createForm.source || undefined,
      });
      addToast("Admission application created", "success");
      setShowCreate(false);
      setCreateForm({ firstName: "", lastName: "", email: "", phone: "", desiredGrade: "9", desiredSection: "", source: "", enquiryId: "" });
      await loadApplications();
      setSelectedId(created.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create application", "error");
    }
  }

  async function handleSubmitApplication() {
    if (!detail) return;
    try {
      await apiPost(`/api/admissions/${detail.id}/submit`, {});
      addToast("Application submitted", "success");
      await loadApplications();
      await loadDetail(detail.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to submit application", "error");
    }
  }

  async function handleStageChange(toStatus: AdmissionStatus) {
    if (!detail) return;
    try {
      await apiPost(`/api/admissions/${detail.id}/change-stage`, { toStatus, note: stageNote || undefined });
      addToast(`Stage changed to ${toStatus}`, "success");
      setStageNote("");
      await loadApplications();
      await loadDetail(detail.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to change stage", "error");
    }
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await apiPost(`/api/admissions/${detail.id}/documents`, {
        ...documentForm,
        fileUrl: documentForm.fileUrl || undefined,
      });
      addToast("Document added", "success");
      setDocumentForm({ type: "birth_certificate", title: "", fileUrl: "", status: "pending" });
      await loadDetail(detail.id);
      await loadApplications();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to add document", "error");
    }
  }

  async function handleDocumentStatus(documentId: string, status: string) {
    if (!detail) return;
    try {
      await apiPatch(`/api/admissions/${detail.id}/documents/${documentId}`, { status });
      addToast("Document updated", "success");
      await loadDetail(detail.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update document", "error");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !newNote.trim()) return;
    try {
      await apiPost(`/api/admissions/${detail.id}/notes`, { body: newNote.trim() });
      addToast("Note added", "success");
      setNewNote("");
      await loadDetail(detail.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to add note", "error");
    }
  }

  async function handleConvertToStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await apiPost(`/api/admissions/${detail.id}/convert-to-student`, {
        admissionNumber: convertForm.admissionNumber,
        section: convertForm.section || undefined,
        classId: convertForm.classId || undefined,
        parentId: convertForm.parentId || undefined,
        createUser: convertForm.createUser,
        userEmail: convertForm.userEmail || undefined,
        userPassword: convertForm.createUser ? convertForm.userPassword : undefined,
      });
      addToast("Student created from admission application", "success");
      setConvertForm({ admissionNumber: "", section: "", classId: "", parentId: "", createUser: false, userEmail: "", userPassword: "" });
      await loadApplications();
      await loadDetail(detail.id);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to convert to student", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admissions Workflow</h1>
          <p className="text-slate-500 mt-1">Structured pipeline from enquiry to student enrollment</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        >
          {showCreate ? "Close" : "New application"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="rounded-lg border px-3 py-2" required />
          <input value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="rounded-lg border px-3 py-2" required />
          <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="rounded-lg border px-3 py-2" />
          <input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="rounded-lg border px-3 py-2" />
          <input value={createForm.desiredGrade} onChange={(e) => setCreateForm((f) => ({ ...f, desiredGrade: e.target.value }))} placeholder="Desired grade" className="rounded-lg border px-3 py-2" required />
          <input value={createForm.desiredSection} onChange={(e) => setCreateForm((f) => ({ ...f, desiredSection: e.target.value }))} placeholder="Desired section" className="rounded-lg border px-3 py-2" />
          <input value={createForm.source} onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))} placeholder="Source" className="rounded-lg border px-3 py-2" />
          <input value={createForm.enquiryId} onChange={(e) => setCreateForm((f) => ({ ...f, enquiryId: e.target.value }))} placeholder="Linked enquiry ID (optional)" className="rounded-lg border px-3 py-2" />
          <div className="md:col-span-2 xl:col-span-4">
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create application</button>
          </div>
        </form>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <input value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} placeholder="Filter by grade" className="rounded-lg border px-3 py-2 text-sm" />
          </div>

          {loading ? <div className="text-slate-500">Loading...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 text-sm text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Applicant</th>
                    <th className="px-3 py-2">Grade</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer border-b border-slate-100 ${selectedId === item.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.firstName} {item.lastName}</div>
                        <div className="text-xs text-slate-500">{item.email || "No email"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm">{item.desiredGrade}{item.desiredSection ? `-${item.desiredSection}` : ""}</td>
                      <td className="px-3 py-3"><span className="rounded bg-slate-100 px-2 py-1 text-xs">{item.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-500">{item.student ? `Student ${item.student.admissionNumber}` : item.enquiry ? "Enquiry linked" : "Standalone"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <p className="mt-4 text-sm text-slate-500">No admission applications found.</p>}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {!detail ? (
            <p className="text-slate-500">Select an application to view details.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{detail.firstName} {detail.lastName}</h2>
                    <p className="text-sm text-slate-500">{detail.school?.name || "School"} · Desired grade {detail.desiredGrade}{detail.desiredSection ? `-${detail.desiredSection}` : ""}</p>
                  </div>
                  <span className="rounded bg-emerald-50 px-3 py-1 text-sm text-emerald-700">{detail.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <p>Email: {detail.email || "-"}</p>
                  <p>Phone: {detail.phone || "-"}</p>
                  <p>Source: {detail.source || "-"}</p>
                  <p>Enquiry: {detail.enquiry ? `${detail.enquiry.name} (${detail.enquiry.status})` : "-"}</p>
                  <p>Submitted: {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "-"}</p>
                  <p>Enrolled student: {detail.student ? `${detail.student.firstName} ${detail.student.lastName} (${detail.student.admissionNumber})` : "-"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Stage actions</h3>
                <p className="mt-1 text-sm text-slate-500">Use the workflow stages to move an applicant toward enrollment.</p>
                <textarea value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="Optional note for the stage history" className="mt-3 min-h-20 w-full rounded-lg border px-3 py-2 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.status === "draft" && (
                    <button type="button" onClick={handleSubmitApplication} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Submit</button>
                  )}
                  {nextStages.map((status) => (
                    <button key={status} type="button" onClick={() => handleStageChange(status)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Move to {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-medium text-slate-900">Documents</h3>
                  <form onSubmit={handleAddDocument} className="mt-3 space-y-2">
                    <input value={documentForm.title} onChange={(e) => setDocumentForm((f) => ({ ...f, title: e.target.value }))} placeholder="Document title" className="w-full rounded-lg border px-3 py-2 text-sm" required />
                    <input value={documentForm.type} onChange={(e) => setDocumentForm((f) => ({ ...f, type: e.target.value }))} placeholder="Document type" className="w-full rounded-lg border px-3 py-2 text-sm" required />
                    <input value={documentForm.fileUrl} onChange={(e) => setDocumentForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="File URL" className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <select value={documentForm.status} onChange={(e) => setDocumentForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm">
                      <option value="pending">pending</option>
                      <option value="received">received</option>
                      <option value="verified">verified</option>
                      <option value="rejected">rejected</option>
                    </select>
                    <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Add document</button>
                  </form>
                  <ul className="mt-4 space-y-2 text-sm">
                    {detail.documents.length === 0 ? <li className="text-slate-500">No documents yet.</li> : detail.documents.map((doc) => (
                      <li key={doc.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{doc.title}</p>
                            <p className="text-xs text-slate-500">{doc.type}</p>
                            {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600">Open file</a>}
                          </div>
                          <select value={doc.status} onChange={(e) => handleDocumentStatus(doc.id, e.target.value)} className="rounded border px-2 py-1 text-xs">
                            <option value="pending">pending</option>
                            <option value="received">received</option>
                            <option value="verified">verified</option>
                            <option value="rejected">rejected</option>
                          </select>
                        </div>
                        {doc.verifiedAt && <p className="mt-1 text-xs text-emerald-600">Verified {new Date(doc.verifiedAt).toLocaleString()}</p>}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-medium text-slate-900">Internal notes</h3>
                  <form onSubmit={handleAddNote} className="mt-3 space-y-2">
                    <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add staff note" className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm" required />
                    <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Add note</button>
                  </form>
                  <ul className="mt-4 space-y-2 text-sm">
                    {detail.notes.length === 0 ? <li className="text-slate-500">No notes yet.</li> : detail.notes.map((note) => (
                      <li key={note.id} className="rounded-lg border border-slate-100 p-3">
                        <p className="text-slate-800">{note.body}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Stage history</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {detail.stageHistory.length === 0 ? <li className="text-slate-500">No stage history yet.</li> : detail.stageHistory.map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-slate-100 p-3">
                      <p className="font-medium text-slate-900">{entry.fromStatus || "start"} → {entry.toStatus}</p>
                      {entry.note && <p className="mt-1 text-slate-600">{entry.note}</p>}
                      <p className="mt-1 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="font-medium text-emerald-900">Convert to student</h3>
                <p className="mt-1 text-sm text-emerald-800">Available once the application reaches the admitted stage.</p>
                <form onSubmit={handleConvertToStudent} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input value={convertForm.admissionNumber} onChange={(e) => setConvertForm((f) => ({ ...f, admissionNumber: e.target.value }))} placeholder="Admission number" className="rounded-lg border px-3 py-2 text-sm" required />
                  <input value={convertForm.section} onChange={(e) => setConvertForm((f) => ({ ...f, section: e.target.value }))} placeholder="Section" className="rounded-lg border px-3 py-2 text-sm" />
                  <input value={convertForm.classId} onChange={(e) => setConvertForm((f) => ({ ...f, classId: e.target.value }))} placeholder="Class ID (optional)" className="rounded-lg border px-3 py-2 text-sm" />
                  <input value={convertForm.parentId} onChange={(e) => setConvertForm((f) => ({ ...f, parentId: e.target.value }))} placeholder="Parent ID (optional)" className="rounded-lg border px-3 py-2 text-sm" />
                  <label className="col-span-full flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={convertForm.createUser} onChange={(e) => setConvertForm((f) => ({ ...f, createUser: e.target.checked }))} />
                    Create student login account
                  </label>
                  {convertForm.createUser && (
                    <>
                      <input value={convertForm.userEmail} onChange={(e) => setConvertForm((f) => ({ ...f, userEmail: e.target.value }))} placeholder="Login email" className="rounded-lg border px-3 py-2 text-sm" />
                      <input type="password" value={convertForm.userPassword} onChange={(e) => setConvertForm((f) => ({ ...f, userPassword: e.target.value }))} placeholder="Login password" className="rounded-lg border px-3 py-2 text-sm" />
                    </>
                  )}
                  <div className="col-span-full">
                    <button type="submit" disabled={detail.status !== "admitted"} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                      Convert to student
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}