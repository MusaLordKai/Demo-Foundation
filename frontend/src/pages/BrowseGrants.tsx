import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listGrants } from "../api/grants";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS } from "../api/types";

export function BrowseGrants() {
  const { user } = useAuth();
  const isReviewer = user?.role === "REVIEWER";
  const { data, isLoading, error } = useQuery({ queryKey: ["grants"], queryFn: listGrants });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="error">Failed to load grants.</p>;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h1>{isReviewer ? "Grants" : "Available grants"}</h1>
          {!isReviewer && <p className="muted">Choose a grant to apply for funding.</p>}
        </div>
        {isReviewer && (
          <Link className="btn" to="/grants/new">
            New grant
          </Link>
        )}
      </div>

      {data && data.length === 0 && <p className="muted">No grants available right now.</p>}

      {isReviewer ? (
        <table className="table">
          <thead>
            <tr>
              <th>Grant</th>
              <th>Code</th>
              <th>Category</th>
              <th>Funds</th>
              <th>Closes</th>
              <th>Status</th>
              <th>Applications</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((g) => (
              <tr key={g.id}>
                <td>
                  <Link to={`/grants/${g.id}`}>{g.name}</Link>
                </td>
                <td>{g.shortCode}</td>
                <td>{CATEGORY_LABELS[g.category]}</td>
                <td>{Number(g.fundsAllocated).toLocaleString()}</td>
                <td>{g.openUntil}</td>
                <td>
                  <span className={`badge badge-${g.status === "OPEN" ? "approved" : "rejected"}`}>{g.status}</span>
                </td>
                <td>{g.applicationCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grant-grid">
          {data?.map((g) => (
            <Link key={g.id} to={`/grants/${g.id}`} className="grant-card">
              <span className="grant-card-cat">{CATEGORY_LABELS[g.category]}</span>
              <h3>{g.name}</h3>
              <p className="grant-card-funds">{Number(g.fundsAllocated).toLocaleString()} available</p>
              <p className="muted small">Closes {g.openUntil}</p>
              <span className="grant-card-cta">View &amp; apply →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
