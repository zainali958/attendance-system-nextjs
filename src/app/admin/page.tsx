import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb, todayStr, getTimeZone, resolveExpectedStart } from "@/lib/sheetsDb";
import {
  addUserAction,
  changeUserPasswordAction,
  toggleAdminAction,
  toggleActiveAction,
  resetUserDeviceAction,
  importUsersAction,
  logoutAction,
  updateUserShiftAction,
  upsertDepartmentSettingAction,
  removeDepartmentSettingAction,
} from "@/lib/actions";
import FlashBanner from "@/components/FlashBanner";
import AdminOverviewLive from "@/components/AdminOverviewLive";
import AttendanceDateFilter from "@/components/AttendanceDateFilter";
import DownloadSampleCsv from "@/components/DownloadSampleCsv";
import ConfirmForm from "@/components/ConfirmForm";

export const metadata = { title: "Admin Panel - Attendance System" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const db = await getDb();

  const today = todayStr(getTimeZone());
  const stats = await db.getAttendanceStats(today);
  const todayAttendanceRaw = await db.getTodayAllAttendance();
  const todayAttendance = await db.annotateLateness(todayAttendanceRaw);
  const allUsers = await db.getAllUsers(true);
  const pendingLeaves = (await db.getAllLeaves("Pending")).length;
  const departmentSettings = await db.getDepartmentSettings();
  const latenessConfig = await db.getLatenessConfig();

  const departmentNames = Array.from(
    new Set(
      allUsers
        .map((u) => u.Department?.trim())
        .filter((d): d is string => !!d)
    )
  ).sort();

  return (
    <div className="container-fluid">
      <div className="row">
        {/* Sidebar */}
        <div
          className="col-md-2 p-0"
          style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
            color: "white",
          }}
        >
          <div className="p-4">
            <h4 className="mb-4">
              <i className="bi bi-shield-lock" /> Admin Panel
            </h4>
            <nav className="nav flex-column">
              <a className="nav-link text-white-50 active" href="#overview" data-bs-toggle="tab">
                <i className="bi bi-speedometer2" /> Dashboard
              </a>
              <a className="nav-link text-white-50" href="#users" data-bs-toggle="tab">
                <i className="bi bi-people" /> Users
              </a>
              <a className="nav-link text-white-50" href="#attendance" data-bs-toggle="tab">
                <i className="bi bi-calendar-check" /> Attendance Records
              </a>
              <Link className="nav-link text-white-50" href="/admin/leaves">
                <i className="bi bi-calendar-x" /> Leave Requests{" "}
                {pendingLeaves > 0 && <span className="badge bg-danger">{pendingLeaves}</span>}
              </Link>
              <Link className="nav-link text-white-50" href="/admin/analytics">
                <i className="bi bi-graph-up" /> Analytics
              </Link>
              <a className="nav-link text-white-50" href="#import" data-bs-toggle="tab">
                <i className="bi bi-upload" /> Import Users
              </a>
              <a className="nav-link text-white-50" href="#settings" data-bs-toggle="tab">
                <i className="bi bi-gear" /> Settings
              </a>
              <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.2)" }} />
              <Link className="nav-link text-white-50" href="/dashboard">
                <i className="bi bi-arrow-left" /> Back to Dashboard
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="nav-link text-white-50 btn btn-link p-0"
                  style={{ border: "none", background: "none" }}
                >
                  <i className="bi bi-box-arrow-right" /> Logout
                </button>
              </form>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-md-10 p-4 bg-light" style={{ minHeight: "100vh" }}>
          <FlashBanner />

          <div className="tab-content">
            {/* Overview Tab */}
            <div className="tab-pane fade show active" id="overview">
              <h3 className="mb-4">
                <i className="bi bi-speedometer2" /> Dashboard Overview
              </h3>
              <AdminOverviewLive
                initialStats={stats}
                initialAttendance={todayAttendance}
                today={today}
              />
              <p className="text-muted small mt-2 mb-0">
                <i className="bi bi-info-circle" /> &quot;Late&quot; is based on each
                employee&apos;s expected start time and grace period — set defaults per
                department, or per employee, in{" "}
                <a href="#settings" data-bs-toggle="tab">
                  Settings
                </a>
                .
              </p>
            </div>

            {/* Users Tab */}
            <div className="tab-pane fade" id="users">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>
                  <i className="bi bi-people" /> User Management
                </h3>
                <button
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#addUserModal"
                >
                  <i className="bi bi-plus-circle" /> Add New User
                </button>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Role</th>
                          <th>Shift</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.map((user) => {
                          const isActive =
                            String(user["Is Active"] ?? "TRUE").toUpperCase() === "TRUE";
                          const isAdmin =
                            String(user["Is Admin"] ?? "FALSE").toUpperCase() === "TRUE";
                          const hasOwnShift =
                            !!user["Expected Start Time"]?.trim() ||
                            !!user["Grace Minutes"]?.trim();
                          const { expectedStart, graceMinutes, source } = resolveExpectedStart(
                            latenessConfig,
                            user.Username,
                            user.Department || ""
                          );
                          return (
                            <tr key={user.Username}>
                              <td>
                                <strong>{user.Username}</strong>
                              </td>
                              <td>{user["Full Name"]}</td>
                              <td>{user.Email || "N/A"}</td>
                              <td>{user.Department || "N/A"}</td>
                              <td>{user.Designation || "N/A"}</td>
                              <td>{user.Phone || "N/A"}</td>
                              <td>
                                {isActive ? (
                                  <span
                                    className="px-2 py-1 rounded-pill"
                                    style={{ background: "#d4edda", color: "#155724" }}
                                  >
                                    Active
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary">Deactivated</span>
                                )}
                              </td>
                              <td>
                                {isAdmin ? (
                                  <span className="badge bg-danger">Admin</span>
                                ) : (
                                  <span className="badge bg-secondary">User</span>
                                )}
                              </td>
                              <td>
                                <span title={`Late after ${expectedStart.slice(0, 5)} + ${graceMinutes}m grace`}>
                                  {expectedStart.slice(0, 5)}
                                  {hasOwnShift ? (
                                    <span className="badge bg-info ms-1">Custom</span>
                                  ) : source === "department" ? (
                                    <span className="badge bg-secondary ms-1">Dept</span>
                                  ) : (
                                    <span className="badge bg-light text-dark ms-1">Default</span>
                                  )}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex flex-wrap gap-1">
                                  <Link
                                    href={`/admin/user/${encodeURIComponent(user.Username)}`}
                                    className="btn btn-sm btn-outline-primary"
                                  >
                                    <i className="bi bi-eye" /> View
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning"
                                    data-bs-toggle="modal"
                                    data-bs-target={`#changePassword-${user.Username}`}
                                  >
                                    <i className="bi bi-key" /> Password
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-info"
                                    data-bs-toggle="modal"
                                    data-bs-target={`#setShift-${user.Username}`}
                                  >
                                    <i className="bi bi-clock" /> Shift
                                  </button>
                                  <ConfirmForm
                                    action={toggleAdminAction.bind(null, user.Username)}
                                    confirmMessage={
                                      isAdmin
                                        ? `Remove admin access from ${user.Username}?`
                                        : `Grant admin access to ${user.Username}?`
                                    }
                                  >
                                    <input
                                      type="hidden"
                                      name="make_admin"
                                      value={isAdmin ? "0" : "1"}
                                    />
                                    <button
                                      type="submit"
                                      className={`btn btn-sm ${
                                        isAdmin ? "btn-outline-danger" : "btn-outline-success"
                                      }`}
                                    >
                                      <i className="bi bi-shield-lock" />{" "}
                                      {isAdmin ? "Remove Admin" : "Make Admin"}
                                    </button>
                                  </ConfirmForm>
                                  <ConfirmForm
                                    action={toggleActiveAction.bind(null, user.Username)}
                                    confirmMessage={
                                      isActive
                                        ? `Deactivate ${user.Username}? They will no longer be able to log in, but their attendance history is kept.`
                                        : `Reactivate ${user.Username}?`
                                    }
                                  >
                                    <input
                                      type="hidden"
                                      name="make_active"
                                      value={isActive ? "0" : "1"}
                                    />
                                    <button
                                      type="submit"
                                      className={`btn btn-sm ${
                                        isActive ? "btn-outline-danger" : "btn-outline-success"
                                      }`}
                                    >
                                      <i className="bi bi-person-x" />{" "}
                                      {isActive ? "Deactivate" : "Activate"}
                                    </button>
                                  </ConfirmForm>
                                  <form action={resetUserDeviceAction.bind(null, user.Username)}>
                                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                                      <i className="bi bi-phone" /> Reset Device
                                    </button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Records Tab */}
            <div className="tab-pane fade" id="attendance">
              <h3 className="mb-4">
                <i className="bi bi-calendar-check" /> Attendance Records
              </h3>
              <div className="card">
                <div className="card-body">
                  <AttendanceDateFilter initialDate={today} />
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle" /> Select a date and click &quot;View
                    Records&quot; for full editable details on that day, or use the button
                    below for today. You can also click a user in the Users tab to see
                    their complete history.
                  </div>
                  <Link href={`/admin/attendance/${today}`} className="btn btn-outline-secondary">
                    <i className="bi bi-calendar-check" /> Today&apos;s Records
                  </Link>
                </div>
              </div>
            </div>

            {/* Import Users Tab */}
            <div className="tab-pane fade" id="import">
              <h3 className="mb-4">
                <i className="bi bi-upload" /> Import Users
              </h3>
              <div className="row">
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-white">
                      <h5 className="mb-0">
                        <i className="bi bi-file-earmark-spreadsheet" /> Upload CSV File
                      </h5>
                    </div>
                    <div className="card-body">
                      <form action={importUsersAction}>
                        <div className="mb-3">
                          <label className="form-label fw-bold">Select CSV File</label>
                          <input type="file" name="file" className="form-control" accept=".csv" required />
                          <div className="form-text mt-2">
                            <strong>Required columns:</strong> Username, Password, Full Name, Email
                            <br />
                            <strong>Optional columns:</strong> Department, Designation, Phone,
                            Expected Start Time, Grace Minutes
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary">
                          <i className="bi bi-upload" /> Import Users
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card">
                    <div className="card-header bg-white">
                      <h5 className="mb-0">
                        <i className="bi bi-file-text" /> Sample CSV Format
                      </h5>
                    </div>
                    <div className="card-body">
                      <pre className="bg-light p-3 rounded" style={{ fontSize: 12 }}>
{`Username,Password,Full Name,Email,Department,Designation,Phone,Expected Start Time,Grace Minutes
john,password123,John Doe,john@company.com,Engineering,Developer,+1234567890,09:00,15
jane,password123,Jane Smith,jane@company.com,Marketing,Manager,+0987654321,,
bob,Welcome123,Bob Wilson,bob@company.com,Sales,Executive,+1122334455,08:30,10`}
                      </pre>
                      <DownloadSampleCsv />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Tab */}
            <div className="tab-pane fade" id="settings">
              <h3 className="mb-4">
                <i className="bi bi-gear" /> System Settings
              </h3>
              <div className="row">
                <div className="col-md-6">
                  <div className="card mb-3">
                    <div className="card-header bg-white">
                      <h5 className="mb-0">Google Sheets Information</h5>
                    </div>
                    <div className="card-body">
                      <p>
                        <strong>Spreadsheet Name:</strong> {process.env.GOOGLE_SHEET_NAME || "Attendance System"}
                      </p>
                      <p>
                        <strong>Users Sheet:</strong> Contains all employee data
                      </p>
                      <p>
                        <strong>Attendance Sheet:</strong> Contains check-in/check-out records
                      </p>
                      <p>
                        <strong>Connection Status:</strong> <span className="badge bg-success">Connected</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card mb-3">
                    <div className="card-header bg-white">
                      <h5 className="mb-0">System Statistics</h5>
                    </div>
                    <div className="card-body">
                      <p>
                        <strong>Total Registered Users:</strong> {stats.total_users}
                      </p>
                      <p>
                        <strong>Checked In Today:</strong> {stats.checked_in}
                      </p>
                      <p>
                        <strong>Checked Out Today:</strong> {stats.checked_out}
                      </p>
                      <p>
                        <strong>Attendance Rate:</strong> {stats.attendance_percentage}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-12">
                  <div className="card mb-3">
                    <div className="card-header bg-white">
                      <h5 className="mb-0">
                        <i className="bi bi-clock-history" /> Punctuality &amp; Shift Times
                      </h5>
                    </div>
                    <div className="card-body">
                      <p className="mb-3">
                        A check-in is flagged <span className="badge bg-danger">Late</span> once
                        it&apos;s past the expected start time plus the grace period. Anyone
                        without a department or personal override uses the system default of{" "}
                        <strong>{latenessConfig.defaultExpectedStart.slice(0, 5)}</strong> +{" "}
                        <strong>{latenessConfig.defaultGraceMinutes} minutes</strong>{" "}
                        (set via the <code>EXPECTED_START_TIME</code> and{" "}
                        <code>EXPECTED_GRACE_MINUTES</code> environment variables). Set a
                        per-department default below, or override an individual employee from the
                        Users tab.
                      </p>

                      <div className="table-responsive mb-3">
                        <table className="table table-sm table-hover">
                          <thead>
                            <tr>
                              <th>Department</th>
                              <th>Expected Start</th>
                              <th>Grace (min)</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {departmentSettings
                              .filter((d) => d["Expected Start Time"]?.trim())
                              .map((d) => (
                                <tr key={d.Department}>
                                  <td>{d.Department}</td>
                                  <td>{d["Expected Start Time"].slice(0, 5)}</td>
                                  <td>{d["Grace Minutes"] || latenessConfig.defaultGraceMinutes}</td>
                                  <td>
                                    <ConfirmForm
                                      action={removeDepartmentSettingAction.bind(null, d.Department)}
                                      confirmMessage={`Remove the shift override for ${d.Department}? It will fall back to the system default.`}
                                    >
                                      <button
                                        type="submit"
                                        className="btn btn-sm btn-outline-danger"
                                      >
                                        <i className="bi bi-trash" /> Remove
                                      </button>
                                    </ConfirmForm>
                                  </td>
                                </tr>
                              ))}
                            {departmentSettings.filter((d) => d["Expected Start Time"]?.trim())
                              .length === 0 && (
                              <tr>
                                <td colSpan={4} className="text-center text-muted py-3">
                                  No department overrides set — everyone uses the system default.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <form
                        action={upsertDepartmentSettingAction}
                        className="row g-2 align-items-end"
                      >
                        <div className="col-md-4">
                          <label className="form-label fw-bold">Department</label>
                          {departmentNames.length > 0 ? (
                            <select name="department" className="form-select" required>
                              {departmentNames.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              name="department"
                              className="form-control"
                              placeholder="Department name"
                              required
                            />
                          )}
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-bold">Expected Start</label>
                          <input type="time" name="expected_start_time" className="form-control" />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-bold">Grace (min)</label>
                          <input
                            type="number"
                            name="grace_minutes"
                            className="form-control"
                            min={0}
                            placeholder={String(latenessConfig.defaultGraceMinutes)}
                          />
                        </div>
                        <div className="col-md-2">
                          <button type="submit" className="btn btn-primary w-100">
                            <i className="bi bi-check-circle" /> Save
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <div className="modal fade" id="addUserModal" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-person-plus" /> Add New User
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" />
            </div>
            <form action={addUserAction}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">Username *</label>
                  <input type="text" name="username" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Password *</label>
                  <input type="password" name="password" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Full Name *</label>
                  <input type="text" name="full_name" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Email *</label>
                  <input type="email" name="email" className="form-control" required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Department</label>
                  <input type="text" name="department" className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Designation</label>
                  <input type="text" name="designation" className="form-control" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Phone</label>
                  <input type="text" name="phone" className="form-control" />
                </div>
                <hr />
                <div className="mb-3">
                  <label className="form-label">Expected Start Time</label>
                  <input
                    type="time"
                    name="expected_start_time"
                    className="form-control"
                  />
                  <small className="text-muted">
                    Leave blank to use the department or default shift time.
                  </small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Grace Period (minutes)</label>
                  <input
                    type="number"
                    name="grace_minutes"
                    className="form-control"
                    min={0}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-check-circle" /> Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Set Shift Modals (one per user) */}
      {allUsers.map((user) => (
        <div className="modal fade" id={`setShift-${user.Username}`} tabIndex={-1} key={`shift-${user.Username}`}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="bi bi-clock" /> Shift Override for {user.Username}
                </h5>
                <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" />
              </div>
              <form action={updateUserShiftAction.bind(null, user.Username)}>
                <div className="modal-body">
                  <p className="text-muted small">
                    Leave a field blank to inherit from {user.Department || "the"} department&apos;s
                    setting, or the system default if the department has none.
                  </p>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Expected Start Time</label>
                    <input
                      type="time"
                      name="expected_start_time"
                      className="form-control"
                      defaultValue={(user["Expected Start Time"] || "").slice(0, 5)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Grace Period (minutes)</label>
                    <input
                      type="number"
                      name="grace_minutes"
                      className="form-control"
                      min={0}
                      defaultValue={user["Grace Minutes"] || ""}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-info text-white">
                    <i className="bi bi-check-circle" /> Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ))}

      {/* Change Password Modals (one per user) */}
      {allUsers.map((user) => (
        <div className="modal fade" id={`changePassword-${user.Username}`} tabIndex={-1} key={user.Username}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="bi bi-key" /> Change Password for {user.Username}
                </h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" />
              </div>
              <form action={changeUserPasswordAction.bind(null, user.Username)}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">New Password *</label>
                    <input
                      type="password"
                      name="new_password"
                      className="form-control"
                      minLength={6}
                      required
                    />
                    <small className="text-muted">At least 6 characters.</small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-warning">
                    <i className="bi bi-check-circle" /> Update Password
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
