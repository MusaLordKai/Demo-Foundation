import { useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "./Brand";
import { listApplications } from "../api/applications";
import { FOLDERS, type Folder } from "../api/types";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isApplicant = user?.role === "APPLICANT";

  const { data: apps } = useQuery({
    queryKey: ["applications", "mine"],
    queryFn: () => listApplications(),
    enabled: isApplicant,
  });

  const counts = useMemo(() => {
    const c = {} as Record<Folder, number>;
    for (const f of FOLDERS) c[f.key] = 0;
    (apps ?? []).forEach((a) => {
      c[a.folder] = (c[a.folder] ?? 0) + 1;
    });
    return c;
  }, [apps]);

  return (
    <div className="app-shell" data-role={user?.role ?? "APPLICANT"}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand size={34} />
        </div>

        {user && isApplicant && (
          <nav className="sidebar-nav">
            <NavLink to="/applications" end>
              All cases
            </NavLink>
            <div className="sidebar-section">Folders</div>
            {FOLDERS.map((f) => (
              <NavLink key={f.key} to={`/cases/${f.key}`} className="folder-link">
                <span>{f.label}</span>
                {counts[f.key] > 0 && <span className="count">{counts[f.key]}</span>}
              </NavLink>
            ))}
            <div className="sidebar-section">Apply</div>
            <NavLink to="/grants">Browse grants</NavLink>
          </nav>
        )}

        {user && !isApplicant && (
          <nav className="sidebar-nav">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/queue">Review queue</NavLink>
            <NavLink to="/grants">Grants</NavLink>
            <NavLink to="/logs">Logs</NavLink>
          </nav>
        )}

        {user && (
          <div className="sidebar-foot">
            <div className="sidebar-user">
              <div className="name">{user.name}</div>
              <div className="role">{user.role.toLowerCase()}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        )}
      </aside>

      <div className="app-main">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
