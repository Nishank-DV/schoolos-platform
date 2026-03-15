import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Assignments from "./pages/Assignments";
import Announcements from "./pages/Announcements";
import Insights from "./pages/Insights";
import Results from "./pages/Results";
import Fees from "./pages/Fees";
import CareerBuddy from "./pages/CareerBuddy";

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
        <Route path="assignments" element={<Assignments />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="insights" element={<Insights />} />
        <Route path="results" element={<Results />} />
        <Route path="fees" element={<Fees />} />
        <Route path="careerbuddy" element={<CareerBuddy />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
