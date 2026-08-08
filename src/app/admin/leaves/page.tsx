import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";
import { decideLeaveAction } from "@/lib/actions";
import FlashBanner from "@/components/FlashBanner";

export const metadata = { title: "Leave Requests - Admin Panel" };
export const dynamic = "force-dynamic";

export default async function AdminLeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const statusFilter = status?.trim() || null;

  const db = await getDb();
  const leaves = await db.getAllLeaves(statusFilter);
  const pendingCount = (await db.getAllLeaves("Pending")).length;
  const currentFilter = statusFilter || "All";
  const returnTo = `/admin/leaves${status ? `?status=${status}` : ""}`;

  const filterBtn = (label: string, value?: string) => {
    const active = currentFilter === (value || "All");
    const colorClass =
      value === "Pending" ? "warning" : value === "Approved" ? "success" : value === "Rejected" ? "danger" : "primary";
    return (
      <Link
        href={value ? `/admin/leaves?status=${value}` : "/admin/leaves"}
        className={`btn btn-sm ${active ? `btn-${colorClass}` : `btn-outline-${colorClass}`}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link href="/admin" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left" /> Back to Admin Panel
        </Link>
      </nav>

      <FlashBanner />

      <div className="card mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-6">
              <h3>
                <i className="bi bi-calendar-x" /> Leave Requests
              </h3>
            </div>
            <div className="col-md-6 text-end">
              <div className="btn-group">
                {filterBtn("All")}
                {filterBtn(`Pending${pendingCount ? ` (${pendingCount})` : ""}`, "Pending")}
                {filterBtn("Approved", "Approved")}
                {filterBtn("Rejected", "Rejected")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Reason</th>
                  <th>Requested At</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{leave["Full Name"] || ""}</strong>
                      <br />
                      <small className="text-muted">{leave.Username || ""}</small>
                    </td>
                    <td>{leave["Start Date"] || ""}</td>
                    <td>{leave["End Date"] || ""}</td>
                    <td>{leave.Reason || ""}</td>
                    <td>
                      <small>{leave["Requested At"] || ""}</small>
                    </td>
                    <td>
                      {leave.Status === "Approved" && <span className="badge bg-success">Approved</span>}
                      {leave.Status === "Rejected" && <span className="badge bg-danger">Rejected</span>}
                      {leave.Status !== "Approved" && leave.Status !== "Rejected" && (
                        <span className="badge bg-warning text-dark">Pending</span>
                      )}
                    </td>
                    <td>
                      <small>{leave["Reviewed By"] || ""}</small>
                    </td>
                    <td>
                      {leave.Status === "Pending" ? (
                        <div className="d-flex gap-2">
                          <form action={decideLeaveAction.bind(null, leave.row_index!)}>
                            <input type="hidden" name="decision" value="Approved" />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="btn btn-sm btn-outline-success">
                              <i className="bi bi-check-lg" /> Approve
                            </button>
                          </form>
                          <form action={decideLeaveAction.bind(null, leave.row_index!)}>
                            <input type="hidden" name="decision" value="Rejected" />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" className="btn btn-sm btn-outline-danger">
                              <i className="bi bi-x-lg" /> Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <small className="text-muted">{leave["Reviewed At"] || ""}</small>
                      )}
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      <i className="bi bi-info-circle" /> No leave requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
