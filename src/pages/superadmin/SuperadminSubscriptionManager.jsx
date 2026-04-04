import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

export default function SuperadminSubscriptionManager() {
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [extendDays, setExtendDays] = useState(30);
  const queryClient = useQueryClient();

  // Fetch all schools with subscription info
  const { data: schools, isLoading } = useQuery({
    queryKey: ['superadmin-schools-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, school_code, subscription_start_date, subscription_end_date, is_active')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  // Extend subscription mutation
  const extendMutation = useMutation({
    mutationFn: async ({ schoolId, days }) => {
      const { data, error } = await supabase.rpc('superadmin_extend_subscription', {
        p_school_id: schoolId,
        p_days: days
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['superadmin-schools-subscriptions']);
      alert('Subscription extended successfully!');
    },
    onError: (error) => {
      alert(`Failed to extend subscription: ${error.message}`);
    },
  });

  // End subscription mutation
  const endMutation = useMutation({
    mutationFn: async (schoolId) => {
      const { data, error } = await supabase.rpc('superadmin_end_subscription', {
        p_school_id: schoolId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['superadmin-schools-subscriptions']);
      alert('Subscription ended successfully!');
    },
    onError: (error) => {
      alert(`Failed to end subscription: ${error.message}`);
    },
  });

  const handleExtendSubscription = (schoolId) => {
    if (window.confirm(`Extend subscription by ${extendDays} days?`)) {
      extendMutation.mutate({ schoolId, days: extendDays });
    }
  };

  const handleEndSubscription = (schoolId) => {
    const school = schools.find(s => s.id === schoolId);
    if (window.confirm(`Are you sure you want to end the subscription for ${school.name}? This will immediately block access for all users.`)) {
      endMutation.mutate(schoolId);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiry = (endDate) => {
    if (!endDate) return null;
    const today = new Date();
    const expiry = new Date(endDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getSubscriptionStatus = (school) => {
    if (!school.is_active) return { status: 'inactive', color: '#dc3545' };
    if (!school.subscription_end_date) return { status: 'no expiry', color: '#6c757d' };

    const daysLeft = getDaysUntilExpiry(school.subscription_end_date);
    if (daysLeft < 0) return { status: 'expired', color: '#dc3545' };
    if (daysLeft <= 7) return { status: 'critical', color: '#fd7e14' };
    if (daysLeft <= 30) return { status: 'warning', color: '#ffc107' };
    return { status: 'active', color: '#28a745' };
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading subscription data...</p>
      </div>
    );
  }

  return (
    <div className="subscription-manager">
      <div className="manager-header">
        <h1>Subscription Management</h1>
        <div className="header-controls">
          <label>
            Extend by:
            <select
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              className="days-select"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
        </div>
      </div>

      <div className="stats-overview">
        <div className="stat-item">
          <span className="stat-number">{schools?.length || 0}</span>
          <span className="stat-label">Total Schools</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">
            {schools?.filter(s => s.is_active).length || 0}
          </span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-item warning">
          <span className="stat-number">
            {schools?.filter(s => {
              const status = getSubscriptionStatus(s);
              return status.status === 'critical' || status.status === 'expired';
            }).length || 0}
          </span>
          <span className="stat-label">Critical</span>
        </div>
      </div>

      <div className="schools-list">
        <div className="list-header">
          <h2>School Subscriptions</h2>
          <div className="filters">
            <button className="filter-btn active">All</button>
            <button className="filter-btn">Active</button>
            <button className="filter-btn">Expiring Soon</button>
            <button className="filter-btn">Expired</button>
          </div>
        </div>

        <div className="schools-grid">
          {schools?.map((school) => {
            const subscriptionStatus = getSubscriptionStatus(school);
            const daysLeft = getDaysUntilExpiry(school.subscription_end_date);

            return (
              <div key={school.id} className="school-card">
                <div className="school-header">
                  <div className="school-info">
                    <h3>{school.name}</h3>
                    <span className="school-code">{school.school_code}</span>
                  </div>
                  <div className="status-indicator">
                    <span
                      className="status-badge"
                      style={{ backgroundColor: subscriptionStatus.color }}
                    >
                      {subscriptionStatus.status}
                    </span>
                  </div>
                </div>

                <div className="subscription-details">
                  <div className="detail-row">
                    <span className="label">Start Date:</span>
                    <span className="value">{formatDate(school.subscription_start_date)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">End Date:</span>
                    <span className="value">{formatDate(school.subscription_end_date)}</span>
                  </div>
                  {daysLeft !== null && (
                    <div className="detail-row">
                      <span className="label">Days Left:</span>
                      <span className={`value ${daysLeft <= 30 ? 'warning' : ''} ${daysLeft < 0 ? 'expired' : ''}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleExtendSubscription(school.id)}
                    disabled={extendMutation.isPending}
                  >
                    {extendMutation.isPending ? 'Extending...' : `Extend ${extendDays} days`}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleEndSubscription(school.id)}
                    disabled={endMutation.isPending}
                  >
                    {endMutation.isPending ? 'Ending...' : 'End Subscription'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .subscription-manager {
          max-width: 1200px;
          margin: 0 auto;
        }

        .manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .manager-header h1 {
          margin: 0;
          color: #2c3e50;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-controls label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: #495057;
        }

        .days-select {
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 6px;
          background: white;
          font-size: 14px;
        }

        .stats-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-item {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          text-align: center;
        }

        .stat-item.warning {
          border-left: 4px solid #ffc107;
        }

        .stat-number {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 4px;
        }

        .stat-label {
          color: #6c757d;
          font-size: 14px;
          font-weight: 500;
        }

        .schools-list {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          overflow: hidden;
        }

        .list-header {
          padding: 24px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .list-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .filters {
          display: flex;
          gap: 8px;
        }

        .filter-btn {
          padding: 8px 16px;
          border: 1px solid #ced4da;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .filter-btn.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .schools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
          padding: 24px;
        }

        .school-card {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          transition: box-shadow 0.2s;
        }

        .school-card:hover {
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .school-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .school-info h3 {
          margin: 0 0 4px 0;
          color: #2c3e50;
          font-size: 18px;
        }

        .school-code {
          color: #6c757d;
          font-size: 14px;
          font-weight: 500;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .subscription-details {
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .detail-row .label {
          color: #6c757d;
          font-weight: 500;
        }

        .detail-row .value {
          color: #2c3e50;
          font-weight: 600;
        }

        .detail-row .value.warning {
          color: #ffc107;
        }

        .detail-row .value.expired {
          color: #dc3545;
        }

        .card-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          flex: 1;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: #28a745;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #218838;
        }

        .btn-danger {
          background-color: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: #c82333;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: #6c757d;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 5px solid #f3f3f3;
          border-top: 5px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .schools-grid {
            grid-template-columns: 1fr;
          }

          .manager-header {
            flex-direction: column;
            gap: 20px;
            align-items: flex-start;
          }

          .list-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .filters {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}