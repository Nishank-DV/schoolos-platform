import { useEffect, useState } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Quiz = {
  id: string;
  title: string;
  maxMarks: number;
  dueDate: string | null;
  class: { name: string };
  subject: { name: string } | null;
  createdAt: string;
};

export default function Quizzes() {
  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/quizzes"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Quizzes</h1>
      <p className="text-slate-500 mt-1">Quiz engine – create and manage quizzes</p>
      <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        API-backed module. This screen currently lists quizzes; creation/edit UX can be layered in incrementally.
      </p>
      <div className="mt-6 space-y-3">
        {items.map((q) => (
          <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">{q.title}</h3>
              <p className="text-sm text-slate-500">{q.class.name} {q.subject && `· ${q.subject.name}`}</p>
              <p className="text-xs text-slate-400 mt-1">
                Max marks: {q.maxMarks} {q.dueDate && `· Due ${new Date(q.dueDate).toLocaleDateString()}`}
              </p>
            </div>
            <span className="text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">No quizzes yet. Create quizzes through the API endpoints to populate this list.</p>}
      </div>
    </div>
  );
}
