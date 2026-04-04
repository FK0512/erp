import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AccountantDashboard({ profile }) {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [selectedFee, setSelectedFee] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [editingFee, setEditingFee] = useState(null);
  const [creatingFee, setCreatingFee] = useState(false);
  const [newFee, setNewFee] = useState({ student_id: "", fee_title: "", total_amount: "", due_date: "" });
  const [error, setError] = useState("");

  const schoolId = profile?.school_id;

  const totals = useMemo(() => {
    const total = fees.reduce((acc, f) => acc + Number(f.total_amount || 0), 0);
    const paid = fees.reduce((acc, f) => acc + Number(f.paid_amount || 0), 0);
    const due = fees.reduce((acc, f) => acc + Number(f.due_amount || 0), 0);
    return { total, paid, due };
  }, [fees]);

  const getFeeStatus = (total, paid) => {
    if (isNaN(total) || isNaN(paid)) return "pending";
    if (total <= 0) return "paid";
    if (paid >= total) return "paid";
    if (paid > 0 && paid < total) return "partial";
    return "pending";
  };

  const normalizedFeeStatus = (status) => {
    const allowed = ["paid", "pending", "partial"];
    if (!status) return "pending";
    const s = String(status).toLowerCase();
    return allowed.includes(s) ? s : "pending";
  };

  useEffect(() => {
    if (!schoolId) return;

    async function loadStudents() {
      const { data, error: studentError } = await supabase
        .from("students")
        .select("id,full_name,roll_number")
        .eq("school_id", schoolId);

      if (studentError) {
        console.warn("Could not load students for fee form:", studentError.message);
        setStudents([]);
      } else {
        setStudents(data || []);
      }
    }

    async function loadFees() {
      setLoading(true);
      let query = supabase
        .from("fees")
        .select("id,student_id,fee_title,total_amount,paid_amount,due_amount,status,due_date,students(full_name,roll_number)")
        .eq("school_id", schoolId);
      if (filter === "paid") query = query.eq("status", "paid");
      if (filter === "pending") query = query.in("status", ["pending", "partial"]);
      const { data, error: fetchError } = await query.order("due_date", { ascending: true });
      if (fetchError) {
        setError(fetchError.message);
        setFees([]);
      } else {
        setError("");
        setFees(data || []);
      }
      setLoading(false);
    }

    loadStudents();
    loadFees();
  }, [schoolId, filter]);

  async function loadPaymentHistory(feeId) {
    if (!feeId || !schoolId) return;

    const paymentSelect = "id,fee_id,student_id,amount,payment_date,payment_mode,receipt_number,created_by,created_at";

    let { data, error } = await supabase
      .from("fee_payments")
      .select(paymentSelect)
      .eq("school_id", schoolId)
      .eq("fee_id", feeId)
      .order("payment_date", { ascending: false });

    // Fallback for older schema where receipt_number or created_by may not exist yet
    if (error && (error.message.includes("receipt_number") || error.message.includes("created_by"))) {
      const fallbackSelect = "id,fee_id,student_id,amount,payment_date,payment_mode,created_at";
      const fallback = await supabase
        .from("fee_payments")
        .select(fallbackSelect)
        .eq("school_id", schoolId)
        .eq("fee_id", feeId)
        .order("payment_date", { ascending: false });

      if (fallback.error) {
        setError(fallback.error.message);
        setPaymentHistory([]);
        return;
      }

      setPaymentHistory(fallback.data || []);
      return;
    }

    if (error) {
      setError(error.message);
      setPaymentHistory([]);
      return;
    }

    setPaymentHistory(data || []);
  }

  async function payFee(fee) {
    if (!fee?.id || Number(paymentAmount) <= 0) return;
    const amountValue = Number(paymentAmount);
    if (amountValue > Number(fee.due_amount || 0)) {
      setError("Payment amount cannot be greater than the current due amount.");
      return;
    }

    const paymentRecord = {
      fee_id: fee.id,
      school_id: schoolId,
      student_id: fee.student_id,
      amount: amountValue,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_mode: paymentMode,
    };

    if (profile?.id) {
      paymentRecord.created_by = profile.id;
    }

    let { error: insertError } = await supabase.from("fee_payments").insert(paymentRecord);

    if (insertError && insertError.message.includes("created_by")) {
      const { error: retryError } = await supabase.from("fee_payments").insert({
        fee_id: fee.id,
        school_id: schoolId,
        student_id: fee.student_id,
        amount: amountValue,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: paymentMode,
      });
      insertError = retryError;
    }

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Update fee totals & status
    const totalAmount = Number(fee.total_amount || 0);
    const currentPaid = Number(fee.paid_amount || 0);
    const newPaid = Number((currentPaid + amountValue).toFixed(2));
    const newDue = Number((totalAmount - newPaid).toFixed(2));
    const statusValue = getFeeStatus(totalAmount, newPaid);

    const { error: updateError } = await supabase.from("fees").update({
      paid_amount: newPaid,
      due_amount: newDue >= 0 ? newDue : 0,
      status: statusValue,
      updated_at: new Date().toISOString(),
    }).eq("id", fee.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setError("");
    setPaymentAmount(0);
    setPaymentMode("cash");

    const { data: updatedFee } = await supabase
      .from("fees")
      .select("id,student_id,fee_title,total_amount,paid_amount,due_amount,status,due_date,students(full_name,roll_number)")
      .eq("id", fee.id)
      .maybeSingle();

    if (updatedFee) {
      setFees((prev) => prev.map((f) => (f.id === fee.id ? updatedFee : f)));
      setSelectedFee(updatedFee);
      await loadPaymentHistory(fee.id);
    }
    setError("Payment collected successfully.");
  }

  async function createOrUpdateFee(e) {
    e.preventDefault();
    setError("");

    if (!newFee.student_id || !newFee.fee_title || !newFee.total_amount) {
      setError("Please provide Student, Title and Total Amount for the fee.");
      return;
    }

    const totalValue = Number(newFee.total_amount);
    const paidValue = Number(newFee.paid_amount || 0);
    const dueValue = totalValue - paidValue;
    if (totalValue <= 0) {
      setError("Total amount must be greater than zero.");
      return;
    }
    if (paidValue < 0) {
      setError("Paid amount cannot be negative.");
      return;
    }
    if (paidValue > totalValue) {
      setError("Paid amount cannot be greater than total amount.");
      return;
    }

    const statusValue = getFeeStatus(totalValue, paidValue);

    const newPayload = {
      school_id: schoolId,
      student_id: newFee.student_id,
      fee_title: newFee.fee_title,
      total_amount: totalValue,
      paid_amount: paidValue,
      due_amount: Number((totalValue - paidValue).toFixed(2)),
      status: statusValue,
      due_date: newFee.due_date || null,
      updated_at: new Date().toISOString(),
    };

    if (editingFee?.id) {
      const { error: updateError } = await supabase
        .from("fees")
        .update(newPayload)
        .eq("id", editingFee.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setFees((prev) => prev.map((f) => f.id === editingFee.id ? { ...f, ...newPayload } : f));
      setEditingFee(null);
      setCreatingFee(false);
      setError("Fee updated successfully.");
      return;
    }

    const { data: insertedFee, error: insertError } = await supabase
      .from("fees")
      .insert([newPayload])
      .select("id,student_id,fee_title,total_amount,paid_amount,due_amount,status,due_date,students(full_name,roll_number)")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setFees((prev) => [insertedFee, ...prev]);
    setNewFee({ student_id: "", fee_title: "", total_amount: "", paid_amount: "", due_date: "" });
    setCreatingFee(false);
    setError("Fee created successfully.");
  }

  async function deleteFee(feeId) {
    if (!feeId) return;
    if (!window.confirm("Delete this fee line?")) return;

    const { error: deleteError } = await supabase.from("fees").delete().eq("id", feeId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setFees((prev) => prev.filter((f) => f.id !== feeId));
    setError("Fee deleted successfully.");
  }

  return (
    <div>
      <h1>Accountant Dashboard</h1>
      <section className="meta-grid" style={{ marginBottom: 16 }}>
        <article className="meta-tile"><span className="meta-label">Total</span><strong>₹ {totals.total.toFixed(2)}</strong></article>
        <article className="meta-tile"><span className="meta-label">Paid</span><strong>₹ {totals.paid.toFixed(2)}</strong></article>
        <article className="meta-tile"><span className="meta-label">Due</span><strong>₹ {totals.due.toFixed(2)}</strong></article>
      </section>

      <section className="dashboard-card" style={{ marginBottom: 16 }}>
        <h2>Create / Edit Fee</h2>
        <form onSubmit={createOrUpdateFee} className="auth-form">
          <label>
            <span>Student</span>
            <select value={newFee.student_id} onChange={(e) => setNewFee((s) => ({ ...s, student_id: e.target.value }))} required>
              <option value="">-- select student --</option>
              {students.map((st) => (
                <option value={st.id} key={st.id}>{st.roll_number} - {st.full_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input value={newFee.fee_title} onChange={(e) => setNewFee((s) => ({ ...s, fee_title: e.target.value }))} required />
          </label>
          <label>
            <span>Total Amount</span>
            <input type="number" step="0.01" value={newFee.total_amount} onChange={(e) => setNewFee((s) => ({ ...s, total_amount: e.target.value }))} required />
          </label>
          <label>
            <span>Paid Amount</span>
            <input type="number" step="0.01" value={newFee.paid_amount} onChange={(e) => setNewFee((s) => ({ ...s, paid_amount: e.target.value }))} />
          </label>
          <label>
            <span>Due Date</span>
            <input type="date" value={newFee.due_date} onChange={(e) => setNewFee((s) => ({ ...s, due_date: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="primary-button" type="submit">{editingFee ? "Update Fee" : "Create Fee"}</button>
            <button type="button" className="secondary-button" onClick={() => {
              setCreatingFee(false);
              setEditingFee(null);
              setNewFee({ student_id: "", fee_title: "", total_amount: "", paid_amount: "", due_date: "" });
            }}>Cancel</button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <h2>Fee Collection</h2>
        {error ? <p className="error-text">{error}</p> : null}
        <label>
          <span>Filter</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending/Partial</option>
          </select>
        </label>

        {loading ? <p>Loading...</p> : null}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Title</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
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
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button className="secondary-button" onClick={() => {
                      setSelectedFee(fee);
                      setPaymentAmount(0);
                      setPaymentMode('cash');
                      loadPaymentHistory(fee.id);
                    }}>Pay</button>
                    <button className="secondary-button" onClick={() => {
                      setEditingFee(fee);
                      setCreatingFee(true);
                      setNewFee({
                        student_id: fee.student_id,
                        fee_title: fee.fee_title,
                        total_amount: fee.total_amount,
                        paid_amount: fee.paid_amount,
                        due_date: fee.due_date ? fee.due_date.slice(0,10) : "",
                      });
                    }}>Edit</button>
                    <button className="secondary-button" onClick={() => deleteFee(fee.id)}>Delete</button>
                    <button className="secondary-button" onClick={() => {
                      setSelectedFee(fee);
                      loadPaymentHistory(fee.id);
                    }}>History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedFee ? (
          <div className="dashboard-card" style={{ marginTop: 12 }}>
            <h3>Collect Payment for {selectedFee.students?.full_name || selectedFee.fee_title}</h3>
            <p>{selectedFee.fee_title} • Due ₹ {Number(selectedFee.due_amount || 0).toFixed(2)}</p>
            <label>
              <span>Amount to pay</span>
              <input type="number" value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min={0}
                max={Number(selectedFee.due_amount)}
              />
            </label>
            <label>
              <span>Payment Mode</span>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <button className="primary-button" onClick={() => payFee(selectedFee)}>Collect</button>

            <h4 style={{ marginTop: 16 }}>Payment History</h4>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Mode</th><th>Receipt</th><th>Created By</th></tr>
                </thead>
                <tbody>
                  {paymentHistory.length === 0 && (
                    <tr><td colSpan={5}>No payments yet.</td></tr>
                  )}
                  {paymentHistory.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "-"}</td>
                      <td>{p.amount}</td>
                      <td>{p.payment_mode}</td>
                      <td>{p.receipt_number}</td>
                      <td>{p.created_by || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

      </section>
    </div>
  );
}
