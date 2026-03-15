import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../lib/api";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  subject: { name: string };
  teacher: { firstName: string; lastName: string };
  attachments: Array<{ id: string; fileUrl: string; fileName: string }>;
};

type Submission = {
  id: string;
  fileUrl: string | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
};

type AssignmentWithSubmission = Assignment & { submission?: Submission };

export default function Assignments() {
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitForm, setSubmitForm] = useState({ fileUrl: "" });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const getHeaders = (includeAuth = true) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (includeAuth) {
      const token = localStorage.getItem("token");
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  async function loadAssignments() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(apiUrl("/api/assignments?page=1&pageSize=100"), {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments(data.data.items ?? []);
      } else {
        setError(data.error || "Failed to load assignments");
      }
    } catch (error) {
      setError("Failed to load assignments");
      console.error("Failed to load assignments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent, assignmentId: string) {
    e.preventDefault();
    try {
      setSubmitting(assignmentId);
      setError("");
      const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/submit`), {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ fileUrl: submitForm.fileUrl || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitForm({ fileUrl: "" });
        setSelectedAssignmentId(null);
        await loadAssignments();
      } else {
        setError(data.error || "Failed to submit assignment");
      }
    } catch (error) {
      setError("Failed to submit assignment");
      console.error(error);
    } finally {
      setSubmitting(null);
    }
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, AssignmentWithSubmission[]> = {
      pending: [],
      submitted: [],
      graded: [],
      overdue: [],
    };

    const now = new Date();
    assignments.forEach((a) => {
      const dueDate = new Date(a.dueDate);
      const isOverdue = dueDate < now && !a.submission;

      if (isOverdue) {
        groups.overdue.push(a);
      } else if (a.submission?.grade !== null && a.submission?.grade !== undefined) {
        groups.graded.push(a);
      } else if (a.submission?.submittedAt) {
        groups.submitted.push(a);
      } else {
        groups.pending.push(a);
      }
    });

    return groups;
  }, [assignments]);

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold">Assignments</h1>
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  const renderAssignmentCard = (a: AssignmentWithSubmission, status: string) => (
    <div key={a.id} className="rounded-xl border border-slate-200 p-4 bg-white hover:shadow-md transition">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{a.title}</h3>
          <p className="text-sm text-slate-600">
            {a.subject.name} • {a.teacher.firstName} {a.teacher.lastName}
          </p>
          {a.description && (
            <p className="text-sm text-slate-500 mt-2">{a.description}</p>
          )}
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
            <span>Max marks: {a.maxMarks}</span>
          </div>
        </div>
        <div className="text-right">
          {status === "graded" && (
            <div className="text-lg font-bold text-green-600">
              {a.submission?.grade}/{a.maxMarks}
            </div>
          )}
          {status === "submitted" && (
            <span className="inline-block px-2 py-1 rounded-lg bg-blue-100 text-xs text-blue-700">
              Submitted
            </span>
          )}
          {status === "overdue" && (
            <span className="inline-block px-2 py-1 rounded-lg bg-red-100 text-xs text-red-700">
              Overdue
            </span>
          )}
          {status === "pending" && (
            <span className="inline-block px-2 py-1 rounded-lg bg-yellow-100 text-xs text-yellow-700">
              Pending
            </span>
          )}
        </div>
      </div>

      {a.attachments.length > 0 && (
        <div className="mt-3 space-y-1">
          {a.attachments.map((att) => (
            <a
              key={att.id}
              href={att.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 block"
            >
              📎 {att.fileName}
            </a>
          ))}
        </div>
      )}

      {a.submission?.feedback && (
        <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-700">
          <p className="font-medium">Feedback:</p>
          <p>{a.submission.feedback}</p>
        </div>
      )}

      {status === "pending" && (
        <>
          {selectedAssignmentId === a.id ? (
            <form onSubmit={(e) => handleSubmit(e, a.id)} className="mt-3 space-y-2">
              <input
                type="url"
                value={submitForm.fileUrl}
                onChange={(e) => setSubmitForm({ fileUrl: e.target.value })}
                placeholder="File URL (optional)"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting === a.id}
                  className="flex-1 rounded-lg bg-primary-600 text-white py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting === a.id ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentId(null)}
                  className="flex-1 rounded-lg border text-slate-700 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedAssignmentId(a.id)}
              className="mt-3 w-full rounded-lg bg-primary-600 text-white py-2 text-sm font-medium hover:bg-primary-700"
            >
              Submit Assignment
            </button>
          )}
        </>
      )}

      {status === "submitted" && (
        <p className="mt-3 text-xs text-slate-600">
          Submitted on {a.submission?.submittedAt ? new Date(a.submission.submittedAt).toLocaleDateString() : "-"}
        </p>
      )}
    </div>
  );

  return (
    <div>
      <h1 className="text-xl font-bold">Assignments</h1>
      <p className="text-slate-500 text-sm">View and submit your homework</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {grouped.overdue.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-red-700 mb-3">Overdue ({grouped.overdue.length})</h2>
          <div className="space-y-3 mb-6">
            {grouped.overdue.map((a) => renderAssignmentCard(a, "overdue"))}
          </div>
        </div>
      )}

      {grouped.pending.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-yellow-700 mb-3">Pending ({grouped.pending.length})</h2>
          <div className="space-y-3 mb-6">
            {grouped.pending.map((a) => renderAssignmentCard(a, "pending"))}
          </div>
        </div>
      )}

      {grouped.submitted.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-blue-700 mb-3">Submitted ({grouped.submitted.length})</h2>
          <div className="space-y-3 mb-6">
            {grouped.submitted.map((a) => renderAssignmentCard(a, "submitted"))}
          </div>
        </div>
      )}

      {grouped.graded.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-green-700 mb-3">Graded ({grouped.graded.length})</h2>
          <div className="space-y-3">
            {grouped.graded.map((a) => renderAssignmentCard(a, "graded"))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="mt-6 text-center text-slate-500">
          <p>No assignments yet. Your teacher-published work will appear here.</p>
        </div>
      )}
    </div>
  );
}
