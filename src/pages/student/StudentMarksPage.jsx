import { useOutletContext } from "react-router-dom";
import Marks from "../../components/Marks";

export default function StudentMarksPage() {
  const { student, loadingStudent } = useOutletContext();

  if (loadingStudent) {
    return <section className="dashboard-card"><h2>Marks</h2><p>Loading marks...</p></section>;
  }

  if (!student) {
    return <section className="dashboard-card"><h2>Marks</h2><p>No linked student record found yet.</p></section>;
  }

  return <Marks studentId={student.id} />;
}
