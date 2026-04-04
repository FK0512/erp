import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Notices({ audiences = [] }) {
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAnnouncements() {
      let query = supabase
        .from("announcements")
        .select("id, title, message, audience, created_at")
        .order("created_at", { ascending: false });

      if (audiences.length > 0) {
        query = query.in("audience", audiences);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setAnnouncements([]);
        setError(fetchError.message);
        return;
      }

      setError("");
      setAnnouncements(data || []);
    }
    loadAnnouncements();
  }, [audiences]);

  return (
    <div className="dashboard-card">
      <h2>Notices</h2>
      {error ? <p className="error-text">Could not load notices: {error}</p> : null}
      {announcements.length ? announcements.map((note) => (
        <article key={note.id} className="dashboard-card" style={{ padding: "14px", marginBottom: "10px" }}>
          <strong>{note.title}</strong>
          <p>{note.message}</p>
          <small>Audience: {note.audience}</small>
          <small>{new Date(note.created_at).toLocaleDateString()}</small>
        </article>
      )) : <p>No notices.</p>}
    </div>
  );
}
