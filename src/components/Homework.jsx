import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function buildHomeworkSignature(item) {
  return [
    item.title ?? "",
    item.description ?? "",
    item.due_date ?? "",
    item.created_by ?? "",
    item.created_at ? new Date(item.created_at).toISOString().slice(0, 16) : "",
  ].join("::");
}

function getCommonHomeworkRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = buildHomeworkSignature(row);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .filter((items) => {
      const distinctClasses = new Set(items.map((item) => item.class_id).filter(Boolean));
      return distinctClasses.size > 1;
    })
    .map((items) => items[0])
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function getUniqueSchoolHomework(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = buildHomeworkSignature(row);
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, row);
    }
  }

  return Array.from(grouped.values()).sort(
    (left, right) => new Date(right.created_at) - new Date(left.created_at)
  );
}

export default function Homework({ classId, schoolId, sharedOnly = false, schoolWideFallback = false }) {
  const [homework, setHomework] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHomework() {
      let query = supabase
        .from("homework")
        .select("id, title, description, due_date, created_at, created_by, class_id, classes(class_name, section)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (classId && !schoolWideFallback) {
        query = query.eq("class_id", classId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setHomework([]);
        setError(fetchError.message);
        return;
      }

      setError("");
      if (schoolWideFallback) {
        setHomework(getUniqueSchoolHomework(data || []));
        return;
      }

      setHomework(sharedOnly ? getCommonHomeworkRows(data || []) : (data || []));
    }
    if (schoolId) loadHomework();
  }, [classId, schoolId, sharedOnly, schoolWideFallback]);

  return (
    <div className="dashboard-card">
      <h2>Homework</h2>
      {error ? <p className="error-text">Could not load homework: {error}</p> : null}
      {homework.length ? homework.map((hw) => (
        <article key={hw.id} className="dashboard-card" style={{ padding: "14px", marginBottom: "10px" }}>
          <strong>{hw.title}</strong>
          <p>{hw.description}</p>
          {schoolWideFallback ? (
            <small>
              Class {hw.classes?.class_name ?? "-"}
              {hw.classes?.section ? ` (${hw.classes.section})` : ""}
            </small>
          ) : null}
          <small>Posted {new Date(hw.created_at).toLocaleDateString()}</small>
          <small>{hw.due_date ? `Due ${new Date(hw.due_date).toLocaleDateString()}` : "No due date set"}</small>
        </article>
      )) : <p>No homework currently assigned.</p>}
    </div>
  );
}
