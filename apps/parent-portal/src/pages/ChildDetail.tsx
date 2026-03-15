import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  class?: { name: string };
};

type AttendanceRow = { date: string; status: string };
type GradeRow = { subject: { name: string }; term: string; marks: number; maxMarks: number };
type PaymentRow = { id: string; amount: string; status: string; dueDate: string; feeStructure?: { name: string } };
type FinanceSummary = { totalDue: number; totalPaid: number; totalPending: number; overdueCount: number };
type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  subject: { name: string };
  teacher: { firstName: string; lastName: string };
};
type SubmissionRow = {
  id: string;
  studentId: string;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
};
type CareerReportType = {
  streamRecommendation: string | null;
  alternateStreams?: string[] | null;
  interestProfile?: string | null;
  skillDevelopmentSuggestions?: string | null;
  careerProfile?: { careerRecommendations: { career: string; category: string }[] };
};

export default function ChildDetail() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, SubmissionRow>>({});
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [careerReport, setCareerReport] = useState<CareerReportType | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadingStudent(true);
    fetch(apiUrl(`/api/students/${id}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStudent(d.data);
        else setError(d.error || "Unable to load child details");
      })
      .catch(() => setError("Unable to load child details"))
      .finally(() => setLoadingStudent(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(apiUrl(`/api/attendance/student/${id}`), { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(apiUrl(`/api/grades/student/${id}`), { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(apiUrl(`/api/finance/student/${id}`), { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(apiUrl("/api/assignments?page=1&pageSize=100"), { headers: getAuthHeaders() }).then((r) => r.json()),
      fetch(apiUrl(`/api/careerbuddy/reports/student/${id}`), { headers: getAuthHeaders() }).then((r) => r.json()),
    ]).then(([aRes, gRes, fRes, asRes, cRes]) => {
      if (aRes.success) setAttendance(aRes.data.slice(0, 10));
      if (gRes.success) setGrades(gRes.data);
      if (fRes.success) {
        setPayments((fRes.data.payments || []).slice(0, 5));
        setFinanceSummary(fRes.data.summary ?? null);
      }
      if (asRes.success) {
        const all = asRes.data.items || [];
        setAssignments(all.slice(0, 5));
        // Map submissions by assignment ID
        const subMap: Record<string, SubmissionRow> = {};
        all.forEach((a: AssignmentRow & { submissions?: SubmissionRow[] }) => {
          if (a.submissions?.[0]) {
            subMap[a.id] = a.submissions[0];
          }
        });
        setSubmissions(subMap);
      }
      if (cRes.success && cRes.data) setCareerReport(cRes.data);
    });
  }, [id]);

  if (loadingStudent) return <div className="text-slate-500">Loading child profile...</div>;
  if (!student) return <div className="text-slate-500">{error || "Student not found"}</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{student.firstName} {student.lastName}</h1>
        <Link to={`/child/${id}/results`} className="text-xs text-primary-700 hover:underline">View Exam Results</Link>
      </div>
      <p className="text-slate-500 text-sm">Grade {student.grade} · {student.class?.name ?? "-"}</p>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Recent attendance</h2>
          <Link to={`/child/${id}/attendance`} className="text-xs text-primary-700 hover:underline">View full report</Link>
        </div>
        <ul className="space-y-1 text-sm">
          {attendance.length === 0 ? <li className="text-slate-500">No records</li> : attendance.map((a) => (
            <li key={a.date} className="flex justify-between">
              <span>{new Date(a.date).toLocaleDateString()}</span>
              <span className={a.status === "present" ? "text-green-600" : "text-amber-600"}>{a.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Grades</h2>
        <ul className="space-y-1 text-sm">
          {grades.length === 0 ? <li className="text-slate-500">No grades</li> : grades.map((g, i) => (
            <li key={i} className="flex justify-between">
              <span>{g.subject.name} ({g.term})</span>
              <span>{g.marks}/{g.maxMarks}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Assignments</h2>
        <ul className="space-y-2 text-sm">
          {assignments.length === 0 ? (
            <li className="text-slate-500">No assignments</li>
          ) : (
            assignments.map((a) => {
              const submission = submissions[a.id];
              return (
                <li key={a.id} className="p-2 rounded border border-slate-200 bg-slate-50">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-600">{a.subject.name}</p>
                    </div>
                    <div className="text-right text-xs">
                      {submission?.grade !== null && submission?.grade !== undefined ? (
                        <span className="font-medium text-green-600">{submission.grade}/{a.maxMarks}</span>
                      ) : submission?.submittedAt ? (
                        <span className="text-blue-600">Submitted</span>
                      ) : (
                        <span className="text-yellow-600">Pending</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-slate-500 mt-1">
                    <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                  </div>
                  {submission?.feedback && (
                    <p className="text-xs text-slate-600 mt-1 italic">Feedback: {submission.feedback}</p>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Fees</h2>
        {financeSummary && (
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Due: {financeSummary.totalDue.toFixed(2)}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Paid: {financeSummary.totalPaid.toFixed(2)}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Pending: {financeSummary.totalPending.toFixed(2)}</div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">Overdue: {financeSummary.overdueCount}</div>
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {payments.length === 0 ? <li className="text-slate-500">No payments</li> : payments.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.feeStructure?.name ?? "Fee"} · {new Date(p.dueDate).toLocaleDateString()}</span>
              <span className={p.status === "paid" ? "text-green-600" : p.status === "overdue" ? "text-red-600" : "text-amber-600"}>{p.status}</span>
            </li>
          ))}
        </ul>
      </section>

      {careerReport && (student?.grade === 9 || student?.grade === 10) && (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <h2 className="font-medium mb-2">CareerBuddy report</h2>
          <p className="text-sm text-slate-700 mb-1">
            <strong>Recommended stream:</strong> {careerReport.streamRecommendation ?? "—"}
          </p>
          {careerReport.alternateStreams?.length ? (
            <p className="text-sm text-slate-600">Alternate streams: {careerReport.alternateStreams.join(", ")}</p>
          ) : null}
          {careerReport.careerProfile?.careerRecommendations?.length ? (
            <p className="text-sm text-slate-600 mt-2">
              Top careers: {careerReport.careerProfile.careerRecommendations.filter((r: { category: string }) => r.category === "top").slice(0, 5).map((r: { career: string }) => r.career).join(", ")}
            </p>
          ) : null}
          {careerReport.skillDevelopmentSuggestions ? (
            <p className="text-xs text-slate-500 mt-2 whitespace-pre-line">{careerReport.skillDevelopmentSuggestions}</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
