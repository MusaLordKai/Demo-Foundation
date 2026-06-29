import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { Login } from "./pages/Login";
import { MyApplications } from "./pages/MyApplications";
import { ReviewerQueue } from "./pages/ReviewerQueue";
import { ApplicationForm } from "./pages/ApplicationForm";
import { ApplicationDetail } from "./pages/ApplicationDetail";
import { BrowseGrants } from "./pages/BrowseGrants";
import { GrantDetail } from "./pages/GrantDetail";
import { GrantForm } from "./pages/GrantForm";
import { Logs } from "./pages/Logs";
import { Dashboard } from "./pages/Dashboard";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "REVIEWER" ? "/dashboard" : "/applications"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        {/* Any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/grants" element={<BrowseGrants />} />
          <Route path="/grants/:id" element={<GrantDetail />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
        </Route>
        {/* Applicant-only */}
        <Route element={<ProtectedRoute role="APPLICANT" />}>
          <Route path="/applications" element={<MyApplications />} />
          <Route path="/cases/:folder" element={<MyApplications />} />
          <Route path="/grants/:grantId/apply" element={<ApplicationForm />} />
          <Route path="/applications/:id/edit" element={<ApplicationForm />} />
        </Route>
        {/* Reviewer-only */}
        <Route element={<ProtectedRoute role="REVIEWER" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/queue" element={<ReviewerQueue />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/grants/new" element={<GrantForm />} />
          <Route path="/grants/:id/edit" element={<GrantForm />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
