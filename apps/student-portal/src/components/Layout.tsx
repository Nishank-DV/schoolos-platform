import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/assignments", label: "Homework" },
  { to: "/announcements", label: "Announcements" },
  { to: "/insights", label: "Insights" },
  { to: "/results", label: "Results" },
  { to: "/fees", label: "Fees" },
  { to: "/careerbuddy", label: "CareerBuddy" },
];

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-white shadow-lg">
      <header className="p-4 border-b flex justify-between items-center">
        <h1 className="font-bold text-lg">SchoolOS Student</h1>
        <button type="button" onClick={logout} className="text-sm text-slate-500">Logout</button>
      </header>
      <nav className="flex gap-2 p-2 border-b bg-slate-50 overflow-x-auto">
        {nav.map(({ to, label }) => {
          const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${active ? "bg-primary-600 text-white" : "text-slate-600"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <main className="flex-1 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
