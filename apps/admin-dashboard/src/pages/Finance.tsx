import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../contexts/ToastContext";

type Tab = "structures" | "payments" | "reports";

type FeeStructure = {
  id: string;
  name: string;
  amount: number;
  grade: number | null;
  installments: number;
  lateFeePercent: number | null;
  discountPercent: number | null;
  _count?: { payments: number };
};

type Payment = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
  dueDate: string;
  paidAt: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; grade: number };
  feeStructure: { id: string; name: string; grade: number | null };
};

type Student = { id: string; firstName: string; lastName: string; admissionNumber: string; grade: number };
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

type Overview = {
  totalExpected: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  overdueCount: number;
};

type GradeReport = {
  summary: {
    grade: number;
    paymentCount: number;
    totalExpected: number;
    totalCollected: number;
    totalPending: number;
    totalOverdue: number;
    overdueCount: number;
  };
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "structures", label: "Fee Structures" },
  { id: "payments", label: "Fee Payments" },
  { id: "reports", label: "Reports" },
];

export default function Finance() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("structures");
  const [loading, setLoading] = useState(true);

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [gradeReport, setGradeReport] = useState<GradeReport | null>(null);

  const [structureGradeFilter, setStructureGradeFilter] = useState<number | "">("");
  const [paymentStudentFilter, setPaymentStudentFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"" | "pending" | "paid" | "overdue">("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [reportGrade, setReportGrade] = useState(9);

  const [newStructure, setNewStructure] = useState({
    name: "",
    amount: 0,
    grade: "" as number | "",
    installments: 1,
    lateFeePercent: "" as number | "",
    discountPercent: "" as number | "",
  });

  const [assignForm, setAssignForm] = useState({
    feeStructureId: "",
    studentId: "",
    studentIdsCsv: "",
    firstDueDate: new Date().toISOString().slice(0, 10),
    intervalDays: 30,
    notes: "",
  });

  async function loadStructures() {
    const q = new URLSearchParams({ page: "1", pageSize: "100" });
    if (structureGradeFilter !== "") q.set("grade", String(structureGradeFilter));
    const data = await apiGet<Paged<FeeStructure>>(`/api/finance/structures?${q.toString()}`);
    setStructures(data.items ?? []);
  }

  async function loadPayments() {
    const q = new URLSearchParams({ page: "1", pageSize: "100" });
    if (paymentStudentFilter) q.set("studentId", paymentStudentFilter);
    if (paymentStatusFilter) q.set("status", paymentStatusFilter);
    if (dueFrom) q.set("dueFrom", dueFrom);
    if (dueTo) q.set("dueTo", dueTo);
    const data = await apiGet<Paged<Payment>>(`/api/finance/payments?${q.toString()}`);
    setPayments(data.items ?? []);
  }

  async function loadStudents() {
    const data = await apiGet<Paged<Student>>("/api/students?page=1&pageSize=100");
    setStudents(data.items ?? []);
  }

  async function loadOverview() {
    const data = await apiGet<Overview>("/api/finance/report/overview");
    setOverview(data);
  }

  async function loadGradeReport(grade: number) {
    const data = await apiGet<GradeReport>(`/api/finance/report/grade/${grade}`);
    setGradeReport(data);
  }

  useEffect(() => {
    Promise.all([loadStructures(), loadPayments(), loadStudents(), loadOverview(), loadGradeReport(reportGrade)])
      .catch((error) => {
        addToast(error instanceof Error ? error.message : "Failed to load finance data", "error");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStructures().catch((error) => addToast(error instanceof Error ? error.message : "Failed to load structures", "error"));
  }, [structureGradeFilter]);

  async function createStructure(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/finance/structures", {
        name: newStructure.name,
        amount: Number(newStructure.amount),
        grade: newStructure.grade === "" ? null : Number(newStructure.grade),
        installments: Number(newStructure.installments || 1),
        lateFeePercent: newStructure.lateFeePercent === "" ? null : Number(newStructure.lateFeePercent),
        discountPercent: newStructure.discountPercent === "" ? null : Number(newStructure.discountPercent),
      });
      addToast("Fee structure created", "success");
      setNewStructure({ name: "", amount: 0, grade: "", installments: 1, lateFeePercent: "", discountPercent: "" });
      await loadStructures();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to create fee structure", "error");
    }
  }

  async function updateStructure(structure: FeeStructure) {
    try {
      await apiPatch(`/api/finance/structures/${structure.id}`, {
        name: structure.name,
        amount: Number(structure.amount),
        grade: structure.grade,
        installments: Number(structure.installments),
        lateFeePercent: structure.lateFeePercent,
        discountPercent: structure.discountPercent,
      });
      addToast("Fee structure updated", "success");
      await loadStructures();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update fee structure", "error");
    }
  }

  async function deleteStructure(id: string) {
    if (!confirm("Delete this fee structure?")) return;
    try {
      await apiDelete(`/api/finance/structures/${id}`);
      addToast("Fee structure deleted", "success");
      await loadStructures();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to delete fee structure", "error");
    }
  }

  async function assignFees(e: React.FormEvent) {
    e.preventDefault();
    try {
      const studentIds = assignForm.studentIdsCsv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await apiPost("/api/finance/assign", {
        feeStructureId: assignForm.feeStructureId,
        studentId: assignForm.studentId || undefined,
        studentIds: studentIds.length ? studentIds : undefined,
        firstDueDate: assignForm.firstDueDate,
        intervalDays: Number(assignForm.intervalDays || 30),
        notes: assignForm.notes || undefined,
      });
      addToast("Fees assigned", "success");
      await loadPayments();
      await loadOverview();
      await loadGradeReport(reportGrade);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to assign fees", "error");
    }
  }

  async function markPaid(paymentId: string) {
    try {
      await apiPost(`/api/finance/payments/${paymentId}/pay`, {});
      addToast("Payment marked as paid", "success");
      await loadPayments();
      await loadOverview();
      await loadGradeReport(reportGrade);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to mark payment", "error");
    }
  }

  function resetPaymentFilters() {
    setPaymentStudentFilter("");
    setPaymentStatusFilter("");
    setDueFrom("");
    setDueTo("");
  }

  if (loading) {
    return <div className="text-slate-500">Loading finance data...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
      <p className="mt-1 text-slate-500">Manage fee structures, assign dues, record payments, and review finance reports.</p>

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

      {activeTab === "structures" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <form onSubmit={createStructure} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Create Fee Structure</h2>
            <input value={newStructure.name} onChange={(e) => setNewStructure((s) => ({ ...s, name: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Structure name" required />
            <input type="number" value={newStructure.amount} onChange={(e) => setNewStructure((s) => ({ ...s, amount: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={1} placeholder="Amount" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="number" value={newStructure.grade} onChange={(e) => setNewStructure((s) => ({ ...s, grade: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={1} max={12} placeholder="Grade (optional)" />
              <input type="number" value={newStructure.installments} onChange={(e) => setNewStructure((s) => ({ ...s, installments: Number(e.target.value) }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={1} max={24} placeholder="Installments" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="number" value={newStructure.lateFeePercent} onChange={(e) => setNewStructure((s) => ({ ...s, lateFeePercent: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={0} max={100} placeholder="Late fee %" />
              <input type="number" value={newStructure.discountPercent} onChange={(e) => setNewStructure((s) => ({ ...s, discountPercent: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-lg border px-3 py-2 text-sm" min={0} max={100} placeholder="Discount %" />
            </div>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Create Structure</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Fee Structures</h2>
              <input type="number" value={structureGradeFilter} onChange={(e) => setStructureGradeFilter(e.target.value ? Number(e.target.value) : "")} min={1} max={12} placeholder="Filter grade" className="w-32 rounded border px-2 py-1 text-xs" />
            </div>
            <div className="mt-3 space-y-2">
              {structures.length === 0 && <p className="text-sm text-slate-500">No fee structures available.</p>}
              {structures.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <input value={item.name} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, name: e.target.value } : s))} className="rounded border px-2 py-1 text-sm" />
                    <input type="number" value={Number(item.amount)} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, amount: Number(e.target.value) } : s))} className="rounded border px-2 py-1 text-sm" min={1} />
                    <input type="number" value={item.grade ?? ""} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, grade: e.target.value ? Number(e.target.value) : null } : s))} className="rounded border px-2 py-1 text-sm" min={1} max={12} placeholder="Grade" />
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input type="number" value={item.installments} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, installments: Number(e.target.value) } : s))} className="rounded border px-2 py-1 text-sm" min={1} max={24} />
                    <input type="number" value={item.lateFeePercent ?? ""} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, lateFeePercent: e.target.value ? Number(e.target.value) : null } : s))} className="rounded border px-2 py-1 text-sm" min={0} max={100} placeholder="Late fee %" />
                    <input type="number" value={item.discountPercent ?? ""} onChange={(e) => setStructures((prev) => prev.map((s) => s.id === item.id ? { ...s, discountPercent: e.target.value ? Number(e.target.value) : null } : s))} className="rounded border px-2 py-1 text-sm" min={0} max={100} placeholder="Discount %" />
                    <div className="text-xs text-slate-500 flex items-center">Payments: {item._count?.payments ?? 0}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateStructure(item)} className="rounded border px-2 py-1 text-xs">Update</button>
                    <button type="button" onClick={() => deleteStructure(item.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="mt-6 space-y-4">
          <form onSubmit={assignFees} className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">Assign Fees</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <select value={assignForm.feeStructureId} onChange={(e) => setAssignForm((f) => ({ ...f, feeStructureId: e.target.value }))} className="rounded border px-2 py-2 text-sm" required>
                <option value="">Select structure</option>
                {structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={assignForm.studentId} onChange={(e) => setAssignForm((f) => ({ ...f, studentId: e.target.value }))} className="rounded border px-2 py-2 text-sm">
                <option value="">Single student (optional)</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber} - {s.firstName} {s.lastName}</option>)}
              </select>
              <input type="date" value={assignForm.firstDueDate} onChange={(e) => setAssignForm((f) => ({ ...f, firstDueDate: e.target.value }))} className="rounded border px-2 py-2 text-sm" required />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <input value={assignForm.studentIdsCsv} onChange={(e) => setAssignForm((f) => ({ ...f, studentIdsCsv: e.target.value }))} className="rounded border px-2 py-2 text-sm" placeholder="Batch IDs (comma-separated, optional)" />
              <input type="number" value={assignForm.intervalDays} onChange={(e) => setAssignForm((f) => ({ ...f, intervalDays: Number(e.target.value) }))} className="rounded border px-2 py-2 text-sm" min={1} max={365} placeholder="Interval days" />
              <input value={assignForm.notes} onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))} className="rounded border px-2 py-2 text-sm" placeholder="Notes (optional)" />
            </div>
            <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white">Assign Fees</button>
          </form>

          <div className="rounded-xl border bg-white p-4">
            <div className="grid gap-2 md:grid-cols-5">
              <select value={paymentStudentFilter} onChange={(e) => setPaymentStudentFilter(e.target.value)} className="rounded border px-2 py-2 text-sm">
                <option value="">All students</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.admissionNumber}</option>)}
              </select>
              <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value as "" | "pending" | "paid" | "overdue")} className="rounded border px-2 py-2 text-sm">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
              <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="rounded border px-2 py-2 text-sm" />
              <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="rounded border px-2 py-2 text-sm" />
              <button type="button" onClick={() => loadPayments().catch((error) => addToast(error instanceof Error ? error.message : "Failed to load payments", "error"))} className="rounded border px-2 py-2 text-sm">Apply Filters</button>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  resetPaymentFilters();
                  loadPayments().catch((error) => addToast(error instanceof Error ? error.message : "Failed to load payments", "error"));
                }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Reset filters
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Structure</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Paid At</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{p.student.admissionNumber} - {p.student.firstName} {p.student.lastName}</td>
                      <td className="px-2 py-2">{p.feeStructure.name}</td>
                      <td className="px-2 py-2">₹{Number(p.amount).toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${p.status === "paid" ? "bg-green-100 text-green-700" : p.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">{new Date(p.dueDate).toLocaleDateString()}</td>
                      <td className="px-2 py-2">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "-"}</td>
                      <td className="px-2 py-2">
                        {p.status !== "paid" ? (
                          <button type="button" onClick={() => markPaid(p.id)} className="rounded border px-2 py-1 text-xs">Mark Paid</button>
                        ) : (
                          <span className="text-xs text-slate-400">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No fee payments match the selected filters.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Total Expected</p><p className="text-xl font-semibold">₹{Number(overview?.totalExpected ?? 0).toFixed(2)}</p></div>
            <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Collected</p><p className="text-xl font-semibold text-green-700">₹{Number(overview?.totalCollected ?? 0).toFixed(2)}</p></div>
            <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-xl font-semibold text-amber-700">₹{Number(overview?.totalPending ?? 0).toFixed(2)}</p></div>
            <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Overdue</p><p className="text-xl font-semibold text-red-700">₹{Number(overview?.totalOverdue ?? 0).toFixed(2)} ({overview?.overdueCount ?? 0})</p></div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2">
              <input type="number" value={reportGrade} onChange={(e) => setReportGrade(Number(e.target.value))} className="w-28 rounded border px-2 py-2 text-sm" min={1} max={12} />
              <button type="button" onClick={() => loadGradeReport(reportGrade).catch((error) => addToast(error instanceof Error ? error.message : "Failed to load grade report", "error"))} className="rounded border px-3 py-2 text-sm">Load Grade Report</button>
            </div>
            <div className="mt-3 text-sm text-slate-700">
              <p>Grade: {gradeReport?.summary.grade ?? reportGrade}</p>
              <p>Payments: {gradeReport?.summary.paymentCount ?? 0}</p>
              <p>Expected: ₹{Number(gradeReport?.summary.totalExpected ?? 0).toFixed(2)}</p>
              <p>Collected: ₹{Number(gradeReport?.summary.totalCollected ?? 0).toFixed(2)}</p>
              <p>Pending: ₹{Number(gradeReport?.summary.totalPending ?? 0).toFixed(2)}</p>
              <p>Overdue: ₹{Number(gradeReport?.summary.totalOverdue ?? 0).toFixed(2)} ({gradeReport?.summary.overdueCount ?? 0})</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
