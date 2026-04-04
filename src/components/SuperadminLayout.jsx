import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

export default function SuperadminLayout({ profile, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigation = [
    { name: 'Dashboard', href: '/superadmin', icon: '📊' },
    { name: 'Schools', href: '/superadmin/schools', icon: '🏫' },
    { name: 'Subscriptions', href: '/superadmin/subscriptions', icon: '💳' },
    { name: 'Audit Logs', href: '/superadmin/audit', icon: '📋' },
    { name: 'System Stats', href: '/superadmin/stats', icon: '📈' },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await onLogout();
      navigate('/login');
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--closed'}`}>
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '◁' : '▷'}
          </button>
          <h2 className={sidebarOpen ? '' : 'sr-only'}>Super Admin</h2>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
                title={sidebarOpen ? '' : item.name}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {sidebarOpen && <span className="sidebar-text">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">👑</div>
            {sidebarOpen && (
              <div className="user-details">
                <div className="user-name">{profile?.name}</div>
                <div className="user-role">Super Admin</div>
              </div>
            )}
          </div>
          <button
            className="logout-button"
            onClick={handleLogout}
            title={sidebarOpen ? '' : 'Logout'}
          >
            🚪 {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`main-content ${sidebarOpen ? 'main-content--sidebar-open' : 'main-content--sidebar-closed'}`}>
        <header className="main-header">
          <h1>Super Admin Panel</h1>
          <div className="header-actions">
            <span className="status-indicator status-indicator--online">
              System Online
            </span>
          </div>
        </header>

        <div className="main-body">
          <Outlet />
        </div>
      </main>

      <style jsx>{`
        .app-shell {
          display: flex;
          height: 100vh;
          background-color: #f8f9fa;
        }

        .sidebar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          width: 280px;
          transition: width 0.3s ease;
          display: flex;
          flex-direction: column;
          box-shadow: 2px 0 10px rgba(0,0,0,0.1);
        }

        .sidebar--closed {
          width: 70px;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 5px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .sidebar-toggle:hover {
          background-color: rgba(255,255,255,0.1);
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .sidebar-nav {
          flex: 1;
          padding: 20px 0;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          transition: all 0.2s;
          border-radius: 0 25px 25px 0;
          margin: 2px 10px 2px 0;
        }

        .sidebar-link:hover {
          background-color: rgba(255,255,255,0.1);
          color: white;
        }

        .sidebar-link--active {
          background-color: rgba(255,255,255,0.2);
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .sidebar-icon {
          font-size: 18px;
          margin-right: 12px;
          width: 20px;
          text-align: center;
        }

        .sidebar--closed .sidebar-icon {
          margin-right: 0;
        }

        .sidebar-text {
          font-weight: 500;
        }

        .sidebar-footer {
          padding: 20px;
          border-top: 1px solid rgba(255,255,255,0.2);
        }

        .user-info {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          margin-right: 12px;
        }

        .sidebar--closed .user-avatar {
          margin-right: 0;
        }

        .user-details {
          flex: 1;
        }

        .user-name {
          font-weight: 600;
          font-size: 14px;
        }

        .user-role {
          font-size: 12px;
          opacity: 0.8;
        }

        .logout-button {
          width: 100%;
          padding: 10px;
          background-color: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .logout-button:hover {
          background-color: rgba(255,255,255,0.2);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          transition: margin-left 0.3s ease;
        }

        .main-content--sidebar-open {
          margin-left: 0;
        }

        .main-content--sidebar-closed {
          margin-left: 0;
        }

        .main-header {
          background: white;
          padding: 20px 30px;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .main-header h1 {
          margin: 0;
          color: #2c3e50;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .status-indicator {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-indicator--online {
          background-color: #d4edda;
          color: #155724;
        }

        .main-body {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            z-index: 1000;
            height: 100vh;
          }

          .sidebar--closed {
            transform: translateX(-100%);
          }

          .main-content {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}