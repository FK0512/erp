import { useOutletContext } from "react-router-dom";
import FeeStatus from "../../components/FeeStatus";

export default function StudentFeesPage() {
  const { student, loadingStudent } = useOutletContext();

  if (loadingStudent) {
    return <section className="dashboard-card"><h2>Fee Status</h2><p>Loading fee records...</p></section>;
  }

  if (!student) {
    return <section className="dashboard-card"><h2>Fee Status</h2><p>No linked student record found yet.</p></section>;
  }

  return <FeeStatus studentId={student.id} />;
}
