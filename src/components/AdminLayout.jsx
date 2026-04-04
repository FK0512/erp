import { NavLink, Outlet, useNavigate } from "react-router-dom";

export function AdminLayout({ profile, onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <h2>📊 Admin</h2>
        <p style={{ fontSize: "0.75rem", color: "#666", margin: "0 0 8px 0" }}>School: {profile?.school?.name ?? "Loading..."}</p>
        <nav>
          <NavLink to="/admin" end>📈 Overview</NavLink>
          <NavLink to="/admin/students">👥 Students</NavLink>
          <NavLink to="/admin/fees">💰 Fees</NavLink>
          <NavLink to="/admin/attendance">📋 Attendance</NavLink>
          <NavLink to="/admin/staff">👨‍💼 Staff</NavLink>
          <NavLink to="/admin/announcements">📢 Announcements</NavLink>
          <NavLink to="/admin/reports">📊 Reports</NavLink>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <strong style={{ fontSize: "1.1rem" }}>{profile?.name ?? "Admin"}</strong>
            <span style={{ fontSize: "0.85rem", color: "#666" }}>{profile?.school?.name ?? "No School"}</span>
          </div>
          <div className="top-actions">
            <button className="secondary-button" onClick={() => navigate("/dashboard")}>← Back</button>
            <button className="primary-button" onClick={onLogout}>Logout</button>
          </div>
        </header>
        <article className="content-area">
          <Outlet />
        </article>
      </main>
    </div>
  );
}
