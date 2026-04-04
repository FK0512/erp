import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminAnnouncements({ profile }) {
  const [announcements, setAnnouncements] = useState([]);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const schoolId = profile?.school_id;

  const refreshAnnouncements = async (sid = schoolId) => {
    if (!sid) return;

    const { data, error: fetchError } = await supabase
      .from("announcements")
      .select("id,title,message,audience,created_at")
      .eq("school_id", sid)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(`Failed to load announcements: ${fetchError.message}`);
      setAnnouncements([]);
    } else {
      setAnnouncements(data || []);
    }
  };

  useEffect(() => {
    if (!schoolId) {
      setError("No school ID found in profile");
      return;
    }
    refreshAnnouncements(schoolId);
  }, [schoolId]);

  async function createAnnouncement(e) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError("Title and message are required");
      return;
    }
    if (!schoolId) {
      setError("School ID is missing. Please refresh the page.");
      return;
    }

    setSaving(true);
    setError("");

    const { data: insertedData, error: insertError } = await supabase
      .from("announcements")
      .insert({
        school_id: schoolId,
        title: title.trim(),
        message: text.trim(),
        audience,
      })
      .select();

    if (insertError) {
      setError(
        `Failed to publish: ${insertError.message} (${insertError.code || "unknown code"}). Check browser console for details.`
      );
      setSaving(false);
      return;
    }

    setTitle("");
    setText("");
    setAudience("all");
    setError("");

    await refreshAnnouncements(schoolId);
    setSaving(false);
  }

  return (
    <div>
      <h1>Announcement Reports</h1>
      {error ? <p className="error-text" style={{ marginBottom: 16 }}>{error}</p> : null}
      
      <form className="auth-form" onSubmit={createAnnouncement}>
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Enter announcement title" />
        </label>
        <label>
          <span>Message</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} required placeholder="Enter announcement message" />
        </label>
        <label>
          <span>Audience</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">All</option>
            <option value="teachers">Teachers</option>
            <option value="students">Students</option>
            <option value="accountant">Accountant</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={saving || !schoolId}>{saving ? "Publishing..." : "Publish Announcement"}</button>
      </form>

      <section className="dashboard-card">
        <h2>All Announcements</h2>
        {announcements?.length > 0 ? (
          announcements.map((a) => (
            <article key={a.id} className="dashboard-card" style={{ padding: "12px", marginBottom: 10 }}>
              <strong>{a.title}</strong>
              <p>{a.message}</p>
              <small>Audience: {a.audience}</small>
              <small>{new Date(a.created_at).toLocaleDateString()}</small>
            </article>
          ))
        ) : (
          <p>No announcements yet. Create one above!</p>
        )}
      </section>
    </div>
  );
}
