import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherUploadMarks({ profile }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [marksData, setMarksData] = useState({ student_id: "", subject_name: "", exam_type: "", marks: "" });
  const [submitting, setSubmitting] = useState(false);
  const [existingMarks, setExistingMarks] = useState([]);
  const [error, setError] = useState("");

  const schoolId = profile?.school_id;

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
      setStudents([]);
      setExistingMarks([]);
      return;
    }

    async function loadStudents() {
      const { data } = await supabase
        .from("students")
        .select("id, full_name, roll_number")
        .eq("class_id", selectedClass)
        .order("roll_number", { ascending: true });

      setStudents(data || []);
    }

    async function loadExistingMarks() {
      const { data: classStudents } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", selectedClass);

      const studentIds = (classStudents || []).map(s => s.id);

      if (studentIds.length === 0) {
        setExistingMarks([]);
        return;
      }

      const { data } = await supabase
        .from("marks")
        .select("id, student_id, subject_name, exam_type, marks")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });

      setExistingMarks(data || []);
    }

    loadStudents();
    loadExistingMarks();
  }, [selectedClass]);

  async function submitMarks(e) {
    e.preventDefault();
    if (!marksData.student_id || !marksData.subject_name || !marksData.exam_type || !marksData.marks) return;

    setSubmitting(true);
    const { error: insertError } = await supabase.from("marks").insert({
      school_id: schoolId,
      student_id: marksData.student_id,
      subject_name: marksData.subject_name,
      exam_type: marksData.exam_type,
      marks: Number(marksData.marks),
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setError("");

    setMarksData({ student_id: "", subject_name: "", exam_type: "", marks: "" });

    // Reload existing marks
    if (selectedClass) {
      const { data: classStudents } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", selectedClass);

      const studentIds = (classStudents || []).map(s => s.id);

      if (studentIds.length > 0) {
        const { data } = await supabase
          .from("marks")
          .select("id, student_id, subject_name, exam_type, marks")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false });

        setExistingMarks(data || []);
      }
    }

    setSubmitting(false);
  }

  async function handleExcelImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!selectedClass) {
        alert("Please select a class first");
        return;
      }

      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      if (extension === "csv") {
        const text = await file.text();
        const { read, utils } = await import("xlsx");
        const workbook = read(text, { type: "string" });
        rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      } else {
        const buffer = await file.arrayBuffer();
        const { read, utils } = await import("xlsx");
        const workbook = read(buffer, { type: "array" });
        rows = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      }

      const marksToInsert = [];

      for (const row of rows) {
        const rollNumber = String(row["Roll Number"] ?? row["Roll No"] ?? row.roll_number ?? "").trim();
        const subjectName = String(row["Subject Name"] ?? row.Subject ?? row.subject_name ?? "").trim();
        const examType = String(row["Exam Type"] ?? row.Exam ?? row.exam_type ?? "").trim();
        const marks = String(row.Marks ?? row.marks ?? "").trim();

        if (!rollNumber || !subjectName || !examType || marks === "") {
          continue;
        }

        const student = students.find((s) => s.roll_number === rollNumber);
        if (!student) {
          console.warn(`Student with roll number ${rollNumber} not found`);
          continue;
        }

        marksToInsert.push({
          school_id: schoolId,
          student_id: student.id,
          subject_name: subjectName,
          exam_type: examType,
          marks: Number(marks),
        });
      }

      if (marksToInsert.length > 0) {
        const { error } = await supabase.from("marks").insert(marksToInsert);
        if (error) {
          setError(error.message);
          alert("Error importing marks: " + error.message);
        } else {
          setError("");
          alert(`Successfully imported ${marksToInsert.length} marks`);
          e.target.value = "";

          // Reload marks
          if (selectedClass) {
            const { data: classStudents } = await supabase
              .from("students")
              .select("id")
              .eq("class_id", selectedClass);

            const studentIds = (classStudents || []).map(s => s.id);

            if (studentIds.length > 0) {
              const { data } = await supabase
                .from("marks")
                .select("id, student_id, subject_name, exam_type, marks")
                .in("student_id", studentIds)
                .order("created_at", { ascending: false });

              setExistingMarks(data || []);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      alert("Error reading file: " + err.message);
    }
  }

  const getStudentName = (studentId) => {
    return students.find(s => s.id === studentId)?.full_name || "Unknown";
  };

  return (
    <div className="dashboard-card">
      <h2>Upload Marks</h2>
      {error ? <p className="error-text">{error}</p> : null}

      <label style={{ marginBottom: "16px" }}>
        <span>Select Class</span>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">-- choose class --</option>
          {classes.map((cl) => (
            <option key={cl.id} value={cl.id}>{`${cl.class_name} (${cl.section})`}</option>
          ))}
        </select>
      </label>

      {selectedClass && (
        <>
          <div style={{ marginBottom: "24px" }}>
            <h3>Import from Excel/CSV</h3>
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              Columns: Roll Number, Subject Name, Exam Type, Marks
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleExcelImport}
              style={{ marginBottom: "12px" }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <h3>Add Individual Mark</h3>
            <form className="auth-form" onSubmit={submitMarks}>
              <label>
                <span>Student</span>
                <select
                  value={marksData.student_id}
                  onChange={(e) => setMarksData((c) => ({ ...c, student_id: e.target.value }))}
                  required
                >
                  <option value="">-- choose student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input
                  value={marksData.subject_name}
                  onChange={(e) => setMarksData((c) => ({ ...c, subject_name: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Exam Type</span>
                <input
                  value={marksData.exam_type}
                  onChange={(e) => setMarksData((c) => ({ ...c, exam_type: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Marks</span>
                <input
                  type="number"
                  step="0.01"
                  value={marksData.marks}
                  onChange={(e) => setMarksData((c) => ({ ...c, marks: e.target.value }))}
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Marks"}
              </button>
            </form>
          </div>

          <div>
            <h3>Recent Marks</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Subject</th>
                    <th>Exam Type</th>
                    <th>Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {existingMarks.slice(0, 10).map((mark) => (
                    <tr key={mark.id}>
                      <td>{getStudentName(mark.student_id)}</td>
                      <td>{mark.subject_name}</td>
                      <td>{mark.exam_type}</td>
                      <td>{mark.marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
