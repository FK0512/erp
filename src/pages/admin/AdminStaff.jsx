import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminStaff({ profile }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    supabase
      .from("user_profiles")
      .select("id,name,email,role,created_at")
      .eq("school_id", schoolId)
      .in("role", ["teacher", "accountant", "admin"])
      .order("created_at", { ascending: true })
      .then(({ data }) => setStaff(data || []))
      .finally(() => setLoading(false));
  }, [schoolId]);

  return (
    <div>
      <h1>Staff List</h1>
      {loading ? <p>Loading staff...</p> : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>{s.role}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
