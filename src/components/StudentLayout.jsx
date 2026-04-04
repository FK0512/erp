import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export function StudentLayout({ profile, onLogout }) {
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentError, setStudentError] = useState("");

  useEffect(() => {
    async function loadStudent() {
      setLoadingStudent(true);

      const { data, error } = await supabase
        .from("students")
        .select("id, class_id, full_name, roll_number, classes(class_name, section)")
        .eq("user_profile_id", profile.id)
        .maybeSingle();

      if (error) {
        setStudentError(error.message);
        setStudent(null);
        setLoadingStudent(false);
        return;
      }

      setStudentError("");
      setStudent(data || null);
      setLoadingStudent(false);
    }

    if (profile?.id) {
      loadStudent();
    } else {
      setStudentError("");
      setLoadingStudent(false);
    }
  }, [profile]);

  const panels = [
    { to: "/student/attendance", label: "Attendance Status" },
    { to: "/student/fees", label: "Fee Status" },
    { to: "/student/homework", label: "Homework" },
    { to: "/student/notices", label: "Notices" },
    { to: "/student/marks", label: "Marks" },
  ];

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <h2>Student Panel</h2>
        <nav>
          {panels.map((panel) => (
            <NavLink key={panel.to} to={panel.to}>
              {panel.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button className="secondary-button" onClick={onLogout} style={{ width: "100%" }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div>
            <strong>{profile?.name ?? "Student"}</strong>
            <span>{profile?.school?.name ?? "No School"}</span>
          </div>
        </header>
        <article className="content-area">
          <section className="dashboard-card" style={{ marginBottom: "16px" }}>
            <h1 style={{ margin: 0, fontSize: "2rem" }}>Student Portal</h1>
            <p className="body-copy">
              Use the left panel to switch between attendance, fee status,
              homework, notices, and marks.
            </p>
          </section>
          {studentError ? <p className="error-text">Could not load student profile: {studentError}</p> : null}
          <Outlet context={{ student, loadingStudent, profile }} />
        </article>
      </main>
    </div>
  );
}
