import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminFees({ profile }) {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    supabase
      .from("fees")
      .select("id,student_id,fee_title,total_amount,paid_amount,due_amount,status,due_date,students(full_name,roll_number)")
      .eq("school_id", schoolId)
      .order("due_date", { ascending: true })
      .then(({ data }) => {
        setFees(data || []);
      })
      .finally(() => setLoading(false));
  }, [schoolId]);

  const totals = fees.reduce(
    (acc, fee) => ({
      total: acc.total + Number(fee.total_amount || 0),
      paid: acc.paid + Number(fee.paid_amount || 0),
      due: acc.due + Number(fee.due_amount || 0),
    }),
    { total: 0, paid: 0, due: 0 }
  );

  return (
    <div>
      <h1>Fees Overview</h1>
      <section className="meta-grid" style={{ marginBottom: 16 }}>
        <article className="meta-tile"><span className="meta-label">Total</span><strong>₹ {totals.total.toFixed(2)}</strong></article>
        <article className="meta-tile"><span className="meta-label">Paid</span><strong>₹ {totals.paid.toFixed(2)}</strong></article>
        <article className="meta-tile"><span className="meta-label">Due</span><strong>₹ {totals.due.toFixed(2)}</strong></article>
      </section>
      <section className="dashboard-card">
        <h2>Fee Lines</h2>
        {loading ? <p>Loading fee records...</p> : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Student</th><th>Roll</th><th>Title</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th><th>Due Date</th><th>Created At</th></tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id}>
                    <td>{fee.students?.full_name || fee.student_id}</td>
                    <td>{fee.students?.roll_number || "-"}</td>
                    <td>{fee.fee_title}</td>
                    <td>{fee.total_amount}</td>
                    <td>{fee.paid_amount}</td>
                    <td>{fee.due_amount}</td>
                    <td>{fee.status}</td>
                    <td>{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : "-"}</td>
                    <td>{fee.created_at ? new Date(fee.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
