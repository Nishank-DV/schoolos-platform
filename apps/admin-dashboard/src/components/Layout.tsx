import { useEffect, useState } from "react";
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileNavOpen]);

  function renderNav() {
    return (
      <>
        {navGroups.map((group) => (
          <div key={group.heading} className="mb-3">
            <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-slate-500">{group.heading}</p>
            {group.items.map(({ to, label }) => {
              const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`mb-0.5 block px-3 py-2 rounded-lg text-sm transition ${active ? "bg-primary-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:overflow-hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div>
          <h1 className="font-semibold text-slate-900">SchoolOS</h1>
          <p className="text-xs text-slate-500">Admin Dashboard</p>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={isMobileNavOpen}
          className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[82vw] transform bg-slate-900 text-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 lg:flex-shrink-0 ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="p-4 border-b border-slate-700">
          <h1 className="font-bold text-lg">SchoolOS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">{renderNav()}</nav>
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

      <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:p-6">
        <div className="min-w-0 max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
