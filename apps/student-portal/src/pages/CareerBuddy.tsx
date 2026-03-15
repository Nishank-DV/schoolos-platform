import { useEffect, useState, useRef } from "react";
import { getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type Profile = {
  id: string;
  parentalConsent: boolean;
  favoriteSubjects: string[];
  hobbies: string[];
  assessmentSessions?: { id: string; status: string }[];
};

type CareerRec = {
  career: string;
  category: string;
  details?: { overview?: string; skillsRequired?: string; educationPath?: string; futureDemand?: string };
};

type ReportData = {
  streamRecommendation: string | null;
  alternateStreams?: string[] | null;
  interestProfile: string | null;
  personalityIndicators?: string[] | null;
  aptitudeIndicators?: string[] | null;
  skillDevelopmentSuggestions: string | null;
  summary: string | null;
  careerProfile?: {
    student?: { firstName?: string; lastName?: string; grade?: number; school?: { name: string } };
    careerRecommendations: CareerRec[];
  };
};

export default function CareerBuddy() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ id: string; question: string; options: string[] } | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(apiUrl("/api/careerbuddy/profile"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProfile(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function startAssessment() {
    setError("");
    setStarting(true);
    try {
      const res = await fetch(apiUrl("/api/careerbuddy/sessions"), { method: "POST", headers: getAuthHeaders(), body: "{}" });
      const d = await res.json();
      if (!d.success) {
        setError(d.error || "Failed to start assessment");
        return;
      }
      setSessionId(d.data.id);
      setReport(null);
      fetchNextQuestion(d.data.id);
    } catch {
      setError("Failed to start assessment");
    } finally {
      setStarting(false);
    }
  }

  function fetchNextQuestion(sid: string) {
    setError("");
    fetch(apiUrl(`/api/careerbuddy/sessions/${sid}/next-question`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setError(d.error || "Failed to fetch next question");
          return;
        }
        if (d.data?.completed) {
          completeSession(sid);
          return;
        }
        setQuestion(d.data?.question ?? null);
      });
  }

  async function submitAnswer() {
    if (!sessionId || !question || !answer) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/careerbuddy/sessions/${sessionId}/respond`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to save answer");
        return;
      }
      setAnswer("");
      fetchNextQuestion(sessionId);
    } catch {
      setError("Failed to save answer");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeSession(sid: string) {
    setError("");
    const res = await fetch(apiUrl(`/api/careerbuddy/sessions/${sid}/complete`), { method: "POST", headers: getAuthHeaders(), body: "{}" });
    const d = await res.json();
    if (d.success) {
      setSessionId(null);
      setQuestion(null);
      const rep = d.data?.careerProfile?.careerReports?.[0];
      if (rep) {
        setReport({
          streamRecommendation: rep.streamRecommendation ?? null,
          alternateStreams: rep.alternateStreams ?? null,
          interestProfile: rep.interestProfile ?? null,
          personalityIndicators: rep.personalityIndicators ?? null,
          aptitudeIndicators: rep.aptitudeIndicators ?? null,
          skillDevelopmentSuggestions: rep.skillDevelopmentSuggestions ?? null,
          summary: rep.summary ?? null,
          careerProfile: d.data?.careerProfile,
        });
      }
    } else {
      setError(d.error || "Failed to complete session");
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;

  if (report) {
    const recs = report.careerProfile?.careerRecommendations ?? [];
    const topCareers = recs.filter((r) => r.category === "top");
    const alternateCareers = recs.filter((r) => r.category === "alternate");
    const studentName = report.careerProfile?.student
      ? `${report.careerProfile.student.firstName ?? ""} ${report.careerProfile.student.lastName ?? ""}`.trim()
      : "Student";
    const grade = report.careerProfile?.student?.grade;
    const schoolName = report.careerProfile?.student?.school?.name;

    return (
      <div ref={reportRef} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold">CareerBuddy Report</h1>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-slate-700 text-white px-4 py-2 text-sm print:hidden"
          >
            Download / Print PDF
          </button>
        </div>
        <p className="text-slate-500 text-sm print:block">
          {studentName}{grade ? ` · Grade ${grade}` : ""}{schoolName ? ` · ${schoolName}` : ""}
        </p>

        {/* PRD §5.5 Report sections */}
        {report.interestProfile && (
          <section className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold text-slate-900 mb-2">Student Interest Profile</h2>
            <p className="text-sm text-slate-700">{report.interestProfile}</p>
          </section>
        )}

        {(report.personalityIndicators?.length ?? 0) > 0 && (
          <section className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold text-slate-900 mb-2">Personality Indicators</h2>
            <ul className="flex flex-wrap gap-2">
              {report.personalityIndicators!.map((p, i) => (
                <li key={i} className="px-2 py-1 rounded bg-slate-100 text-sm">{p}</li>
              ))}
            </ul>
          </section>
        )}

        {(report.aptitudeIndicators?.length ?? 0) > 0 && (
          <section className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold text-slate-900 mb-2">Aptitude Indicators</h2>
            <ul className="flex flex-wrap gap-2">
              {report.aptitudeIndicators!.map((a, i) => (
                <li key={i} className="px-2 py-1 rounded bg-blue-50 text-sm">{a}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border p-4 bg-white">
          <h2 className="font-semibold text-slate-900 mb-2">Top Career Recommendations</h2>
          <ul className="space-y-3">
            {topCareers.map((r, i) => (
              <li key={i} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="font-medium text-slate-900">{r.career}</p>
                {r.details?.overview && <p className="text-sm text-slate-600 mt-0.5">{r.details.overview}</p>}
                {r.details?.skillsRequired && <p className="text-xs text-slate-500 mt-1">Skills: {r.details.skillsRequired}</p>}
                {r.details?.educationPath && <p className="text-xs text-slate-500">Education: {r.details.educationPath}</p>}
                {r.details?.futureDemand && <p className="text-xs text-slate-500">Demand: {r.details.futureDemand}</p>}
              </li>
            ))}
          </ul>
        </section>

        {alternateCareers.length > 0 && (
          <section className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold text-slate-900 mb-2">Alternate Careers</h2>
            <ul className="list-disc list-inside text-sm text-slate-700">
              {alternateCareers.map((r, i) => (
                <li key={i}>{r.career}{r.details?.overview ? ` — ${r.details.overview}` : ""}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border p-4 bg-emerald-50">
          <h2 className="font-semibold text-slate-900 mb-2">Suggested Academic Streams</h2>
          <p className="text-sm font-medium text-slate-800">Recommended: {report.streamRecommendation ?? "—"}</p>
          {report.alternateStreams?.length ? (
            <p className="text-sm text-slate-600 mt-1">Alternates: {report.alternateStreams.join(", ")}</p>
          ) : null}
        </section>

        {report.skillDevelopmentSuggestions && (
          <section className="rounded-xl border p-4 bg-amber-50">
            <h2 className="font-semibold text-slate-900 mb-2">Skill Development Suggestions</h2>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              {report.skillDevelopmentSuggestions.split("\n").filter(Boolean).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {report.summary && (
          <p className="text-sm text-slate-600 italic">{report.summary}</p>
        )}

        <button
          type="button"
          onClick={() => setReport(null)}
          className="text-blue-600 text-sm print:hidden"
        >
          Start new assessment
        </button>
      </div>
    );
  }

  if (question && sessionId) {
    return (
      <div>
        <h1 className="text-xl font-bold">CareerBuddy Assessment</h1>
        <p className="text-slate-500 text-sm mt-1">Answer to get personalized career suggestions</p>
        <div className="mt-4 rounded-xl border p-4 bg-white">
          <p className="font-medium mb-3">{question.question}</p>
          <div className="space-y-2">
            {question.options.map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input type="radio" name="answer" value={opt} checked={answer === opt} onChange={() => setAnswer(opt)} />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={submitAnswer} disabled={!answer || submitting} className="mt-4 w-full rounded-lg bg-blue-600 text-white py-2 disabled:opacity-50">
            {submitting ? "Saving..." : "Next"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold">CareerBuddy</h1>
      <p className="text-slate-500 text-sm">AI career discovery for Grade 9 & 10. Explore interests, personality, and aptitudes to discover careers and streams.</p>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!profile?.parentalConsent ? (
        <p className="mt-4 text-amber-700 bg-amber-50 p-3 rounded-lg text-sm">Parental consent is required to take the assessment. Please get consent and update your profile.</p>
      ) : (
        <div className="mt-4">
          {(profile.assessmentSessions?.length ?? 0) > 0 && (
            <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Previous sessions found. Starting a new session will generate a fresh report.</p>
          )}
          <button type="button" onClick={startAssessment} disabled={starting} className="w-full rounded-xl bg-emerald-600 text-white py-3 font-medium disabled:opacity-60">
            {starting ? "Starting..." : "Start career assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
