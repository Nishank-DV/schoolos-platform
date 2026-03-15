import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navGroups = [
  {
    heading: "Core",
    items: [
      { to: "/", label: "Overview" },
      { to: "/users", label: "Users" },
      { to: "/students", label: "Students" },
      { to: "/teachers", label: "Teachers" },
      { to: "/classes", label: "Classes" },
      { to: "/academics", label: "Academics" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/enquiries", label: "Enquiries" },
      { to: "/admissions", label: "Admissions" },
      { to: "/attendance", label: "Attendance" },
      { to: "/finance", label: "Finance" },
      { to: "/events", label: "Events" },
      { to: "/ptm", label: "PTM Booking" },
    ],
  },
  {
    heading: "Learning",
    items: [
      { to: "/timetable", label: "Timetable" },
      { to: "/assignments", label: "Assignments" },
      { to: "/exams", label: "Exams" },
      { to: "/quizzes", label: "Quizzes" },
      { to: "/announcements", label: "Announcements" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { to: "/innovation-lab", label: "Innovation Lab" },
      { to: "/analytics", label: "Analytics" },
      { to: "/careerbuddy", label: "CareerBuddy" },
    ],
  },
];

function roleLabel(role: string | undefined) {
  if (!role) return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="font-bold text-lg">SchoolOS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.heading} className="mb-3">
              <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-slate-500">{group.heading}</p>
              {group.items.map(({ to, label }) => {
                const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`mb-0.5 block px-3 py-2 rounded-lg text-sm transition ${active ? "bg-primary-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          <p className="text-xs text-slate-500">{roleLabel(user?.role)}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 text-xs text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
