import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb, todayStr, getTimeZone } from "@/lib/sheetsDb";
import FlashBanner from "@/components/FlashBanner";
import MonthDownloadLinks from "@/components/MonthDownloadLinks";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `User Attendance - ${decodeURIComponent(username)}` };
}

export const dynamic = "force-dynamic";

export default async function UserAttendancePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await requireAdmin();
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);

  const db = await getDb();
  const user = await db.getUserByUsername(username, true);

  if (!user) {
    return (
      <div className="container mt-4">
        <FlashBanner />
        <div className="alert alert-danger">User not found</div>
        <Link href="/admin" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left" /> Back to Admin Panel
        </Link>
      </div>
    );
  }

  const attendanceHistory = await db.getUserAttendanceHistory(username, 90);
  const historyWithLateness = await db.annotateLateness(attendanceHistory.records);
  const currentMonth = todayStr(getTimeZone()).slice(0, 7);
  const isAdmin = String(user["Is Admin"] || "").toUpperCase() === "TRUE";
  const absentDays = Math.abs(
    attendanceHistory.records.length - attendanceHistory.days_present
  );

  return (
    <div className="container mt-4">
      <nav className="mb-4">
        <Link href="/admin" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left" /> Back to Admin Panel
        </Link>
      </nav>

      <FlashBanner />

      <div
        className="mb-4 text-white"
        style={{
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          borderRadius: 15,
          padding: 25,
        }}
      >
        <div className="row align-items-center">
          <div className="col-md-8">
            <h3>{user["Full Name"]}</h3>
            <p className="mb-1">
              <strong>Username:</strong> {user.Username}
            </p>
            <p className="mb-1">
              <strong>Email:</strong> {user.Email || "N/A"}
            </p>
            <p className="mb-0">
              <strong>Department:</strong> {user.Department || "N/A"} |{" "}
              <strong>Designation:</strong> {user.Designation || "N/A"}
            </p>
          </div>
          <div className="col-md-4 text-end">
            {isAdmin ? (
              <span className="badge bg-warning text-dark fs-6">Administrator</span>
            ) : (
              <span className="badge bg-info fs-6">Employee</span>
            )}
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-3">
          <div className="bg-white rounded p-3 text-center shadow-sm">
            <h3 className="text-primary">{attendanceHistory.days_present}</h3>
            <small className="text-muted">Days Present (90 days)</small>
          </div>
        </div>
        <div className="col-md-3">
          <div className="bg-white rounded p-3 text-center shadow-sm">
            <h3 className="text-success">{attendanceHistory.total_working_hours}</h3>
            <small className="text-muted">Total Working Hours</small>
          </div>
        </div>
        <div className="col-md-3">
          <div className="bg-white rounded p-3 text-center shadow-sm">
            <h3 className="text-info">{attendanceHistory.records.length}</h3>
            <small className="text-muted">Total Records</small>
          </div>
        </div>
        <div className="col-md-3">
          <div className="bg-white rounded p-3 text-center shadow-sm">
            <h3 className="text-warning">{absentDays}</h3>
            <small className="text-muted">Absent Days</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0">
            <i className="bi bi-clock-history" /> Attendance History (Last 90 Days)
          </h5>
          <MonthDownloadLinks username={username} initialMonth={currentMonth} />
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyWithLateness.map((record, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{record.Date}</strong>
                    </td>
                    <td>
                      {record["Check-In Time"] ? (
                        <>
                          <span className="text-success">{record["Check-In Time"]}</span>
                          {record.is_late ? (
                            <span
                              className="badge bg-danger ms-2"
                              title={`Expected by ${record.expected_start.slice(0, 5)}`}
                            >
                              Late
                            </span>
                          ) : (
                            <span className="badge bg-success ms-2">On time</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {record["Check-Out Time"] ? (
                        <span className="text-danger">{record["Check-Out Time"]}</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {record["Working Hours"] ? (
                        <span className="badge bg-success">{record["Working Hours"]}</span>
                      ) : (
                        <span className="text-muted">Incomplete</span>
                      )}
                    </td>
                    <td>
                      {record["Check-Out Time"] ? (
                        <span className="badge bg-info">Completed</span>
                      ) : record["Check-In Time"] ? (
                        <span className="badge bg-warning text-dark">No Check-Out</span>
                      ) : (
                        <span className="badge bg-secondary">No Record</span>
                      )}
                    </td>
                  </tr>
                ))}
                {attendanceHistory.records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      <i className="bi bi-info-circle" /> No attendance records found
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
