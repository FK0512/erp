import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import AttendanceStatus from "../../components/AttendanceStatus";
import FeeStatus from "../../components/FeeStatus";
import Homework from "../../components/Homework";
import Notices from "../../components/Notices";
import Marks from "../../components/Marks";

export default function StudentDashboard({ profile }) {
  const [student, setStudent] = useState(null);
  const [activePanel, setActivePanel] = useState("attendance");

  useEffect(() => {
    async function loadStudent() {
      const { data: studentData } = await supabase
        .from("students")
        .select("id,class_id")
        .eq("user_profile_id", profile.id)
        .maybeSingle();

      if (studentData) {
        setStudent(studentData);
      }
    }

    if (profile?.id) {
      loadStudent();
    }
  }, [profile]);

  const panels = [
    { key: "attendance", label: "Attendance Status" },
    { key: "fees", label: "Fee Status" },
    { key: "homework", label: "Homework" },
    { key: "notices", label: "Notices" },
    { key: "marks", label: "Marks" },
  ];

  const renderPanel = () => {
    if (!student) return <p>Loading...</p>;

    switch (activePanel) {
      case "attendance":
        return <AttendanceStatus studentId={student.id} />;
      case "fees":
        return <FeeStatus studentId={student.id} />;
      case "homework":
        return <Homework classId={student.class_id} />;
      case "notices":
        return <Notices />;
      case "marks":
        return <Marks studentId={student.id} />;
      default:
        return <AttendanceStatus studentId={student.id} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: "250px", background: "#f4f4f4", padding: "20px", borderRight: "1px solid #ddd" }}>
        <h3>Student Panel</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {panels.map((panel) => (
            <li key={panel.key} style={{ marginBottom: "10px" }}>
              <button
                onClick={() => setActivePanel(panel.key)}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: activePanel === panel.key ? "#007bff" : "#fff",
                  color: activePanel === panel.key ? "#fff" : "#000",
                  border: "1px solid #ddd",
                  cursor: "pointer",
                }}
              >
                {panel.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main style={{ flex: 1, padding: "20px" }}>
        {renderPanel()}
      </main>
    </div>
  );
}
