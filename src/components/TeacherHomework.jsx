import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherHomework({ profile }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [homeworkText, setHomeworkText] = useState("");
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingHomework, setExistingHomework] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const schoolId = profile?.school_id;
  const allClassesValue = "__all_classes__";

  useEffect(() => {
    if (!schoolId) return;

    async function loadClasses() {
      const { data } = await supabase
        .from("classes")
        .select("id, class_name, section")
        .eq("school_id", schoolId)
        .order("class_name", { ascending: true });
      setClasses(data || []);
    }

    loadClasses();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) {
      setExistingHomework([]);
      return;
    }

    async function loadHomework() {
      setLoading(true);
      let query = supabase
        .from("homework")
        .select("id, title, description, due_date, created_at, class_id")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (selectedClass !== allClassesValue) {
        query = query.eq("class_id", selectedClass);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setExistingHomework([]);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setError("");
      setExistingHomework(data || []);
      setLoading(false);
    }

    loadHomework();
  }, [selectedClass, schoolId]);

  async function postHomework(e) {
    e.preventDefault();
    if (!selectedClass || !homeworkText.trim()) return;

    setSubmitting(true);
    setError("");

    const targetClassIds =
      selectedClass === allClassesValue
        ? classes.map((item) => item.id)
        : [selectedClass];

    const rows = targetClassIds.map((classId) => ({
      school_id: schoolId,
      class_id: classId,
      title: homeworkTitle || `Homework ${new Date().toLocaleDateString()}`,
      description: homeworkText.trim(),
      due_date: dueDate || null,
      created_by: profile?.id,
    }));

    const { error: insertError } = await supabase.from("homework").insert(rows);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setHomeworkText("");
    setHomeworkTitle("");
    setDueDate("");

    let refreshQuery = supabase
      .from("homework")
      .select("id, title, description, due_date, created_at, class_id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (selectedClass !== allClassesValue) {
      refreshQuery = refreshQuery.eq("class_id", selectedClass);
    }

    const { data, error: refreshError } = await refreshQuery;
    if (refreshError) {
      setError(refreshError.message);
      setExistingHomework([]);
    } else {
      setExistingHomework(data || []);
    }
    setSubmitting(false);
  }

  function getClassLabel(classId) {
    const classRow = classes.find((item) => item.id === classId);
    if (!classRow) {
      return "Unknown class";
    }

    return `Class ${classRow.class_name} (${classRow.section})`;
  }

  return (
    <div className="dashboard-card">
      <h2>Homework</h2>
      {error ? <p className="error-text">{error}</p> : null}

      <label style={{ marginBottom: "16px" }}>
        <span>Target</span>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">-- choose target --</option>
          <option value={allClassesValue}>All Classes</option>
          {classes.map((cl) => (
            <option key={cl.id} value={cl.id}>{`${cl.class_name} (${cl.section})`}</option>
          ))}
        </select>
      </label>

      {selectedClass && (
        <>
          <div style={{ marginBottom: "24px" }}>
            <h3>Post New Homework</h3>
            <form className="auth-form" onSubmit={postHomework}>
              <label>
                <span>Title (optional)</span>
                <input
                  value={homeworkTitle}
                  onChange={(e) => setHomeworkTitle(e.target.value)}
                  placeholder="e.g., Chapter 5 Assignment"
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={homeworkText}
                  onChange={(e) => setHomeworkText(e.target.value)}
                  rows={4}
                  required
                />
              </label>
              <label>
                <span>Due Date (optional)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Posting..." : "Post Homework"}
              </button>
            </form>
          </div>

          <div>
            <h3>Homework History</h3>
            {loading ? (
              <p>Loading homework...</p>
            ) : existingHomework.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {existingHomework.map((hw) => (
                  <article key={hw.id} className="dashboard-card" style={{ padding: "14px", marginBottom: "0" }}>
                    <strong>{hw.title}</strong>
                    <p>{hw.description}</p>
                    <small>
                      Target: {getClassLabel(hw.class_id)}
                    </small>
                    <small>
                      Posted: {new Date(hw.created_at).toLocaleDateString()}
                      {hw.due_date && ` | Due: ${new Date(hw.due_date).toLocaleDateString()}`}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <p>No homework posted yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
