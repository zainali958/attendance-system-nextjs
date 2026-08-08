import { requireUser } from "@/lib/auth";
import { getDb, todayStr, timeStr, getTimeZone } from "@/lib/sheetsDb";
import { checkInAction, checkOutAction, requestLeaveAction, logoutAction } from "@/lib/actions";
import FlashBanner from "@/components/FlashBanner";
import LiveClock from "@/components/LiveClock";
import Link from "next/link";

export const metadata = { title: "My Dashboard - Attendance System" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireUser();
  const db = await getDb();

  const todayStatus = await db.getUserWorkingHoursToday(session.username);
  const history = await db.getUserAttendanceHistory(session.username, 30);
  const myLeaves = await db.getLeavesForUser(session.username);

  const tz = getTimeZone();
  const currentDate = todayStr(tz);
  const currentTime = timeStr(tz);

  return (
    <>
      <nav
        className="navbar navbar-expand-lg navbar-dark"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <div className="container">
          <span className="navbar-brand">
            <i className="bi bi-calendar-check" /> Attendance System
          </span>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <span className="nav-link">
                  <i className="bi bi-person-circle" /> {session.fullName}
                </span>
              </li>
              {session.isAdmin && (
                <li className="nav-item">
                  <Link className="nav-link" href="/admin">
                    <i className="bi bi-gear" /> Admin Panel
                  </Link>
                </li>
              )}
              <li className="nav-item">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="nav-link btn btn-link"
                    style={{ border: "none", background: "none" }}
                  >
                    <i className="bi bi-box-arrow-right" /> Logout
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        <FlashBanner />

        <div
          className="mb-4"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            borderRadius: 15,
            padding: 25,
          }}
        >
          <div className="row align-items-center">
            <div className="col-md-8">
              <h3>Welcome, {session.fullName}! 👋</h3>
              <p className="mb-0">
                {session.department} - {session.designation}
              </p>
            </div>
            <div className="col-md-4 text-end">
              <h5>{currentDate}</h5>
              <LiveClock initialTime={currentTime} />
            </div>
          </div>
        </div>

        <div className="row">
          {/* Check-In/Check-Out Section */}
          <div className="col-md-5">
            <div
              className="mb-4"
              style={{
                background: "white",
                borderRadius: 15,
                padding: 30,
                boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
                textAlign: "center",
              }}
            >
              <h4 className="mb-4">Today&apos;s Attendance</h4>

              {todayStatus.status === "not_checked_in" && (
                <>
                  <div className="mb-4">
                    <span className="badge bg-warning text-dark p-2 fs-6">
                      <i className="bi bi-exclamation-circle" /> Not Checked In
                    </span>
                  </div>
                  <form action={checkInAction}>
                    <button
                      type="submit"
                      className="btn btn-lg d-block w-100 text-white fw-bold"
                      style={{
                        background: "linear-gradient(135deg, #28a745, #20c997)",
                        borderRadius: 50,
                        padding: "15px 40px",
                        textTransform: "uppercase",
                      }}
                    >
                      <i className="bi bi-box-arrow-in-right" /> Check In Now
                    </button>
                  </form>
                  <p className="text-muted mt-3">Click to record your check-in time</p>
                </>
              )}

              {todayStatus.status === "checked_in" && (
                <>
                  <div className="mb-4">
                    <span className="badge bg-success p-2 fs-6">
                      <i className="bi bi-check-circle" /> Checked In
                    </span>
                  </div>
                  <div className="mb-3" style={{ fontSize: "3rem", fontWeight: 700, color: "#2c3e50" }}>
                    {todayStatus.check_in}
                  </div>
                  <p className="text-muted mb-4">Check-in Time</p>
                  <form action={checkOutAction}>
                    <button
                      type="submit"
                      className="btn btn-lg d-block w-100 text-white fw-bold"
                      style={{
                        background: "linear-gradient(135deg, #dc3545, #c82333)",
                        borderRadius: 50,
                        padding: "15px 40px",
                        textTransform: "uppercase",
                      }}
                    >
                      <i className="bi bi-box-arrow-right" /> Check Out Now
                    </button>
                  </form>
                  <p className="text-muted mt-3">Click to record your check-out time</p>
                </>
              )}

              {todayStatus.status === "checked_out" && (
                <>
                  <div className="mb-4">
                    <span className="badge bg-info p-2 fs-6">
                      <i className="bi bi-check-circle-fill" /> Day Complete
                    </span>
                  </div>
                  <div className="row mb-3">
                    <div className="col-6">
                      <small className="text-muted">Check-In</small>
                      <h5 className="text-success">{todayStatus.check_in}</h5>
                    </div>
                    <div className="col-6">
                      <small className="text-muted">Check-Out</small>
                      <h5 className="text-danger">{todayStatus.check_out}</h5>
                    </div>
                  </div>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #f8f9fa, #e9ecef)",
                      borderRadius: 15,
                      padding: 25,
                      margin: "20px 0",
                    }}
                  >
                    <h6 className="text-muted">Today&apos;s Working Hours</h6>
                    <h2 className="text-success mb-0">{todayStatus.working_hours}</h2>
                  </div>
                  <button className="btn btn-secondary d-block w-100" disabled>
                    <i className="bi bi-lock" /> Attendance Complete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Working Hours Summary */}
          <div className="col-md-7">
            <div className="row mb-4">
              <div className="col-6">
                <div className="text-center p-3 rounded" style={{ background: "#f8f9fa" }}>
                  <h3 className="text-primary">{history.days_present}</h3>
                  <div className="text-muted text-uppercase small">
                    Days Present
                    <br />
                    (30 days)
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="text-center p-3 rounded" style={{ background: "#f8f9fa" }}>
                  <h3 className="text-success">{history.total_working_hours}</h3>
                  <div className="text-muted text-uppercase small">
                    Total Hours
                    <br />
                    (30 days)
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-clock-history" /> Recent Attendance History
                </h5>
                <span className="badge bg-primary">Last 30 Days</span>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.records.map((record, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{record.Date}</strong>
                          </td>
                          <td>
                            {record["Check-In Time"] ? (
                              <span className="text-success">{record["Check-In Time"]}</span>
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
                              <strong>{record["Working Hours"]}</strong>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {history.records.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            <i className="bi bi-info-circle" /> No attendance records yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-calendar-x" /> Leave Requests
                </h5>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#requestLeaveModal"
                >
                  <i className="bi bi-plus-circle" /> Request Leave
                </button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Reason</th>
                        <th>Requested At</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myLeaves.map((leave, i) => (
                        <tr key={i}>
                          <td>{leave["Start Date"] || ""}</td>
                          <td>{leave["End Date"] || ""}</td>
                          <td>{leave.Reason || ""}</td>
                          <td>
                            <small className="text-muted">{leave["Requested At"] || ""}</small>
                          </td>
                          <td>
                            {leave.Status === "Approved" && (
                              <span className="badge bg-success">Approved</span>
                            )}
                            {leave.Status === "Rejected" && (
                              <span className="badge bg-danger">Rejected</span>
                            )}
                            {leave.Status !== "Approved" && leave.Status !== "Rejected" && (
                              <span className="badge bg-warning text-dark">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {myLeaves.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">
                            <i className="bi bi-info-circle" /> No leave requests yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Leave Modal */}
      <div className="modal fade" id="requestLeaveModal" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary">
              <h5 className="modal-title text-white">
                <i className="bi bi-calendar-x" /> Request Leave
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" />
            </div>
            <form action={requestLeaveAction}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Start Date</label>
                  <input type="date" name="start_date" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">End Date</label>
                  <input type="date" name="end_date" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Reason</label>
                  <textarea
                    name="reason"
                    className="form-control"
                    rows={3}
                    required
                    placeholder="Briefly describe the reason for your leave"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-send" /> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
