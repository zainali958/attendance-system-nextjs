import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/sheetsDb";
import { editAttendanceAction } from "@/lib/actions";
import FlashBanner from "@/components/FlashBanner";
import AttendanceDateFilter from "@/components/AttendanceDateFilter";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return { title: `Attendance for ${date} - Admin Panel` };
}

export const dynamic = "force-dynamic";

export default async function AttendanceByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  await requireAdmin();
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="container mt-4">
        <FlashBanner />
        <div className="alert alert-danger">
          Invalid date format. Please use YYYY-MM-DD.
        </div>
        <Link href="/admin" className="btn btn-outline-primary">
          <i className="bi bi-arrow-left" /> Back to Admin Panel
        </Link>
      </div>
    );
  }

  const db = await getDb();
  const attendanceRaw = await db.getAttendanceByDate(date);
  const attendance = await db.annotateLateness(attendanceRaw);
  const stats = await db.getAttendanceStats(date);
  const returnTo = `/admin/attendance/${date}`;

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
                <i className="bi bi-calendar-check" /> Attendance for {date}
              </h3>
            </div>
            <div className="col-md-6">
              <AttendanceDateFilter initialDate={date} compact />
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body text-center">
                <h3>{stats.total_users}</h3>
                <small>Total Users</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body text-center">
                <h3>{stats.checked_in}</h3>
                <small>Checked In</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body text-center">
                <h3>{stats.checked_out}</h3>
                <small>Checked Out</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white">
              <div className="card-body text-center">
                <h3>{stats.attendance_percentage}%</h3>
                <small>Attendance Rate</small>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header bg-white">
          <h5 className="mb-0">Attendance Records</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Working Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{record["Full Name"]}</strong>
                      <br />
                      <small className="text-muted">{record.Username}</small>
                    </td>
                    <td>{record.Department || "N/A"}</td>
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
                        <span className="text-muted">In progress</span>
                      )}
                    </td>
                    <td>
                      {record["Check-Out Time"] ? (
                        <span className="badge bg-info">Completed</span>
                      ) : record["Check-In Time"] ? (
                        <span className="badge bg-success">Working</span>
                      ) : (
                        <span className="badge bg-warning">Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        data-bs-toggle="modal"
                        data-bs-target={`#editAttendance-${record.Username}`}
                      >
                        <i className="bi bi-pencil" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      <i className="bi bi-info-circle" /> No attendance records found for {date}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Attendance Modals (one per record) */}
      {attendance.map((record, i) => (
        <div className="modal fade" id={`editAttendance-${record.Username}`} tabIndex={-1} key={i}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-primary">
                <h5 className="modal-title text-white">
                  <i className="bi bi-pencil" /> Edit Attendance for {record.Username}
                </h5>
                <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" />
              </div>
              <form action={editAttendanceAction}>
                <div className="modal-body">
                  <input type="hidden" name="username" value={record.Username} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <div className="mb-3">
                    <label className="form-label fw-bold">Check-In Time</label>
                    <input
                      type="text"
                      name="check_in_time"
                      className="form-control"
                      placeholder="HH:MM or HH:MM:SS"
                      defaultValue={record["Check-In Time"] || ""}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Check-Out Time</label>
                    <input
                      type="text"
                      name="check_out_time"
                      className="form-control"
                      placeholder="HH:MM or HH:MM:SS"
                      defaultValue={record["Check-Out Time"] || ""}
                    />
                  </div>
                  <small className="text-muted">
                    Working Hours is recalculated automatically from these two times — no need to
                    enter it.
                  </small>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-check-circle" /> Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
