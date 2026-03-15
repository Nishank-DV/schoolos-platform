import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Announcements from "./pages/Announcements";
import Insights from "./pages/Insights";
import ChildDetail from "./pages/ChildDetail";
import Attendance from "./pages/Attendance";
import Results from "./pages/Results";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="insights" element={<Insights />} />
        <Route path="child/:id" element={<ChildDetail />} />
        <Route path="child/:id/attendance" element={<Attendance />} />
        <Route path="child/:id/results" element={<Results />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
