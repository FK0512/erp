import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminReports({ profile }) {
  const [data, setData] = useState({ students: 0, attendance: 0 });
  const [reportCards, setReportCards] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;

    async function load() {
      const [{ count: studentCount }, { data: attendanceData }, { data: classesData }] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("attendance").select("status").eq("school_id", schoolId),
        supabase.from("classes").select("id,class_name").eq("school_id", schoolId).order("class_name"),
      ]);

      const attendanceRows = attendanceData || [];
      const present = attendanceRows.filter((row) => row.status === "present").length;
      const attendancePercent = attendanceRows.length ? Math.round((present / attendanceRows.length) * 100) : 0;

      setData({
        students: studentCount || 0,
        attendance: attendancePercent,
      });
      setClasses(classesData || []);
    }

    load();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setSelectedStudent("");
      return;
    }

    async function loadStudents() {
      const { data } = await supabase
        .from("students")
        .select("id,full_name,roll_number")
        .eq("class_id", selectedClass)
        .order("roll_number");

      setStudents(data || []);
    }

    loadStudents();
  }, [selectedClass]);

  useEffect(() => {
    loadReportCards();
  }, [schoolId]);

  async function loadReportCards() {
    if (!schoolId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("report_cards")
      .select(`
        id,
        student_id,
        academic_year,
        class_name,
        student_name,
        roll_number,
        total_marks,
        percentage,
        grade,
        generated_at
      `)
      .eq("school_id", schoolId)
      .order("generated_at", { ascending: false });

    if (!error) {
      setReportCards(data || []);
    }
    setLoading(false);
  }

  async function generateReportCard() {
    if (!selectedStudent) return;

    setGenerating(true);
    try {
      // Get student details and marks
      const { data: studentData } = await supabase
        .from("students")
        .select("id,full_name,roll_number,class_id")
        .eq("id", selectedStudent)
        .single();

      // Get class details
      const { data: classData } = await supabase
        .from("classes")
        .select("class_name,section")
        .eq("id", studentData.class_id)
        .single();

      const { data: marksData } = await supabase
        .from("marks")
        .select("subject_name,marks,exam_type")
        .eq("student_id", selectedStudent);

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", selectedStudent);

      // Calculate totals
      const totalMarks = (marksData || []).reduce((sum, mark) => sum + Number(mark.marks || 0), 0);
      const totalAttendance = attendanceData?.length || 0;
      const presentCount = attendanceData?.filter(a => a.status === "present").length || 0;
      const attendancePercent = totalAttendance ? Math.round((presentCount / totalAttendance) * 100) : 0;

      // Calculate grade based on percentage
      const percentage = marksData?.length ? Math.round((totalMarks / (marksData.length * 100)) * 100) : 0;
      let grade = "F";
      if (percentage >= 90) grade = "A+";
      else if (percentage >= 80) grade = "A";
      else if (percentage >= 70) grade = "B+";
      else if (percentage >= 60) grade = "B";
      else if (percentage >= 50) grade = "C";

      // Insert or update report card
      const { error } = await supabase.from("report_cards").upsert({
        school_id: schoolId,
        student_id: selectedStudent,
        academic_year: new Date().getFullYear().toString(),
        class_name: classData.class_name,
        student_name: studentData.full_name,
        roll_number: studentData.roll_number,
        subjects_data: marksData || [],
        total_marks: totalMarks,
        obtained_marks: totalMarks,
        percentage,
        grade,
        attendance_percentage: attendancePercent,
        total_working_days: totalAttendance,
        days_present: presentCount,
        generated_by: profile?.id,
      }, {
        onConflict: 'student_id,academic_year'
      });

      if (!error) {
        alert("Report card generated/updated successfully!");
        setSelectedStudent("");
        loadReportCards();
      } else {
        alert(`Error generating report card: ${error.message}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    setGenerating(false);
  }

  return (
    <div>
      <h1>Reports</h1>
      <section className="meta-grid">
        <article className="meta-tile"><span className="meta-label">Total Students</span><strong>{data.students}</strong></article>
        <article className="meta-tile"><span className="meta-label">Attendance %</span><strong>{data.attendance}%</strong></article>
      </section>

      <section className="dashboard-card">
        <h2>Generate Report Card</h2>
        <div className="auth-form">
          <label>
            <span>Select Class</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">-- Choose Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.class_name}</option>
              ))}
            </select>
          </label>

          {selectedClass && (
            <label>
              <span>Select Student</span>
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="">-- Choose Student --</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.roll_number} - {student.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            className="primary-button"
            onClick={generateReportCard}
            disabled={!selectedStudent || generating}
          >
            {generating ? "Generating..." : "Generate Report Card"}
          </button>
        </div>
      </section>

      <section className="dashboard-card">
        <h2>Generated Report Cards</h2>
        {loading ? <p>Loading report cards...</p> : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Academic Year</th>
                  <th>Total Marks</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Generated On</th>
                </tr>
              </thead>
              <tbody>
                {reportCards.map((card) => (
                  <tr key={card.id}>
                    <td>{card.student_name} ({card.roll_number})</td>
                    <td>{card.class_name}</td>
                    <td>{card.academic_year}</td>
                    <td>{card.total_marks}</td>
                    <td>{card.percentage}%</td>
                    <td>{card.grade}</td>
                    <td>{new Date(card.generated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
