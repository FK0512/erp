import { useOutletContext } from "react-router-dom";
import AttendanceStatus from "../../components/AttendanceStatus";

export default function StudentAttendancePage() {
  const { student, loadingStudent, profile } = useOutletContext();

  if (loadingStudent) {
    return (
      <section className="dashboard-card">
        <h2>Attendance Status</h2>
        <p className="body-copy">Loading your student records...</p>
      </section>
    );
  }

  if (!student) {
    return (
      <section className="dashboard-card">
        <h2>Student Profile Pending</h2>
        <p className="body-copy">
          Your account is active, but no linked row exists in the `students`
          table yet.
        </p>
        <div className="meta-grid">
          <article className="meta-tile">
            <span className="meta-label">Student Name</span>
            <strong>{profile?.name ?? "Not available"}</strong>
          </article>
          <article className="meta-tile">
            <span className="meta-label">School</span>
            <strong>{profile?.school?.name ?? "Not available"}</strong>
          </article>
          <article className="meta-tile">
            <span className="meta-label">Status</span>
            <strong>Awaiting student record setup</strong>
          </article>
        </div>
      </section>
    );
  }

  return <AttendanceStatus studentId={student.id} />;
}
