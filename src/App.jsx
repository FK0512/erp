import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { useSubscriptionGuard } from "./hooks/useSubscriptionGuard";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';

import { AdminLayout } from "./components/AdminLayout";
import { TeacherLayout } from "./components/TeacherLayout";
import { StudentLayout } from "./components/StudentLayout";
import SuperadminLayout from "./components/SuperadminLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentManagement from "./pages/admin/StudentManagement";
import AdminFees from "./pages/admin/AdminFees";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminReports from "./pages/admin/AdminReports";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentAttendancePage from "./pages/student/StudentAttendancePage";
import StudentFeesPage from "./pages/student/StudentFeesPage";
import StudentHomeworkPage from "./pages/student/StudentHomeworkPage";
import StudentNoticesPage from "./pages/student/StudentNoticesPage";
import StudentMarksPage from "./pages/student/StudentMarksPage";
import AccountantDashboard from "./pages/accountant/AccountantDashboard";
import SuperadminDashboard from "./pages/superadmin/SuperadminDashboard";
import SuperadminSubscriptionManager from "./pages/superadmin/SuperadminSubscriptionManager";

const emptyLoginForm = {
  email: "",
  password: "",
};

const emptySignupForm = {
  name: "",
  email: "",
  password: "",
  schoolCode: "",
  schoolName: "",
  role: "student",
  className: "",
  section: "A",
};

const roleDescriptions = {
  admin: "Manage users, schools, billing, and the overall ERP setup.",
  teacher: "Handle classes, attendance, and academic workflows.",
  student: "Access personal academic records and announcements.",
  accountant: "Track fees, due amounts, and payment records.",
  superadmin: "Manage all schools, subscriptions, and system-wide operations.",
};

function getDefaultRoute(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/student";
    case "accountant":
      return "/accountant";
    case "superadmin":
      return "/superadmin";
    default:
      return "/dashboard";
  }
}

function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getFriendlyErrorMessage(error) {
  const message = error?.message || "Something went wrong. Please try again.";

  if (message.toLowerCase().includes("stack depth limit exceeded")) {
    return "Something went wrong while loading your account. Please try again.";
  }

  return message;
}

function RolePanel({ profile }) {
  const content = {
    admin: {
      title: "Admin Console",
      items: [
        "Create school staff invitations and control role assignments.",
        "Manage subscriptions and re-activate a school every 30 days.",
        "Review school-wide users, classes, and ERP settings.",
      ],
    },
    teacher: {
      title: "Teacher Workspace",
      items: [
        "Mark daily attendance for assigned classes.",
        "Post announcements and update student records.",
        "Prepare marks and subject-level academic data.",
      ],
    },
    student: {
      title: "Student Portal",
      items: [
        "View personal attendance, marks, and announcements.",
        "Track fee status and due dates.",
        "Access school updates from one secure account.",
      ],
    },
    accountant: {
      title: "Accounts Desk",
      items: [
        "Manage student fee ledgers and payment entries.",
        "Monitor due balances and paid amounts.",
        "Support school subscription and finance workflows.",
      ],
    },
    superadmin: {
      title: "Super Admin Control",
      items: [
        "Manage all schools and their subscriptions.",
        "Monitor system-wide statistics and performance.",
        "Access audit logs and system administration.",
      ],
    },
  };

  const panel = content[profile.role] ?? {
    title: "ERP Dashboard",
    items: ["Role-specific modules will appear here."],
  };

  return (
    <section className="dashboard-card">
      <p className="eyebrow">Role Based Access</p>
      <h2>{panel.title}</h2>
      <p className="body-copy">{roleDescriptions[profile.role]}</p>
      <div className="meta-grid">
        <div className="meta-tile">
          <span className="meta-label">Name</span>
          <strong>{profile.name}</strong>
        </div>
        <div className="meta-tile">
          <span className="meta-label">Role</span>
          <strong className="role-pill">{profile.role}</strong>
        </div>
        <div className="meta-tile">
          <span className="meta-label">School</span>
          <strong>{profile.school?.name ?? "Unknown school"}</strong>
        </div>
        <div className="meta-tile">
          <span className="meta-label">School Code</span>
          <strong>{profile.school?.school_code ?? "Pending"}</strong>
        </div>
        <div className="meta-tile">
          <span className="meta-label">Subscription Ends</span>
          <strong>{formatDate(profile.school?.subscription_end_date)}</strong>
        </div>
      </div>
      <ul className="feature-list">
        {panel.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ProtectedRoute({ session, loading }) {
  if (loading) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="status-line">Loading session...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RoleProtected({ profile, loading, allowedRoles }) {
  if (loading || !profile) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="status-line">Loading profile and permissions...</p>
        </section>
      </main>
    );
  }

  if (!allowedRoles.includes(profile.role)) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <h1>Unauthorized</h1>
          <p>You don\'t have permission to view this section.</p>
          <p>Your role: <strong>{profile.role}</strong></p>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

function AuthPage({
  loading,
  busy,
  message,
  errorText,
  mode,
  setMode,
  loginForm,
  signupForm,
  updateLoginField,
  updateSignupField,
  handleLogin,
  handleSignup,
}) {
  return (
    <main className="app-shell">
      <section className="hero-card hero-card--wide">
        <div className="hero-header">
          <div>
            <p className="eyebrow">School ERP Authentication</p>
            <h1>School ERP Login</h1>
          </div>
        </div>
        {loading ? <p className="status-line">Loading session...</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        {errorText ? <p className="error-text">{errorText}</p> : null}

        <div className="auth-layout">
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "tab-button active" : "tab-button"}
              onClick={() => setMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === "signup" ? "tab-button active" : "tab-button"}
              onClick={() => setMode("signup")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {mode === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={updateLoginField}
                  placeholder="admin@school.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={updateLoginField}
                  placeholder="Enter your password"
                  required
                  minLength={8}
                />
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Login"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignup}>
              <label>
                <span>Full Name</span>
                <input
                  name="name"
                  type="text"
                  value={signupForm.name}
                  onChange={updateSignupField}
                  placeholder="Aarav Sharma"
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  value={signupForm.email}
                  onChange={updateSignupField}
                  placeholder="teacher@school.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={signupForm.password}
                  onChange={updateSignupField}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
              </label>
              {signupForm.role === "admin" ? (
                <label>
                  <span>School Name</span>
                  <input
                    name="schoolName"
                    type="text"
                    value={signupForm.schoolName}
                    onChange={updateSignupField}
                    placeholder="Enter your school name"
                    required
                  />
                </label>
              ) : (
                <label>
                  <span>School Code</span>
                  <input
                    name="schoolCode"
                    type="text"
                    value={signupForm.schoolCode}
                    onChange={updateSignupField}
                    placeholder="Enter school code like SCH1001"
                    required
                  />
                </label>
              )}
              <label>
                <span>Role</span>
                <select name="role" value={signupForm.role} onChange={updateSignupField}>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                  <option value="accountant">Accountant</option>
                </select>
              </label>
              {signupForm.role === "student" ? (
                <>
                  <label>
                    <span>Class</span>
                    <select
                      name="className"
                      value={signupForm.className}
                      onChange={updateSignupField}
                      required
                    >
                      <option value="">-- Select Class --</option>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((className) => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Section</span>
                    <select
                      name="section"
                      value={signupForm.section}
                      onChange={updateSignupField}
                      required
                    >
                      {["A", "B", "C", "D"].map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <p className="helper-text">
                Admin signup creates a school automatically and generates its
                school code. Students, teachers, and accountants can sign up
                directly using that school code.
              </p>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Creating account..." : "Create account"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function DashboardPage({ busy, message, errorText, profile, handleLogout }) {
  useSubscriptionGuard(profile, !profile);
  const navigate = useNavigate();
  const roleHomeRoute = profile ? getDefaultRoute(profile.role) : "/dashboard";
  const roleButtonLabel = profile?.role
    ? `Go to ${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)} Panel`
    : "Open Panel";

  return (
    <main className="app-shell">
      <section className="hero-card hero-card--wide">
        <div className="hero-header">
          <div>
            <p className="eyebrow">School ERP Authentication</p>
            <h1>Dashboard</h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {profile?.role ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => navigate(roleHomeRoute)}
              >
                {roleButtonLabel}
              </button>
            ) : null}
            <button className="secondary-button" onClick={handleLogout} disabled={busy}>
              {busy ? "Please wait..." : "Logout"}
            </button>
          </div>
        </div>
        {message ? <p className="success-text">{message}</p> : null}
        {errorText ? <p className="error-text">{errorText}</p> : null}

        <div className="dashboard-layout">
          {!profile ? (
            <section className="dashboard-card">
              <p className="status-line">Loading your profile...</p>
            </section>
          ) : (
            <>
              <section className="dashboard-card">
                <h2>Quick Access</h2>
                <p className="body-copy">
                  Open your main work area directly from here.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => navigate(roleHomeRoute)}
                >
                  {roleButtonLabel}
                </button>
              </section>
              <RolePanel profile={profile} />
              <p className="body-copy">
                Open your role panel to access the full sidebar navigation and
                the modules available for your account.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function SubscriptionExpiredPage({ profile, handleLogout, busy }) {
  const { isExpired } = useSubscriptionGuard(profile, !profile);

  if (!profile) {
    return (
      <main className="app-shell">
        <section className="hero-card">
          <p className="status-line">Loading subscription details...</p>
        </section>
      </main>
    );
  }

  if (!isExpired) {
    return null;
  }

  const adminContact = profile.school?.email
    ? `mailto:${profile.school.email}`
    : "mailto:admin@school.com";

  return (
    <main className="app-shell">
      <section className="hero-card hero-card--wide">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Subscription Expired</p>
            <h1>School access has been blocked.</h1>
          </div>
          <button className="secondary-button" onClick={handleLogout} disabled={busy}>
            {busy ? "Please wait..." : "Logout"}
          </button>
        </div>
        <section className="dashboard-card dashboard-card--alert">
          <h2>Renew the school subscription to continue.</h2>
          <p className="body-copy">
            Access is blocked because the current date is greater than the
            school subscription end date in the database.
          </p>
          <div className="meta-grid">
            <div className="meta-tile">
              <span className="meta-label">School</span>
              <strong>{profile.school?.name ?? "Unknown school"}</strong>
            </div>
            <div className="meta-tile">
              <span className="meta-label">School Code</span>
              <strong>{profile.school?.school_code ?? "Not set"}</strong>
            </div>
            <div className="meta-tile">
              <span className="meta-label">Subscription End Date</span>
              <strong>{formatDate(profile.school?.subscription_end_date)}</strong>
            </div>
          </div>
          <a className="primary-button link-button" href={adminContact}>
            Contact Admin
          </a>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [signupForm, setSignupForm] = useState(emptySignupForm);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      if (error) {
        setErrorText(getFriendlyErrorMessage(error));
      } else {
        setSession(data.session ?? null);
      }
      setLoading(false);
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }
      setSession(nextSession ?? null);
      setMessage("");
      setErrorText("");
      if (!nextSession) {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      setLoading(true);
      setErrorText("");

      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id,school_id,name,email,role,created_at")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        setErrorText(`Error loading profile: ${getFriendlyErrorMessage(profileError)} (${profileError.message})`);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!profileData) {
        setErrorText(
          "No role profile found for this account. Apply the latest SQL setup and use a valid school code that matches the production schema."
        );
        setProfile(null);
        setLoading(false);
        return;
      }

      let schoolData = null;
      if (profileData.school_id) {
        const { data: schoolRow, error: schoolError } = await supabase
          .from("schools")
          .select("id,school_code,name,email,is_active,subscription_start_date,subscription_end_date")
          .eq("id", profileData.school_id)
          .maybeSingle();

        if (schoolError) {
          setErrorText(`Error loading school: ${getFriendlyErrorMessage(schoolError)} (${schoolError.message})`);
          setProfile(null);
          setLoading(false);
          return;
        }

        schoolData = schoolRow;
      }

      setProfile({ ...profileData, school: schoolData });
      setLoading(false);
    }

    loadProfile();
  }, [session]);

  function updateLoginField(event) {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  }

  function updateSignupField(event) {
    const { name, value } = event.target;
    setSignupForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "role" && value !== "student") {
        next.className = "";
        next.section = "A";
      }

      return next;
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setErrorText("");
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(),
      password: loginForm.password,
    });

    if (error) {
      setErrorText(getFriendlyErrorMessage(error));
    } else {
      setMessage("Login successful.");
      setLoginForm(emptyLoginForm);
    }

    setBusy(false);
  }

  async function handleSignup(event) {
    event.preventDefault();
    setBusy(true);
    setErrorText("");
    setMessage("");

    if (signupForm.role === "student" && !signupForm.className) {
      setErrorText("Please select a class for the student account.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: signupForm.email.trim(),
      password: signupForm.password,
      options: {
        data: {
          name: signupForm.name.trim(),
          role: signupForm.role,
          school_code:
            signupForm.role === "admin"
              ? undefined
              : signupForm.schoolCode.trim().toUpperCase(),
          school_name:
            signupForm.role === "admin"
              ? signupForm.schoolName.trim()
              : undefined,
          class_name:
            signupForm.role === "student"
              ? signupForm.className.trim()
              : undefined,
          section:
            signupForm.role === "student"
              ? signupForm.section.trim().toUpperCase()
              : undefined,
        },
      },
    });

    if (error) {
      setErrorText(getFriendlyErrorMessage(error));
    } else {
      setMessage(
        "Signup submitted. If email confirmation is enabled in Supabase, verify your email before logging in."
      );
      setSignupForm(emptySignupForm);
      setMode("login");
    }

    setBusy(false);
  }

  async function handleLogout() {
    setBusy(true);
    setErrorText("");
    setMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorText(getFriendlyErrorMessage(error));
    } else {
      setSession(null);
      setProfile(null);
    }

    setBusy(false);
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Routes>
      <Route
        path="/login"
        element={
          session ? (
            <Navigate to={profile ? getDefaultRoute(profile.role) : "/dashboard"} replace />
          ) : (
            <AuthPage
              loading={loading}
              busy={busy}
              message={message}
              errorText={errorText}
              mode={mode}
              setMode={setMode}
              loginForm={loginForm}
              signupForm={signupForm}
              updateLoginField={updateLoginField}
              updateSignupField={updateSignupField}
              handleLogin={handleLogin}
              handleSignup={handleSignup}
            />
          )
        }
      />

      <Route element={<ProtectedRoute session={session} loading={loading} />}>
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              busy={busy}
              message={message}
              errorText={errorText}
              profile={profile}
              handleLogout={handleLogout}
            />
          }
        />

        <Route element={<RoleProtected profile={profile} loading={loading} allowedRoles={["admin"]} />}>
          <Route path="/admin/*" element={<AdminLayout profile={profile} onLogout={handleLogout} />}>
            <Route index element={<AdminDashboard profile={profile} />} />
            <Route path="overview" element={<AdminDashboard profile={profile} />} />
            <Route path="students" element={<StudentManagement profile={profile} />} />
            <Route path="fees" element={<AdminFees profile={profile} />} />
            <Route path="attendance" element={<AdminAttendance profile={profile} />} />
            <Route path="staff" element={<AdminStaff profile={profile} />} />
            <Route path="announcements" element={<AdminAnnouncements profile={profile} />} />
            <Route path="reports" element={<AdminReports profile={profile} />} />
          </Route>
        </Route>

        <Route element={<RoleProtected profile={profile} loading={loading} allowedRoles={["teacher"]} />}>
          <Route path="/teacher" element={<TeacherLayout profile={profile} onLogout={handleLogout} />} />
        </Route>

        <Route element={<RoleProtected profile={profile} loading={loading} allowedRoles={["student"]} />}>
          <Route path="/student" element={<StudentLayout profile={profile} onLogout={handleLogout} />}>
            <Route index element={<Navigate to="/student/attendance" replace />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="fees" element={<StudentFeesPage />} />
            <Route path="homework" element={<StudentHomeworkPage />} />
            <Route path="notices" element={<StudentNoticesPage />} />
            <Route path="marks" element={<StudentMarksPage />} />
          </Route>
        </Route>

        <Route element={<RoleProtected profile={profile} loading={loading} allowedRoles={["accountant"]} />}>
          <Route path="/accountant" element={<AccountantDashboard profile={profile} />} />
        </Route>

        <Route element={<RoleProtected profile={profile} loading={loading} allowedRoles={["superadmin"]} />}>
          <Route path="/superadmin/*" element={<SuperadminLayout profile={profile} onLogout={handleLogout} />}>
            <Route index element={<SuperadminDashboard />} />
            <Route path="dashboard" element={<SuperadminDashboard />} />
            <Route path="schools" element={<SuperadminDashboard />} />
            <Route path="subscriptions" element={<SuperadminSubscriptionManager />} />
            <Route path="audit" element={<div>Audit Logs Coming Soon</div>} />
            <Route path="stats" element={<div>System Stats Coming Soon</div>} />
          </Route>
        </Route>

        <Route
          path="/subscription-expired"
          element={
            <SubscriptionExpiredPage
              profile={profile}
              handleLogout={handleLogout}
              busy={busy}
            />
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={session ? (profile ? getDefaultRoute(profile.role) : "/dashboard") : "/login"}
            replace
          />
        }
      />
    </Routes>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
