import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "../contexts/AuthContext";
import { apiUrl } from "../lib/api";

type FeePayment = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
  dueDate: string;
  paidAt: string | null;
  feeStructure?: { id: string; name: string; grade: number | null };
};

type FinanceSummary = {
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  overdueCount: number;
};

type FinanceResponse = {
  payments: FeePayment[];
  summary: FinanceSummary;
};

export default function Fees() {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const studentId = user?.student?.id;
    if (!studentId) {
      setLoading(false);
      return;
    }

    fetch(apiUrl(`/api/finance/student/${studentId}`), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.data as FinanceResponse);
      })
      .finally(() => setLoading(false));
  }, [user?.student?.id]);

  if (loading) return <div className="text-slate-500">Loading fees...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold">Fees</h1>
      <p className="text-slate-500 text-sm">View your fee dues and payment status.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Due</p>
          <p className="text-xl font-semibold text-slate-900">₹{Number(data?.summary.totalDue ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-xl font-semibold text-green-700">₹{Number(data?.summary.totalPaid ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-xl font-semibold text-amber-700">₹{Number(data?.summary.totalPending ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Overdue Count</p>
          <p className="text-xl font-semibold text-red-700">{data?.summary.overdueCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">Fee Payments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data?.payments ?? []).length === 0 ? (
            <li className="text-slate-500">No fee records found.</li>
          ) : (
            (data?.payments ?? []).map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{item.feeStructure?.name ?? "Fee"}</span>
                  <span>₹{Number(item.amount).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                  <span className={item.status === "paid" ? "text-green-600" : item.status === "overdue" ? "text-red-600" : "text-amber-600"}>
                    {item.status}
                  </span>
                </div>
                {item.paidAt && <p className="mt-1 text-xs text-slate-500">Paid on: {new Date(item.paidAt).toLocaleDateString()}</p>}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
