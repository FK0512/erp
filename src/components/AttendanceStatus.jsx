import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AttendanceStatus({ studentId }) {
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, percent: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAttendance() {
      const { data, error: fetchError } = await supabase
        .from("attendance")
        .select("id, attendance_date, status, subject, period")
        .eq("student_id", studentId)
        .order("attendance_date", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setAttendance([]);
        return;
      }

      setError("");
      setAttendance(data || []);
      const present = (data || []).filter((a) => a.status === "present").length;
      const absent = (data || []).filter((a) => a.status === "absent").length;
      const total = (data || []).length;
      setStats({
        present,
        absent,
        percent: total ? Math.round((present / total) * 100) : 0
      });
    }
    if (studentId) loadAttendance();
  }, [studentId]);

  return (
    <div className="dashboard-card">
      <h2>Attendance Status</h2>
      {error ? <p className="error-text">Could not load attendance: {error}</p> : null}
      <div className="meta-grid" style={{ marginBottom: 16 }}>
        <article className="meta-tile">
          <span className="meta-label">Present</span>
          <strong>{stats.present}</strong>
        </article>
        <article className="meta-tile">
          <span className="meta-label">Absent</span>
          <strong>{stats.absent}</strong>
        </article>
        <article className="meta-tile">
          <span className="meta-label">Percentage</span>
          <strong>{stats.percent}%</strong>
        </article>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Period</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.attendance_date).toLocaleDateString()}</td>
                <td>{a.subject || "General"}</td>
                <td>{a.period || "-"}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
