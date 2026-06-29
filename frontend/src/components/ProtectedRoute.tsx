import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../api/types";

/** Gate routes by authentication and (optionally) a required role. */
export function ProtectedRoute({ role }: { role?: Role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    // Send users to their natural home rather than showing a forbidden page.
    return <Navigate to={user.role === "REVIEWER" ? "/queue" : "/applications"} replace />;
  }
  return <Outlet />;
}
