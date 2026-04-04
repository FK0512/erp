import { useQuery } from '@tanstack/react-query';
import { supabase } from "../../lib/supabaseClient";

export default function AdminDashboard({ profile }) {
  const schoolId = profile?.school_id;

  // Attendance Summary
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    error: attendanceError
  } = useQuery({
    queryKey: ['admin-attendance-summary', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_attendance_summary')
        .select('*')
        .eq('school_id', schoolId)
        .order('class_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Fee Stats
  const {
    data: feeStats,
    isLoading: feesLoading,
    error: feeError
  } = useQuery({
    queryKey: ['admin-fee-stats', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_fee_summary')
        .select('total_fees, total_paid, total_due')
        .eq('school_id', schoolId);

      if (error) throw error;

      const totals = data?.reduce(
        (acc, item) => ({
          totalFees: acc.totalFees + (item.total_fees || 0),
          totalPaid: acc.totalPaid + (item.total_paid || 0),
          totalDue: acc.totalDue + (item.total_due || 0),
        }),
        { totalFees: 0, totalPaid: 0, totalDue: 0 }
      ) || { totalFees: 0, totalPaid: 0, totalDue: 0 };

      return totals;
    },
    enabled: !!schoolId,
  });

  // Basic Stats
  const {
    data: basicStats,
    isLoading: basicLoading
  } = useQuery({
    queryKey: ['admin-basic-stats', schoolId],
    queryFn: async () => {
      const [students, classes, staff] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .in('role', ['teacher', 'accountant', 'admin'])
      ]);

      return {
        totalStudents: students.count || 0,
        totalClasses: classes.count || 0,
        totalStaff: staff.count || 0,
      };
    },
    enabled: !!schoolId,
  });

  // Announcements
  const {
    data: announcements,
    isLoading: announcementsLoading
  } = useQuery({
    queryKey: ['admin-announcements', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,message,audience,created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const loading =
    attendanceLoading ||
    feesLoading ||
    basicLoading ||
    announcementsLoading;

  if (!profile) {
    return <p>Loading profile...</p>;
  }

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>

      {/* Metrics */}
      <section className="meta-grid" style={{ marginBottom: 16 }}>
        <article className="meta-tile">
          <span className="meta-label">Total Students</span>
          <strong>{basicStats?.totalStudents || 0}</strong>
        </article>

        <article className="meta-tile">
          <span className="meta-label">Total Classes</span>
          <strong>{basicStats?.totalClasses || 0}</strong>
        </article>

        <article className="meta-tile">
          <span className="meta-label">Fees Collected</span>
          <strong>₹ {(feeStats?.totalPaid ?? 0).toFixed(2)}</strong>
        </article>

        <article className="meta-tile">
          <span className="meta-label">Pending Fees</span>
          <strong>₹ {(feeStats?.totalDue ?? 0).toFixed(2)}</strong>
        </article>
      </section>

      {/* Attendance */}
      <section className="dashboard-card">
        <h2>Class-Wise Attendance Overview</h2>

        {attendanceError && (
          <div style={{
            padding: "12px",
            backgroundColor: "#fee",
            color: "#c33",
            borderRadius: "4px",
            marginBottom: "16px"
          }}>
            {attendanceError.message}
          </div>
        )}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Present</th>
                <th>Total</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData?.length > 0 ? (
                attendanceData.map((cls) => (
                  <tr key={cls.class_id}>
                    <td>{cls.class_name}</td>
                    <td>{cls.present_count || 0}</td>
                    <td>{cls.total_records || 0}</td>
                    <td>{cls.present_percentage || 0}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center" }}>
                    No attendance data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff */}
      <section className="dashboard-card">
        <h2>Staff Overview</h2>
        <p>Total Staff: {basicStats?.totalStaff || 0}</p>
      </section>

      {/* Announcements */}
      <section className="dashboard-card">
        <h2>Announcements</h2>

        {announcements?.length ? (
          announcements.map((a) => (
            <article key={a.id} className="dashboard-card" style={{ padding: "14px" }}>
              <strong>{a.title}</strong>
              <p>{a.message}</p>
              <small>Audience: {a.audience}</small><br />
              <small>{new Date(a.created_at).toLocaleDateString()}</small>
            </article>
          ))
        ) : (
          <p>No announcements yet.</p>
        )}
      </section>
    </div>
  );
}