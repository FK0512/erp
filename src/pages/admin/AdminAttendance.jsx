import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminAttendance({ profile }) {
  const [stats, setStats] = useState({ present: 0, absent: 0, percent: 0 });
  const [loading, setLoading] = useState(false);
  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .then(({ data }) => {
        const present = (data || []).filter((row) => row.status === "present").length;
        const absent = (data || []).filter((row) => row.status === "absent").length;
        const total = (data || []).length;
        setStats({ present, absent, percent: total ? Math.round((present / total) * 100) : 0 });
      })
      .finally(() => setLoading(false));
  }, [schoolId]);

  return (
    <div>
      <h1>Attendance Overview</h1>
      {loading ? <p>Loading attendance data...</p> : (
        <section className="meta-grid" style={{ marginBottom: 16 }}>
          <article className="meta-tile"><span className="meta-label">Present</span><strong>{stats.present}</strong></article>
          <article className="meta-tile"><span className="meta-label">Absent</span><strong>{stats.absent}</strong></article>
          <article className="meta-tile"><span className="meta-label">Present %</span><strong>{stats.percent}%</strong></article>
        </section>
      )}
    </div>
  );
}
