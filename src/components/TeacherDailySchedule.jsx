import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function TeacherDailySchedule({ profile }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [dailySchedule, setDailySchedule] = useState({
    day_name: "Monday",
    subject_name: "",
    start_time: "08:00",
    end_time: "09:00",
    room_label: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  const schoolId = profile?.school_id;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
      setSchedules([]);
      return;
    }

    async function loadSchedules() {
      setLoading(true);
      const { data } = await supabase
        .from("daily_schedule")
        .select("id, day_name, subject_name, start_time, end_time, room_label")
        .eq("class_id", selectedClass)
        .order("day_name", { ascending: true });

      setSchedules(data || []);
      setLoading(false);
    }

    loadSchedules();
  }, [selectedClass]);

  async function createSchedule(e) {
    e.preventDefault();
    if (!selectedClass || !dailySchedule.subject_name) return;

    setSubmitting(true);
    await supabase.from("daily_schedule").insert({
      school_id: schoolId,
      class_id: selectedClass,
      teacher_profile_id: profile?.id,
      day_name: dailySchedule.day_name,
      subject_name: dailySchedule.subject_name,
      start_time: dailySchedule.start_time,
      end_time: dailySchedule.end_time,
      room_label: dailySchedule.room_label || null,
    });

    setDailySchedule({
      day_name: dailySchedule.day_name,
      subject_name: "",
      start_time: "08:00",
      end_time: "09:00",
      room_label: "",
    });

    // Reload schedules
    const { data } = await supabase
      .from("daily_schedule")
      .select("id, day_name, subject_name, start_time, end_time, room_label")
      .eq("class_id", selectedClass)
      .order("day_name", { ascending: true });

    setSchedules(data || []);
    setSubmitting(false);
  }

  async function deleteSchedule(scheduleId) {
    if (!confirm("Delete this schedule entry?")) return;

    await supabase.from("daily_schedule").delete().eq("id", scheduleId);

    // Reload schedules
    const { data } = await supabase
      .from("daily_schedule")
      .select("id, day_name, subject_name, start_time, end_time, room_label")
      .eq("class_id", selectedClass)
      .order("day_name", { ascending: true });

    setSchedules(data || []);
  }

  // Group schedules by day
  const schedulesByDay = days.reduce((acc, day) => {
    acc[day] = schedules.filter(s => s.day_name === day);
    return acc;
  }, {});

  return (
    <div className="dashboard-card">
      <h2>Daily Schedule</h2>

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
            <h3>Add Schedule Entry</h3>
            <form className="auth-form" onSubmit={createSchedule}>
              <label>
                <span>Day</span>
                <select
                  value={dailySchedule.day_name}
                  onChange={(e) => setDailySchedule((c) => ({ ...c, day_name: e.target.value }))}
                >
                  {days.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input
                  value={dailySchedule.subject_name}
                  onChange={(e) => setDailySchedule((c) => ({ ...c, subject_name: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Start Time</span>
                <input
                  type="time"
                  value={dailySchedule.start_time}
                  onChange={(e) => setDailySchedule((c) => ({ ...c, start_time: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>End Time</span>
                <input
                  type="time"
                  value={dailySchedule.end_time}
                  onChange={(e) => setDailySchedule((c) => ({ ...c, end_time: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Room/Location (optional)</span>
                <input
                  value={dailySchedule.room_label}
                  onChange={(e) => setDailySchedule((c) => ({ ...c, room_label: e.target.value }))}
                  placeholder="e.g., Room 101"
                />
              </label>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add Entry"}
              </button>
            </form>
          </div>

          <div>
            <h3>Weekly Schedule</h3>
            {loading ? (
              <p>Loading schedule...</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Subject</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Room</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) =>
                      schedulesByDay[day].map((schedule) => (
                        <tr key={schedule.id}>
                          <td>{day}</td>
                          <td>{schedule.subject_name}</td>
                          <td>{schedule.start_time}</td>
                          <td>{schedule.end_time}</td>
                          <td>{schedule.room_label || "N/A"}</td>
                          <td>
                            <button
                              onClick={() => deleteSchedule(schedule.id)}
                              style={{
                                background: "#dc3545",
                                color: "#fff",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
