import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherViewStudents({ profile }) {
  const [classes, setClasses] = useState([]);
  const [classesError, setClassesError] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsError, setStudentsError] = useState("");
  const [loading, setLoading] = useState(false);

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) {
      setClassesError("School ID not found in profile");
      return;
    }

    async function loadClasses() {
      setClassesError("");
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_name, section")
        .eq("school_id", schoolId)
        .order("class_name", { ascending: true });
      
      if (error) {
        setClassesError(`Failed to load classes: ${error.message}`);
        setClasses([]);
      } else {
        setClasses(data || []);
      }
    }

    loadClasses();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setStudentsError("");
      return;
    }

    async function loadStudents() {
      setLoading(true);
      setStudentsError("");
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, roll_number, admission_number, gender, guardian_name, guardian_phone")
        .eq("class_id", selectedClass)
        .order("roll_number", { ascending: true });

      if (error) {
        setStudentsError(`Failed to load students: ${error.message}`);
        setStudents([]);
      } else {
        setStudents(data || []);
        if (!data || data.length === 0) {
          setStudentsError("No students found in this class");
        }
      }
      setLoading(false);
    }

    loadStudents();
  }, [selectedClass]);

  return (
    <div className="dashboard-card">
      <h2>View Class Students</h2>

      {classesError && (
        <div style={{ padding: "12px", backgroundColor: "#fee", color: "#c33", borderRadius: "4px", marginBottom: "16px" }}>
          {classesError}
        </div>
      )}

      <label style={{ marginBottom: "16px" }}>
        <span>Select Class</span>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">-- choose class --</option>
          {classes.map((cl) => (
            <option key={cl.id} value={cl.id}>{`${cl.class_name} (${cl.section})`}</option>
          ))}
        </select>
      </label>

      {studentsError && (
        <div style={{ padding: "12px", backgroundColor: "#fee", color: "#c33", borderRadius: "4px", marginBottom: "16px" }}>
          {studentsError}
        </div>
      )}

      {selectedClass && (
        <>
          {loading ? (
            <p>Loading students...</p>
          ) : (
            <div className="table-scroll">
              {students.length === 0 ? (
                <p style={{ textAlign: "center", color: "#666", padding: "20px" }}>No students found in this class. Verify students are assigned to this class.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Name</th>
                      <th>Admission#</th>
                      <th>Gender</th>
                      <th>Guardian</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.roll_number}</td>
                        <td>{s.full_name}</td>
                        <td>{s.admission_number || "N/A"}</td>
                        <td>{s.gender || "N/A"}</td>
                        <td>{s.guardian_name || "N/A"}</td>
                        <td>{s.guardian_phone || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
