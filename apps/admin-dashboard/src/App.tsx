import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Academics from "./pages/Academics";
import Assignments from "./pages/Assignments";
import Exams from "./pages/Exams";
import Attendance from "./pages/Attendance";
import Finance from "./pages/Finance";
import InnovationLab from "./pages/InnovationLab";
import Analytics from "./pages/Analytics";
import CareerBuddy from "./pages/CareerBuddy";
import Announcements from "./pages/Announcements";
import Users from "./pages/Users";
import Enquiries from "./pages/Enquiries";
import Admissions from "./pages/Admissions";
import Timetable from "./pages/Timetable";
import Quizzes from "./pages/Quizzes";
import Events from "./pages/Events";
import Ptm from "./pages/Ptm";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="users" element={<Users />} />
        <Route path="students" element={<Students />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="classes" element={<Classes />} />
        <Route path="academics" element={<Academics />} />
        <Route path="enquiries" element={<Enquiries />} />
        <Route path="admissions" element={<Admissions />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="exams" element={<Exams />} />
        <Route path="quizzes" element={<Quizzes />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="finance" element={<Finance />} />
        <Route path="innovation-lab" element={<InnovationLab />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="careerbuddy" element={<CareerBuddy />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="events" element={<Events />} />
        <Route path="ptm" element={<Ptm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
