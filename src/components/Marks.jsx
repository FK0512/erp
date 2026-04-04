import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Marks({ studentId }) {
  const [marks, setMarks] = useState([]);

  useEffect(() => {
    async function loadMarks() {
      const { data } = await supabase
        .from("marks")
        .select("id, subject_name, exam_type, marks")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      setMarks(data || []);
    }
    if (studentId) loadMarks();
  }, [studentId]);

  return (
    <div className="dashboard-card">
      <h2>Marks</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Exam</th>
              <th>Marks</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((row) => (
              <tr key={row.id}>
                <td>{row.subject_name}</td>
                <td>{row.exam_type}</td>
                <td>{row.marks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
