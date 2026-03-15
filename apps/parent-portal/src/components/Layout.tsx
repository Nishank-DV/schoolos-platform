import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();

  const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/announcements", label: "Announcements" },
    { to: "/insights", label: "Insights" },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-white shadow-lg">
      <header className="p-4 border-b flex justify-between items-center">
        <h1 className="font-bold text-lg">SchoolOS Parent</h1>
        <button type="button" onClick={logout} className="text-sm text-slate-500">Logout</button>
      </header>
      <nav className="px-4 pt-4 border-b flex gap-4 overflow-x-auto">
        {nav.map((item) => {
          const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm font-medium pb-3 whitespace-nowrap ${active ? "text-primary-700 border-b-2 border-primary-600" : "text-slate-600 hover:text-blue-600"}`}
            >
              {item.label}
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
