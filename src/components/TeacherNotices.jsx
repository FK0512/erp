import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherNotices({ profile }) {
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (schoolId) {
      loadNotices();
    }
  }, [schoolId]);

  async function loadNotices() {
    if (!schoolId) {
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("announcements")
      .select("id, title, message, audience, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(`Failed to load notices: ${fetchError.message}`);
      setNotices([]);
    } else {
      setNotices(data || []);
    }

    setLoading(false);
  }

  async function postNotice(e) {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim() || !schoolId) return;

    setSubmitting(true);
    setError("");

    const { error: insertError } = await supabase.from("announcements").insert({
      school_id: schoolId,
      title: noticeTitle.trim(),
      message: noticeMessage.trim(),
      audience,
    });

    if (insertError) {
      setError(`Failed to post notice: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    setNoticeTitle("");
    setNoticeMessage("");
    setAudience("all");

    await loadNotices();
    setSubmitting(false);
  }

  return (
    <div className="dashboard-card">
      <h2>Notices & Announcements</h2>
      {error ? <p className="error-text">{error}</p> : null}

      <div style={{ marginBottom: "24px" }}>
        <h3>Post New Notice</h3>
        <form className="auth-form" onSubmit={postNotice}>
          <label>
            <span>Title</span>
            <input
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="e.g., School Holiday"
              required
            />
          </label>
          <label>
            <span>Message</span>
            <textarea
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              rows={4}
              required
            />
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
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Posting..." : "Post Notice"}
          </button>
        </form>
      </div>

      <div>
        <h3>Recent Notices</h3>
        {loading ? (
          <p>Loading notices...</p>
        ) : notices.length > 0 ? (
          <div style={{ display: "grid", gap: "12px" }}>
            {notices.map((notice) => (
              <article key={notice.id} className="dashboard-card" style={{ padding: "14px", marginBottom: "0" }}>
                <strong>{notice.title}</strong>
                <p>{notice.message}</p>
                <small>Audience: {notice.audience}</small>
                <small>
                  Posted: {new Date(notice.created_at).toLocaleDateString()}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p>No notices posted yet.</p>
        )}
      </div>
    </div>
  );
}
