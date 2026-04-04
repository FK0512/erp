import { useOutletContext } from "react-router-dom";
import Homework from "../../components/Homework";

export default function StudentHomeworkPage() {
  const { student, loadingStudent, profile } = useOutletContext();

  if (loadingStudent) {
    return <section className="dashboard-card"><h2>Homework</h2><p>Loading homework...</p></section>;
  }

  if (!student) {
    return (
      <>
        <section className="dashboard-card">
          <h2>Homework</h2>
          <p>No linked student record was found, so personal class homework is unavailable right now.</p>
          <p>Showing school homework below until the account is linked to a student record.</p>
        </section>
        <Homework schoolId={profile?.school_id} schoolWideFallback />
      </>
    );
  }

  if (!student.class_id) {
    return (
      <>
        <section className="dashboard-card">
          <h2>Homework</h2>
          <p>Your student profile is not assigned to any class yet, so class-specific homework cannot be matched.</p>
          <p>Showing school homework below until a class is assigned.</p>
        </section>
        <Homework schoolId={profile?.school_id} schoolWideFallback />
      </>
    );
  }

  return (
    <>
      <section className="dashboard-card">
        <h2>Homework Class</h2>
        <p>
          Showing homework for Class {student.classes?.class_name ?? "-"}
          {student.classes?.section ? ` (${student.classes.section})` : ""}
        </p>
      </section>
      <Homework classId={student.class_id} schoolId={profile?.school_id} />
    </>
  );
}
