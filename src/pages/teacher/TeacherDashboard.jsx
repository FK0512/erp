import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function TeacherDashboard({ profile }) {
  const legacyAttendanceSubject = "General";
  const legacyAttendancePeriod = "1";
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [activeTab, setActiveTab] = useState("attendance");

  const [homeworkText, setHomeworkText] = useState("");
  const [marksData, setMarksData] = useState({ student_id: "", subject_name: "", exam_type: "", marks: "" });
  const [dailySchedule, setDailySchedule] = useState({ day_name: "Monday", subject_name: "", start_time: "08:00", end_time: "09:00" });

  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;

    async function loadClasses() {
      const { data } = await supabase
        .from("classes")
        .select("id,class_name,section")
        .eq("school_id", schoolId)
        .order("class_name", { ascending: true });
      setClasses(data || []);
    }

    loadClasses();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    async function loadStudents() {
      const { data } = await supabase
        .from("students")
        .select("id,full_name,roll_number")
        .eq("class_id", selectedClass)
        .order("roll_number", { ascending: true });

      setStudents(data || []);
      const today = new Date().toISOString().slice(0, 10);

      const { data: attendanceRows } = await supabase
        .from("attendance")
        .select("student_id,status")
        .eq("class_id", selectedClass)
        .eq("attendance_date", today)
        .eq("subject", legacyAttendanceSubject)
        .eq("period", legacyAttendancePeriod);

      const attendanceMap = {};
      (attendanceRows || []).forEach((row) => (attendanceMap[row.student_id] = row.status));
      setAttendance(attendanceMap);
    }

    loadStudents();
  }, [selectedClass]);

  const invalidSubmit = useMemo(
    () => !selectedClass || students.length === 0,
    [selectedClass, students]
  );

  async function saveAttendance() {
    if (!selectedClass) return;
    setSavingAttendance(true);

    const today = new Date().toISOString().slice(0, 10);
    const payload = students.map((student) => ({
      school_id: schoolId,
      class_id: selectedClass,
      student_id: student.id,
      attendance_date: today,
      status: attendance[student.id] || "absent",
      marked_by: profile?.id,
      subject: legacyAttendanceSubject,
      period: legacyAttendancePeriod,
    }));

    await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "student_id,attendance_date,class_id,subject,period" });

    setSavingAttendance(false);
  }

  async function postHomework(e) {
    e.preventDefault();
    if (!selectedClass || !homeworkText.trim()) return;

    await supabase.from("homework").insert({
      school_id: schoolId,
      class_id: selectedClass,
      title: `Homework ${new Date().toLocaleDateString()}`,
      description: homeworkText.trim(),
      created_by: profile?.id,
    });

    setHomeworkText("");
  }

  async function submitMarks(e) {
    e.preventDefault();
    if (!marksData.student_id || !marksData.subject_name || !marksData.exam_type) return;

    await supabase.from("marks").insert({
      school_id: schoolId,
      student_id: marksData.student_id,
      subject_name: marksData.subject_name,
      exam_type: marksData.exam_type,
      marks: Number(marksData.marks),
    });

    setMarksData({ student_id: "", subject_name: "", exam_type: "", marks: "" });
  }

  async function createSchedule(e) {
    e.preventDefault();
    if (!selectedClass || !dailySchedule.subject_name) return;

    await supabase.from("daily_schedule").insert({
      school_id: schoolId,
      class_id: selectedClass,
      teacher_profile_id: profile?.id,
      ...dailySchedule,
    });

    setDailySchedule({ ...dailySchedule, subject_name: "", start_time: "08:00", end_time: "09:00" });
  }

  return (
    <div>
      <h1>Teacher Dashboard</h1>

      <section className="dashboard-card">
        <label>
          <span>Select Class</span>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">-- choose --</option>
            {classes.map((cl) => (
              <option key={cl.id} value={cl.id}>{`${cl.class_name} (${cl.section})`}</option>
            ))}
          </select>
        </label>
      </section>

      {selectedClass ? (
        <>
          <section className="dashboard-card">
            <h2>Attendance Marking</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Roll</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.full_name}</td>
                      <td>{s.roll_number}</td>
                      <td>
                        <select
                          value={attendance[s.id] || "absent"}
                          onChange={(e) => setAttendance((cur) => ({ ...cur, [s.id]: e.target.value }))}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="primary-button" onClick={saveAttendance} disabled={invalidSubmit || savingAttendance}>
              {savingAttendance ? "Saving..." : "Save Attendance"}
            </button>
          </section>

          <section className="dashboard-card">
            <h2>Upload Marks</h2>
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
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input value={marksData.subject_name} onChange={(e) => setMarksData((c) => ({ ...c, subject_name: e.target.value }))} required />
              </label>
              <label>
                <span>Exam Type</span>
                <input value={marksData.exam_type} onChange={(e) => setMarksData((c) => ({ ...c, exam_type: e.target.value }))} required />
              </label>
              <label>
                <span>Marks</span>
                <input type="number" value={marksData.marks} onChange={(e) => setMarksData((c) => ({ ...c, marks: e.target.value }))} required />
              </label>
              <button className="primary-button" type="submit">Submit Marks</button>
            </form>
          </section>

          <section className="dashboard-card">
            <h2>Homework / Notices</h2>
            <form className="auth-form" onSubmit={postHomework}>
              <label>
                <span>Homework Description</span>
                <textarea value={homeworkText} onChange={(e) => setHomeworkText(e.target.value)} rows={3} required />
              </label>
              <button className="primary-button" type="submit">Publish Homework</button>
            </form>
          </section>

          <section className="dashboard-card">
            <h2>Daily Schedule</h2>
            <form className="auth-form" onSubmit={createSchedule}>
              <label>
                <span>Day</span>
                <select value={dailySchedule.day_name} onChange={(e) => setDailySchedule((c) => ({ ...c, day_name: e.target.value }))}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input value={dailySchedule.subject_name} onChange={(e) => setDailySchedule((c) => ({ ...c, subject_name: e.target.value }))} required />
              </label>
              <label>
                <span>Start</span>
                <input type="time" value={dailySchedule.start_time} onChange={(e) => setDailySchedule((c) => ({ ...c, start_time: e.target.value }))} required />
              </label>
              <label>
                <span>End</span>
                <input type="time" value={dailySchedule.end_time} onChange={(e) => setDailySchedule((c) => ({ ...c, end_time: e.target.value }))} required />
              </label>
              <button className="primary-button" type="submit">Save Schedule</button>
            </form>
          </section>
        </>
      ) : (
        <p>Please select a class to proceed.</p>
      )}
    </div>
  );
}
