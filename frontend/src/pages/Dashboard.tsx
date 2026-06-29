import { useQuery } from "@tanstack/react-query";
import { getStats } from "../api/stats";
import { BarChart, LineChart, PieChart } from "../components/Charts";
import { Icon, type IconName } from "../components/Icon";
import { CATEGORY_LABELS, type Category } from "../api/types";

export function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["stats"], queryFn: getStats });

  if (isLoading) return <p>Loading…</p>;
  if (error || !data) return <p className="error">Failed to load the dashboard.</p>;

  const money = (n: number) => n.toLocaleString();
  const cards: { label: string; value: string | number; accent?: boolean; icon: IconName }[] = [
    { label: "Available grants", value: data.grants, icon: "layers" },
    { label: "Open grants", value: data.openGrants, icon: "folderOpen" },
    { label: "Total applications", value: data.totalApplications, icon: "files" },
    { label: "Avg applications / grant", value: data.avgApplicationsPerGrant, icon: "barChart" },
    { label: "Approval rate", value: `${data.approvalRate}%`, icon: "target" },
    { label: "Total funds allocated", value: money(data.totalFunds), accent: true, icon: "wallet" },
    { label: "Funds requested", value: money(data.requestedFunds), accent: true, icon: "trendingUp" },
    { label: "Funds approved", value: money(data.approvedFunds), accent: true, icon: "dollar" },
  ];
  const statusItems: { label: string; value: number; icon: IconName }[] = [
    { label: "Pending review", value: data.pending, icon: "clock" },
    { label: "Approved", value: data.approved, icon: "checkCircle" },
    { label: "Rejected", value: data.rejected, icon: "xCircle" },
    { label: "Drafts in progress", value: data.draft, icon: "pencil" },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Foundation overview</p>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div className={`stat-card${c.accent ? " stat-accent" : ""}`} key={c.label}>
            <span className="stat-icon">
              <Icon name={c.icon} />
            </span>
            <span className="stat-text">
              <span className="stat-value">{c.value}</span>
              <span className="stat-label">{c.label}</span>
            </span>
          </div>
        ))}
        <div className="stat-card stat-full stat-status-row">
          {statusItems.map((s) => (
            <div className="status-cell" key={s.label}>
              <span className="stat-icon"><Icon name={s.icon} /></span>
              <span className="stat-text">
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <h3>Revenue distribution across grants</h3>
          <BarChart data={data.byGrant.map((g) => ({ label: g.shortCode, value: g.funds }))} />
        </div>
        <div className="card">
          <h3>Applications across grants</h3>
          <PieChart data={data.byGrant.map((g) => ({ label: g.shortCode, value: g.applications }))} />
        </div>
        <div className="card">
          <h3>Applications over time</h3>
          <LineChart data={data.applicationsOverTime.map((m) => ({ label: m.label, value: m.count }))} />
        </div>
        <div className="card">
          <h3>Funds allocated by category</h3>
          <BarChart
            data={data.byCategory.map((c) => ({ label: CATEGORY_LABELS[c.category as Category] ?? c.category, value: c.funds }))}
          />
        </div>
      </div>
    </>
  );
}
