import { useQuery } from '@tanstack/react-query';
import { supabase } from "../../lib/supabaseClient";
import { useState } from 'react';

export default function SuperadminDashboard() {
  const [timeRange, setTimeRange] = useState('30');

  // Fetch system overview stats
  const { data: systemStats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-system-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_overview_stats')
        .select('*')
        .order('school_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['superadmin-recent-activity', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recent_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate summary statistics
  const summaryStats = systemStats ? {
    totalSchools: systemStats.length,
    activeSchools: systemStats.filter(s => s.is_active).length,
    totalStudents: systemStats.reduce((sum, s) => sum + (s.total_students || 0), 0),
    totalRevenue: systemStats.reduce((sum, s) => sum + (s.total_paid || 0), 0),
    expiringSoon: systemStats.filter(s => {
      if (!s.subscription_end_date) return false;
      const daysUntilExpiry = Math.ceil(
        (new Date(s.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length,
  } : null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'attendance': return '📝';
      case 'fee_payment': return '💰';
      default: return '📋';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return '#28a745';
      case 'absent': return '#dc3545';
      case 'late': return '#ffc107';
      case 'leave': return '#6c757d';
      case 'cash': return '#28a745';
      case 'online': return '#007bff';
      case 'bank': return '#6f42c1';
      default: return '#6c757d';
    }
  };

  if (statsLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading system statistics...</p>
      </div>
    );
  }

  return (
    <div className="superadmin-dashboard">
      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🏫</div>
          <div className="stat-content">
            <h3>{summaryStats?.totalSchools || 0}</h3>
            <p>Total Schools</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{summaryStats?.activeSchools || 0}</h3>
            <p>Active Schools</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{summaryStats?.totalStudents || 0}</h3>
            <p>Total Students</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>{formatCurrency(summaryStats?.totalRevenue || 0)}</h3>
            <p>Total Revenue</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{summaryStats?.expiringSoon || 0}</h3>
            <p>Expiring Soon</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Schools Overview */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Schools Overview</h2>
            <div className="section-actions">
              <button className="btn btn-primary">Add School</button>
            </div>
          </div>

          <div className="schools-table-container">
            <table className="schools-table">
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Students</th>
                  <th>Revenue</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {systemStats?.map((school) => (
                  <tr key={school.school_id}>
                    <td>{school.school_name}</td>
                    <td>{school.school_code}</td>
                    <td>
                      <span className={`status-badge ${school.is_active ? 'active' : 'inactive'}`}>
                        {school.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{school.total_students || 0}</td>
                    <td>{formatCurrency(school.total_paid || 0)}</td>
                    <td>{formatDate(school.subscription_end_date)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-sm btn-outline">View</button>
                        <button className="btn btn-sm btn-outline">Edit</button>
                        <button className="btn btn-sm btn-danger">End Subscription</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Activity</h2>
            <div className="section-actions">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="time-range-select"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>

          <div className="activity-list">
            {activityLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading recent activity...</p>
              </div>
            ) : recentActivity?.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={`${activity.activity_type}-${activity.record_id}`} className="activity-item">
                  <div className="activity-icon">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">
                      {activity.activity_type === 'attendance'
                        ? `${activity.student_name} marked ${activity.status}`
                        : `${activity.student_name} paid ${activity.status}`
                      }
                    </div>
                    <div className="activity-meta">
                      {activity.class_name} • {formatDate(activity.activity_date)} • {activity.marked_by || 'System'}
                    </div>
                  </div>
                  <div className="activity-status">
                    <span
                      className="status-pill"
                      style={{ backgroundColor: getStatusColor(activity.status) }}
                    >
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No recent activity found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .superadmin-dashboard {
          max-width: 1400px;
          margin: 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
        }

        .stat-card.warning {
          border-left: 4px solid #ffc107;
        }

        .stat-icon {
          font-size: 32px;
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-content h3 {
          margin: 0 0 4px 0;
          font-size: 28px;
          font-weight: 700;
          color: #2c3e50;
        }

        .stat-content p {
          margin: 0;
          color: #6c757d;
          font-size: 14px;
          font-weight: 500;
        }

        .dashboard-content {
          display: grid;
          gap: 30px;
        }

        .dashboard-section {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          overflow: hidden;
        }

        .section-header {
          padding: 24px 24px 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .section-header h2 {
          margin: 0;
          color: #2c3e50;
          font-size: 20px;
          font-weight: 600;
        }

        .section-actions {
          display: flex;
          gap: 12px;
        }

        .schools-table-container {
          overflow-x: auto;
        }

        .schools-table {
          width: 100%;
          border-collapse: collapse;
        }

        .schools-table th,
        .schools-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
        }

        .schools-table th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.active {
          background-color: #d4edda;
          color: #155724;
        }

        .status-badge.inactive {
          background-color: #f8d7da;
          color: #721c24;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .activity-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .activity-item {
          display: flex;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid #e9ecef;
          transition: background-color 0.2s;
        }

        .activity-item:hover {
          background-color: #f8f9fa;
        }

        .activity-icon {
          font-size: 20px;
          margin-right: 16px;
          width: 32px;
          text-align: center;
        }

        .activity-content {
          flex: 1;
        }

        .activity-title {
          font-weight: 500;
          color: #2c3e50;
          margin-bottom: 4px;
        }

        .activity-meta {
          font-size: 14px;
          color: #6c757d;
        }

        .activity-status {
          margin-left: 16px;
        }

        .status-pill {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
        }

        .time-range-select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 6px;
          background: white;
          font-size: 14px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #6c757d;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: #007bff;
          color: white;
        }

        .btn-primary:hover {
          background-color: #0056b3;
        }

        .btn-outline {
          background-color: transparent;
          border: 1px solid #6c757d;
          color: #6c757d;
        }

        .btn-outline:hover {
          background-color: #6c757d;
          color: white;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn-danger:hover {
          background-color: #c82333;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}