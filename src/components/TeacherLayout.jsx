import { useState } from "react";
import TeacherTakeAttendance from "./TeacherTakeAttendance";
import TeacherViewStudents from "./TeacherViewStudents";
import TeacherUploadMarks from "./TeacherUploadMarks";
import TeacherHomework from "./TeacherHomework";
import TeacherNotices from "./TeacherNotices";
import TeacherDailySchedule from "./TeacherDailySchedule";

export function TeacherLayout({ profile, onLogout }) {
  const [activePanel, setActivePanel] = useState("attendance");

  const panels = [
    { key: "attendance", label: "Take Attendance" },
    { key: "students", label: "View Class Students" },
    { key: "marks", label: "Upload Marks" },
    { key: "homework", label: "Homework" },
    { key: "notices", label: "Notices" },
    { key: "schedule", label: "Daily Schedule" },
  ];

  const renderPanel = () => {
    switch (activePanel) {
      case "attendance":
        return <TeacherTakeAttendance profile={profile} />;
      case "students":
        return <TeacherViewStudents profile={profile} />;
      case "marks":
        return <TeacherUploadMarks profile={profile} />;
      case "homework":
        return <TeacherHomework profile={profile} />;
      case "notices":
        return <TeacherNotices profile={profile} />;
      case "schedule":
        return <TeacherDailySchedule profile={profile} />;
      default:
        return <TeacherTakeAttendance profile={profile} />;
    }
  };

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <h2>Teacher Panel</h2>
        <nav>
          {panels.map((panel) => (
            <button
              key={panel.key}
              onClick={() => setActivePanel(panel.key)}
              style={{
                width: "100%",
                textAlign: "left",
                background: activePanel === panel.key ? "#f0e6d2" : "transparent",
                color: activePanel === panel.key ? "#9a4d20" : "#172033",
                border: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: activePanel === panel.key ? "600" : "500",
                transition: "all 150ms ease",
              }}
            >
              {panel.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button className="secondary-button" onClick={onLogout} style={{ width: "100%" }}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <strong>{profile?.name ?? "Teacher"}</strong>
            <span>{profile?.school?.name ?? "No School"}</span>
          </div>
        </header>
        <article className="content-area">
          {renderPanel()}
        </article>
      </main>
    </div>
  );
}
