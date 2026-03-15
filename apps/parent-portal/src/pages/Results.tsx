import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type StudentResult = {
  id: string;
  examId: string;
  totalMarks: number;
  percentage: number;
  gpa: number;
  rank: number | null;
  exam: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    class: { id: string; name: string; grade: number };
    academicYear: { id: string; name: string; isActive: boolean };
  };
};

type ReportCard = {
  school: { id: string; name: string; code: string };
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    grade: number;
    section: string | null;
  };
  exam: { id: string; name: string; startDate: string; endDate: string; status: string };
  subjects: Array<{
    examSubjectId: string;
    subject: { id: string; name: string; code: string | null };
    maxMarks: number;
    passMarks: number;
    marksObtained: number | null;
    grade: string | null;
    remarks: string | null;
  }>;
  totals: {
    totalMarks: number;
    totalMaxMarks: number;
    percentage: number;
    gpa: number;
    grade: string;
    rank: number | null;
  };
};

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(apiUrl(`/api/results/student/${id}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const items = (d.data ?? []) as StudentResult[];
          setResults(items);
          if (items[0]) setSelectedExamId(items[0].examId);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !selectedExamId) {
      setReportCard(null);
      return;
    }
    fetch(apiUrl(`/api/report-card/${id}/${selectedExamId}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReportCard(d.data as ReportCard);
      })
      .catch(() => setReportCard(null));
  }, [id, selectedExamId]);

  if (loading) return <div className="text-slate-500">Loading results...</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Exam Results</h1>
        {id && <Link to={`/child/${id}`} className="text-xs text-primary-700 hover:underline">Back to Child Profile</Link>}
      </div>
      <p className="text-slate-500 text-sm">Exam performance, grades, and report-card summary.</p>

      {results.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No exam results available yet.</div>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <label className="text-sm text-slate-600">Select Exam</label>
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm">
              {results.map((item) => (
                <option key={item.id} value={item.examId}>
                  {item.exam.name} ({new Date(item.exam.startDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {reportCard && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Percentage</p>
                  <p className="text-xl font-semibold text-slate-900">{reportCard.totals.percentage.toFixed(2)}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">Grade / Rank</p>
                  <p className="text-xl font-semibold text-slate-900">{reportCard.totals.grade}{reportCard.totals.rank ? ` / #${reportCard.totals.rank}` : ""}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="font-medium text-slate-900">Subject-wise Marks</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {reportCard.subjects.map((item) => (
                    <li key={item.examSubjectId} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.subject.name}</span>
                        <span>{item.marksObtained ?? "-"}/{item.maxMarks}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>Grade: {item.grade ?? "-"}</span>
                        <span>Pass Marks: {item.passMarks}</span>
                      </div>
                      {item.remarks && <p className="mt-1 text-xs text-slate-600">Remarks: {item.remarks}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
