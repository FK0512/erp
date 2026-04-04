import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const PAGE_SIZE = 12;

export default function StudentManagement({ profile }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [formData, setFormData] = useState({ full_name: "", roll_number: "", class_id: "" });

  const schoolId = profile?.school_id;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  useEffect(() => {
    if (!schoolId) return;

    fetchClasses();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;

    fetchStudents();
  }, [schoolId, page]);

  async function fetchClasses() {
    const { data } = await supabase
      .from("classes")
      .select("id,class_name,section")
      .eq("school_id", schoolId)
      .order("class_name", { ascending: true });
    setClasses(data || []);
  }

  async function fetchStudents(targetPage = page) {
    setLoading(true);

    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count, error } = await supabase
      .from("students")
      .select("id,full_name,roll_number,admission_number,class_id,guardian_name,created_at", { count: "exact" })
      .eq("school_id", schoolId)
      .range(from, to)
      .order("created_at", { ascending: false });

    setTotalCount(count ?? 0);

    if (!error) {
      setStudents(data || []);
    }
    setLoading(false);
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    if (!formData.full_name || !formData.roll_number || !formData.class_id) return;
    if (!schoolId) {
      setFormError("Your admin profile is missing a school ID. Refresh and sign in again.");
      return;
    }
    if (profile?.role !== "admin") {
      setFormError("Only admin accounts can create students.");
      return;
    }

    setFormBusy(true);
    setFormError("");
    setFormSuccess("");

    const { error } = await supabase.from("students").insert([
      {
        school_id: schoolId,
        name: formData.full_name.trim(),
        full_name: formData.full_name.trim(),
        roll_number: formData.roll_number.trim(),
        class_id: formData.class_id || null,
        admission_number: formData.admission_number?.trim() || null,
        guardian_name: formData.guardian_name?.trim() || null,
      },
    ]);

    if (!error) {
      setFormData({ full_name: "", roll_number: "", class_id: "", admission_number: "", guardian_name: "" });
      setFormSuccess("Student created successfully.");
      setPage(1);
      await fetchStudents(1);
    } else {
      setFormError(`Could not create student: ${error.message}${error.code ? ` (${error.code})` : ""}`);
    }

    setFormBusy(false);
  }

  async function handleDelete(id) {
    await supabase.from("students").delete().eq("id", id);
    setStudents((prev) => prev.filter((it) => it.id !== id));
    setTotalCount((s) => Math.max(0, s - 1));
  }

  return (
    <div>
      <h1>Student Management</h1>
      <section className="dashboard-card">
        <h2>Add New Student</h2>
        {formSuccess ? <p className="success-text">{formSuccess}</p> : null}
        {formError ? <p className="error-text">{formError}</p> : null}
        <form className="auth-form" onSubmit={handleAddStudent}>
          <label>
            <span>Full Name</span>
            <input value={formData.full_name} onChange={(e) => setFormData((c) => ({ ...c, full_name: e.target.value }))} required />
          </label>
          <label>
            <span>Roll Number</span>
            <input value={formData.roll_number} onChange={(e) => setFormData((c) => ({ ...c, roll_number: e.target.value }))} required />
          </label>
          <label>
            <span>Class</span>
            <select value={formData.class_id ?? ""} onChange={(e) => setFormData((c) => ({ ...c, class_id: e.target.value }))} required>
              <option value="">-- Select Class --</option>
              {classes.map((cl) => (
                <option key={cl.id} value={cl.id}>{`${cl.class_name} (${cl.section})`}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Admission Number</span>
            <input value={formData.admission_number ?? ""} onChange={(e) => setFormData((c) => ({ ...c, admission_number: e.target.value }))} />
          </label>
          <label>
            <span>Guardian Name</span>
            <input value={formData.guardian_name ?? ""} onChange={(e) => setFormData((c) => ({ ...c, guardian_name: e.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={formBusy}>
            {formBusy ? "Creating..." : "Create Student"}
          </button>
        </form>
      </section>

      <section className="dashboard-card">
        <h2>Students List</h2>
        {loading ? <p>Loading...</p> : null}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll</th>
                <th>Class</th>
                <th>Guardian</th>
                <th>Admn. no</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.full_name}</td>
                  <td>{student.roll_number}</td>
                  <td>{classes.find((c) => c.id === student.class_id)?.class_name ?? "-"}</td>
                  <td>{student.guardian_name || "-"}</td>
                  <td>{student.admission_number || "-"}</td>
                  <td>
                    <button className="secondary-button" onClick={() => handleDelete(student.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}
