import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function FeeStatus({ studentId }) {
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function loadFees() {
      const { data: feeData } = await supabase
        .from("fees")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      setFees(feeData || []);

      const { data: paymentData } = await supabase
        .from("fee_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false });

      setPayments(paymentData || []);
    }
    if (studentId) loadFees();
  }, [studentId]);

  return (
    <div className="dashboard-card">
      <h2>Fee Status</h2>
      <section>
        <h3>Fees</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <td>{fee.fee_title}</td>
                  <td>{fee.total_amount}</td>
                  <td>{fee.paid_amount}</td>
                  <td>{fee.due_amount}</td>
                  <td>{fee.status}</td>
                  <td>{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3>Payment History</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Amount</th>
                <th>Payment Date</th>
                <th>Mode</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{pay.amount}</td>
                  <td>{new Date(pay.payment_date).toLocaleDateString()}</td>
                  <td>{pay.payment_mode}</td>
                  <td>{pay.receipt_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
