import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { generatePasswordHash, checkPasswordHash } from "./password";

// ==================== Types ====================

export interface UserRecord {
  Username: string;
  Password: string;
  "Full Name": string;
  Email: string;
  Department: string;
  Designation: string;
  Phone: string;
  "Is Active": string;
  "Is Admin": string;
  /** Per-user override of the expected check-in time. Blank = inherit from department/default. */
  "Expected Start Time"?: string;
  /** Per-user override of the grace period, in minutes. Blank = inherit from department/default. */
  "Grace Minutes"?: string;
}

export interface DepartmentSettingRecord {
  Department: string;
  /** Expected check-in time for this department, HH:MM or HH:MM:SS. Blank row = no override. */
  "Expected Start Time": string;
  "Grace Minutes": string;
  row_index?: number;
}

export interface AttendanceRecord {
  Date: string;
  Username: string;
  "Full Name": string;
  Email: string;
  Department: string;
  "Check-In Time": string;
  "Check-Out Time": string;
  "Working Hours": string;
}

export interface LeaveRecord {
  Username: string;
  "Full Name": string;
  "Start Date": string;
  "End Date": string;
  Reason: string;
  Status: string;
  "Requested At": string;
  "Reviewed By": string;
  "Reviewed At": string;
  row_index?: number;
}

export interface TodayAttendanceStatus {
  status: "not_checked_in" | "checked_in" | "checked_out";
  check_in: string | null;
  check_out: string | null;
  working_hours: string | null;
}

export interface AttendanceHistory {
  records: AttendanceRecord[];
  total_working_hours: string;
  days_present: number;
}

export interface AttendanceStats {
  total_users: number;
  checked_in: number;
  checked_out: number;
  not_checked_in: number;
  attendance_percentage: number;
}

export interface AttendanceTrendPoint {
  date: string;
  checked_in: number;
  checked_out: number;
  attendance_percentage: number;
}

export interface DepartmentStat {
  department: string;
  user_count: number;
  attendance_rate: number;
  avg_daily_hours: number;
}

export interface PunctualityStats {
  expected_start: string;
  grace_minutes: number;
  on_time: number;
  late: number;
  on_time_percentage: number;
  by_department: Array<{
    department: string;
    on_time: number;
    late: number;
    on_time_percentage: number;
  }>;
}

/** Resolved late-arrival configuration, from EXPECTED_START_TIME/EXPECTED_GRACE_MINUTES
 * env vars, overridden per-department (Departments sheet), overridden per-user
 * (Users sheet "Expected Start Time" / "Grace Minutes" columns). */
export interface LatenessConfig {
  defaultExpectedStart: string;
  defaultGraceMinutes: number;
  departmentOverrides: Map<string, { expectedStart: string; graceMinutes: number }>;
  userOverrides: Map<string, { expectedStart?: string; graceMinutes?: number }>;
}

export interface ExpectedStartResolution {
  expectedStart: string;
  graceMinutes: number;
  source: "user" | "department" | "default";
}

export interface AttendanceRecordWithLateness extends AttendanceRecord {
  is_late: boolean;
  expected_start: string;
  lateness_source: "user" | "department" | "default";
}

// ==================== Simple TTL cache ====================

class TTLCache<K, V> {
  private store = new Map<K, { value: V; expires: number }>();
  constructor(private ttlMs: number) {}
  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key: K, value: V) {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
  clear() {
    this.store.clear();
  }
}

// Mirrors the Python TTLCache(maxsize=500, ttl=300) / (maxsize=1000, ttl=60).
// Module-scoped so it's shared across requests handled by the same warm
// Node.js server process (this app is meant to run as a persistent Node
// server via `next start`, not as short-lived edge/serverless functions,
// same assumption the original single-process Flask app made).
const userCache = new TTLCache<string, any>(5 * 60 * 1000);
const attendanceCache = new TTLCache<string, any>(60 * 1000);

// ==================== Simple async mutex ====================
// Serializes writes to the Users sheet, mirroring the Python
// threading.Lock() used to avoid the "two near-simultaneous Add User
// requests overwrite each other" bug.
class Mutex {
  private locked = false;
  private queue: Array<() => void> = [];
  async lock(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.unlock();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve(() => this.unlock());
      });
    });
  }
  private unlock() {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}
const usersSheetLock = new Mutex();

// ==================== Helpers ====================

function timeZoneOffsetNow(timeZone: string): Date {
  // Returns a Date whose local wall-clock fields (via toISOString-free
  // formatting) represent "now" in the given IANA timezone.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get(
      "minute"
    )}:${get("second")}`
  );
}

function todayStr(timeZone: string): string {
  const d = timeZoneOffsetNow(timeZone);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeStr(timeZone: string): string {
  const d = timeZoneOffsetNow(timeZone);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function timestampStr(timeZone: string): string {
  return `${todayStr(timeZone)} ${timeStr(timeZone)}`;
}

function parseTimeFlexible(s: string): { h: number; m: number; sec: number } {
  // Accepts HH:MM:SS or HH:MM (HTML <input type=time> gives HH:MM).
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) {
    throw new Error("Invalid time format");
  }
  return { h: parts[0], m: parts[1], sec: parts[2] ?? 0 };
}

function timeToMinutes(t: { h: number; m: number; sec: number }): number {
  return t.h * 3600 + t.m * 60 + t.sec;
}
// timeToMinutes actually returns total seconds (name kept for backwards
// compatibility with earlier revisions of this file); timeToSeconds is the
// accurately-named alias used by newer code.
const timeToSeconds = timeToMinutes;

function formatHHMMSS(t: { h: number; m: number; sec: number }): string {
  return `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(
    2,
    "0"
  )}:${String(t.sec).padStart(2, "0")}`;
}

function diffWorkingHours(checkIn: string, checkOut: string): string {
  const inT = parseTimeFlexible(checkIn);
  let outSeconds = timeToMinutes(parseTimeFlexible(checkOut));
  const inSeconds = timeToMinutes(inT);
  if (outSeconds < inSeconds) {
    outSeconds += 24 * 3600; // night shift wrap
  }
  const totalSeconds = outSeconds - inSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function getTimeZone(): string {
  return process.env.TIMEZONE || "UTC";
}

/** Precedence: per-user override > per-department override > global default. A
 * user override only wins field-by-field (e.g. a user can override just the
 * grace period and still inherit the department's expected start time). */
export function resolveExpectedStart(
  config: LatenessConfig,
  username: string,
  department: string
): ExpectedStartResolution {
  const dept = department?.trim() || "";
  const deptOverride = dept ? config.departmentOverrides.get(dept) : undefined;
  const userOverride = config.userOverrides.get(username);

  let expectedStart = deptOverride?.expectedStart ?? config.defaultExpectedStart;
  let graceMinutes = deptOverride?.graceMinutes ?? config.defaultGraceMinutes;
  let source: ExpectedStartResolution["source"] = deptOverride ? "department" : "default";

  if (userOverride?.expectedStart) {
    expectedStart = userOverride.expectedStart;
    source = "user";
  }
  if (userOverride?.graceMinutes !== undefined) {
    graceMinutes = userOverride.graceMinutes;
    source = "user";
  }

  return { expectedStart, graceMinutes, source };
}

/** Whether a recorded check-in time falls after the expected start + grace period. */
export function checkInIsLate(
  checkInTime: string,
  expectedStart: string,
  graceMinutes: number
): boolean {
  try {
    const cutoffSeconds =
      timeToSeconds(parseTimeFlexible(expectedStart)) + graceMinutes * 60;
    const seconds = timeToSeconds(parseTimeFlexible(checkInTime));
    return seconds > cutoffSeconds;
  } catch {
    return false;
  }
}

// ==================== GoogleSheetsDB ====================

class GoogleSheetsDB {
  private doc!: GoogleSpreadsheet;
  usersSheet!: GoogleSpreadsheetWorksheet;
  attendanceSheet!: GoogleSpreadsheetWorksheet;
  devicesSheet!: GoogleSpreadsheetWorksheet;
  leavesSheet!: GoogleSpreadsheetWorksheet;
  departmentsSheet!: GoogleSpreadsheetWorksheet;
  private connected = false;
  private connecting: Promise<void> | null = null;

  async ensureConnected() {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = this._connect();
    try {
      await this.connecting;
      this.connected = true;
    } catch (e) {
      // Don't let a failed connection attempt (e.g. a transient Sheets API
      // error, or the one-time schema migration) permanently wedge the
      // singleton — clear it so the next request tries again from scratch.
      this.connecting = null;
      throw e;
    }
  }

  private async _connect() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error(
        "GOOGLE_SHEET_ID is not set. Create/open the spreadsheet in Google " +
          "Sheets, copy the ID from its URL, and set it in your environment."
      );
    }

    let email: string | undefined;
    let privateKey: string | undefined;

    const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (credsJson) {
      const creds = JSON.parse(credsJson);
      email = creds.client_email;
      privateKey = creds.private_key;
    } else {
      email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    }

    if (!email || !privateKey) {
      throw new Error(
        "Google service account credentials are missing. Set either " +
          "GOOGLE_CREDENTIALS_JSON (full key file contents) or both " +
          "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
      );
    }

    const auth = new JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.doc = new GoogleSpreadsheet(sheetId, auth);
    await this.doc.loadInfo();

    await this._initUsersSheet();
    await this._initAttendanceSheet();
    await this._initDevicesSheet();
    await this._initLeavesSheet();
    await this._initDepartmentsSheet();
  }

  private async _initUsersSheet() {
    let sheet = this.doc.sheetsByTitle["Users"];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: "Users",
        headerValues: [
          "Username",
          "Password",
          "Full Name",
          "Email",
          "Department",
          "Designation",
          "Phone",
          "Is Active",
          "Is Admin",
          "Expected Start Time",
          "Grace Minutes",
        ],
      });
      await sheet.addRow({
        Username: "admin",
        Password: generatePasswordHash("admin123"),
        "Full Name": "Administrator",
        Email: "admin@company.com",
        Department: "IT",
        Designation: "System Admin",
        Phone: "",
        "Is Active": "TRUE",
        "Is Admin": "TRUE",
        "Expected Start Time": "",
        "Grace Minutes": "",
      });
    } else {
      // Migrate sheets created before per-user shift overrides existed:
      // append the new columns without touching existing data.
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues;
      const missing = ["Expected Start Time", "Grace Minutes"].filter(
        (h) => !headers.includes(h)
      );
      if (missing.length) {
        const newHeaders = [...headers, ...missing];
        // setHeaderRow doesn't grow the sheet itself — a sheet created with
        // the old (narrower) header set won't have enough columns to hold
        // the new ones, so resize first or the write is rejected.
        if (sheet.columnCount < newHeaders.length) {
          await sheet.resize({
            rowCount: sheet.rowCount,
            columnCount: newHeaders.length,
          });
        }
        await sheet.setHeaderRow(newHeaders);
      }
    }
    this.usersSheet = sheet;
  }

  private async _initDepartmentsSheet() {
    let sheet = this.doc.sheetsByTitle["Departments"];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: "Departments",
        headerValues: ["Department", "Expected Start Time", "Grace Minutes"],
      });
    }
    this.departmentsSheet = sheet;
  }

  private async _initAttendanceSheet() {
    let sheet = this.doc.sheetsByTitle["Attendance"];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: "Attendance",
        headerValues: [
          "Date",
          "Username",
          "Full Name",
          "Email",
          "Department",
          "Check-In Time",
          "Check-Out Time",
          "Working Hours",
        ],
      });
    }
    this.attendanceSheet = sheet;
  }

  private async _initDevicesSheet() {
    let sheet = this.doc.sheetsByTitle["Devices"];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: "Devices",
        headerValues: ["Username", "Device Token", "Registered At", "User Agent"],
      });
    }
    this.devicesSheet = sheet;
  }

  private async _initLeavesSheet() {
    let sheet = this.doc.sheetsByTitle["Leaves"];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: "Leaves",
        headerValues: [
          "Username",
          "Full Name",
          "Start Date",
          "End Date",
          "Reason",
          "Status",
          "Requested At",
          "Reviewed By",
          "Reviewed At",
        ],
      });
    }
    this.leavesSheet = sheet;
  }

  // ==================== User Operations ====================

  async getAllUsers(includeInactive = false): Promise<UserRecord[]> {
    const cacheKey = includeInactive ? "all_users_with_inactive" : "all_users";
    const cached = userCache.get(cacheKey);
    if (cached) return cached;

    try {
      const rows = await this.usersSheet.getRows<UserRecord>();
      let users = rows.map((r) => r.toObject() as UserRecord);
      if (!includeInactive) {
        users = users.filter(
          (u) => String(u["Is Active"] ?? "TRUE").toUpperCase() === "TRUE"
        );
      }
      userCache.set(cacheKey, users);
      return users;
    } catch (e) {
      console.error("Error fetching users:", e);
      return [];
    }
  }

  async getUserByUsername(
    username: string,
    useCache = true
  ): Promise<UserRecord | null> {
    let users: UserRecord[];
    if (useCache) {
      users = await this.getAllUsers();
    } else {
      try {
        const rows = await this.usersSheet.getRows<UserRecord>();
        users = rows
          .map((r) => r.toObject() as UserRecord)
          .filter(
            (u) => String(u["Is Active"] ?? "TRUE").toUpperCase() === "TRUE"
          );
      } catch (e) {
        console.error("Error fetching users:", e);
        return null;
      }
    }
    return users.find((u) => u.Username === username) ?? null;
  }

  async addUser(
    username: string,
    password: string,
    fullName: string,
    email: string,
    department = "",
    designation = "",
    phone = "",
    isActive = true,
    isAdmin = false,
    expectedStartTime = "",
    graceMinutes = ""
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const existing = await this.getUserByUsername(username, false);
      if (existing) {
        return [false, "Username already exists"];
      }

      let normalizedStart = "";
      if (expectedStartTime.trim()) {
        try {
          normalizedStart = formatHHMMSS(parseTimeFlexible(expectedStartTime.trim()));
        } catch {
          return [false, "Expected start time must be in HH:MM or HH:MM:SS format"];
        }
      }

      const passwordHash = generatePasswordHash(password);
      await this.usersSheet.addRow({
        Username: username,
        Password: passwordHash,
        "Full Name": fullName,
        Email: email,
        Department: department,
        Designation: designation,
        Phone: phone,
        "Is Active": String(isActive).toUpperCase(),
        "Is Admin": String(isAdmin).toUpperCase(),
        "Expected Start Time": normalizedStart,
        "Grace Minutes": graceMinutes.trim(),
      });
      userCache.clear();
      return [true, "User added successfully"];
    } catch (e: any) {
      return [false, `Error adding user: ${e.message}`];
    } finally {
      unlock();
    }
  }

  /** Set (or clear, if both args are blank) a per-user override of the expected
   * check-in shift. Leaving one field blank clears just that field, so a user
   * can e.g. keep the department's expected start time but get extra grace. */
  async setUserExpectedStart(
    username: string,
    expectedStartTime: string,
    graceMinutes: string
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      let normalizedStart = "";
      if (expectedStartTime.trim()) {
        try {
          normalizedStart = formatHHMMSS(parseTimeFlexible(expectedStartTime.trim()));
        } catch {
          return [false, "Expected start time must be in HH:MM or HH:MM:SS format"];
        }
      }
      if (graceMinutes.trim() && Number.isNaN(parseInt(graceMinutes.trim(), 10))) {
        return [false, "Grace minutes must be a whole number"];
      }

      const rows = await this.usersSheet.getRows<UserRecord>();
      const row = rows.find((r) => r.get("Username") === username);
      if (!row) return [false, "User not found"];

      row.set("Expected Start Time", normalizedStart);
      row.set("Grace Minutes", graceMinutes.trim());
      await row.save();
      userCache.clear();
      return [
        true,
        normalizedStart || graceMinutes.trim()
          ? `Shift override saved for ${username}`
          : `Shift override cleared for ${username} — now inherits the department/default time`,
      ];
    } catch (e: any) {
      return [false, `Error updating shift override: ${e.message}`];
    } finally {
      unlock();
    }
  }

  // ==================== Department shift settings ====================

  async getDepartmentSettings(): Promise<DepartmentSettingRecord[]> {
    const cached = userCache.get("department_settings");
    if (cached) return cached;
    try {
      const rows = await this.departmentsSheet.getRows<DepartmentSettingRecord>();
      const settings = rows.map((r) => {
        const obj = r.toObject() as DepartmentSettingRecord;
        obj.row_index = r.rowNumber;
        return obj;
      });
      userCache.set("department_settings", settings);
      return settings;
    } catch (e) {
      console.error("Error fetching department settings:", e);
      return [];
    }
  }

  /** Add or update the expected-start override for a department. Blank fields
   * clear that field (department then falls back further to the global default). */
  async upsertDepartmentSetting(
    department: string,
    expectedStartTime: string,
    graceMinutes: string
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const dept = department.trim();
      if (!dept) return [false, "Department is required"];

      let normalizedStart = "";
      if (expectedStartTime.trim()) {
        try {
          normalizedStart = formatHHMMSS(parseTimeFlexible(expectedStartTime.trim()));
        } catch {
          return [false, "Expected start time must be in HH:MM or HH:MM:SS format"];
        }
      }
      if (graceMinutes.trim() && Number.isNaN(parseInt(graceMinutes.trim(), 10))) {
        return [false, "Grace minutes must be a whole number"];
      }

      const rows = await this.departmentsSheet.getRows<DepartmentSettingRecord>();
      const existing = rows.find((r) => r.get("Department")?.trim() === dept);
      if (existing) {
        existing.set("Expected Start Time", normalizedStart);
        existing.set("Grace Minutes", graceMinutes.trim());
        await existing.save();
      } else {
        await this.departmentsSheet.addRow({
          Department: dept,
          "Expected Start Time": normalizedStart,
          "Grace Minutes": graceMinutes.trim(),
        });
      }
      userCache.clear();
      return [true, `Expected start time saved for ${dept}`];
    } catch (e: any) {
      return [false, `Error updating department setting: ${e.message}`];
    } finally {
      unlock();
    }
  }

  async deleteDepartmentSetting(department: string): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const dept = department.trim();
      const rows = await this.departmentsSheet.getRows<DepartmentSettingRecord>();
      const existing = rows.find((r) => r.get("Department")?.trim() === dept);
      if (!existing) return [false, "No override found for that department"];
      await existing.delete();
      userCache.clear();
      return [true, `${dept} reverted to the default expected start time`];
    } catch (e: any) {
      return [false, `Error removing department setting: ${e.message}`];
    } finally {
      unlock();
    }
  }

  /** Loads the full set of expected-start overrides (global/department/user) once,
   * for resolving lateness against a batch of attendance records cheaply. */
  async getLatenessConfig(): Promise<LatenessConfig> {
    const defaultExpectedStart = process.env.EXPECTED_START_TIME?.trim() || "09:00:00";
    const defaultGraceMinutes = parseInt(process.env.EXPECTED_GRACE_MINUTES || "15", 10);

    const [users, deptSettings] = await Promise.all([
      this.getAllUsers(true),
      this.getDepartmentSettings(),
    ]);

    const departmentOverrides = new Map<
      string,
      { expectedStart: string; graceMinutes: number }
    >();
    for (const d of deptSettings) {
      const start = d["Expected Start Time"]?.trim();
      if (!start) continue;
      const graceRaw = parseInt(d["Grace Minutes"] || "", 10);
      departmentOverrides.set(d.Department.trim(), {
        expectedStart: start,
        graceMinutes: Number.isFinite(graceRaw) ? graceRaw : defaultGraceMinutes,
      });
    }

    const userOverrides = new Map<
      string,
      { expectedStart?: string; graceMinutes?: number }
    >();
    for (const u of users) {
      const start = u["Expected Start Time"]?.trim();
      const graceRawStr = u["Grace Minutes"]?.trim();
      if (!start && !graceRawStr) continue;
      const graceRaw = graceRawStr ? parseInt(graceRawStr, 10) : undefined;
      userOverrides.set(u.Username, {
        expectedStart: start || undefined,
        graceMinutes: Number.isFinite(graceRaw as number) ? graceRaw : undefined,
      });
    }

    return { defaultExpectedStart, defaultGraceMinutes, departmentOverrides, userOverrides };
  }

  /** Attaches an is_late flag (and the threshold used) to each attendance record,
   * resolving per-user, then per-department, then global-default expected start times. */
  async annotateLateness(
    records: AttendanceRecord[]
  ): Promise<AttendanceRecordWithLateness[]> {
    const config = await this.getLatenessConfig();
    return records.map((r) => {
      const dept = r.Department?.trim() || "Unassigned";
      const { expectedStart, graceMinutes, source } = resolveExpectedStart(
        config,
        r.Username,
        dept
      );
      const checkIn = r["Check-In Time"];
      const is_late = !!checkIn && checkInIsLate(checkIn, expectedStart, graceMinutes);
      return { ...r, is_late, expected_start: expectedStart, lateness_source: source };
    });
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const rows = await this.usersSheet.getRows<UserRecord>();
    for (const row of rows) {
      if (row.get("Username") === username) {
        const storedHash = row.get("Password");
        return checkPasswordHash(storedHash, password);
      }
    }
    return false;
  }

  async updatePassword(
    username: string,
    newPassword: string
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const rows = await this.usersSheet.getRows<UserRecord>();
      for (const row of rows) {
        if (row.get("Username") === username) {
          row.set("Password", generatePasswordHash(newPassword));
          await row.save();
          userCache.clear();
          return [true, `Password updated for ${username}`];
        }
      }
      return [false, "User not found"];
    } catch (e: any) {
      return [false, `Error updating password: ${e.message}`];
    } finally {
      unlock();
    }
  }

  async countAdmins(): Promise<number> {
    const rows = await this.usersSheet.getRows<UserRecord>();
    return rows.filter(
      (r) => String(r.get("Is Admin") ?? "").trim().toUpperCase() === "TRUE"
    ).length;
  }

  async setAdminStatus(
    username: string,
    makeAdmin: boolean
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      if (!makeAdmin && (await this.countAdmins()) <= 1) {
        return [false, "Can't remove admin from the last remaining admin account"];
      }
      const rows = await this.usersSheet.getRows<UserRecord>();
      for (const row of rows) {
        if (row.get("Username") === username) {
          row.set("Is Admin", String(makeAdmin).toUpperCase());
          await row.save();
          userCache.clear();
          return [
            true,
            `${username} is now ${makeAdmin ? "an admin" : "a regular user"}`,
          ];
        }
      }
      return [false, "User not found"];
    } catch (e: any) {
      return [false, `Error updating admin status: ${e.message}`];
    } finally {
      unlock();
    }
  }

  async setActiveStatus(
    username: string,
    isActive: boolean
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const rows = await this.usersSheet.getRows<UserRecord>();
      const row = rows.find((r) => r.get("Username") === username);
      if (!row) return [false, "User not found"];

      const isTargetAdmin =
        String(row.get("Is Admin") ?? "").trim().toUpperCase() === "TRUE";

      if (!isActive && isTargetAdmin) {
        const activeAdmins = rows.filter(
          (r) =>
            String(r.get("Is Admin") ?? "").trim().toUpperCase() === "TRUE" &&
            String(r.get("Is Active") ?? "TRUE").trim().toUpperCase() !==
              "FALSE"
        ).length;
        if (activeAdmins <= 1) {
          return [false, "Can't deactivate the last remaining active admin"];
        }
      }

      row.set("Is Active", String(isActive).toUpperCase());
      await row.save();
      userCache.clear();
      return [true, `${username} is now ${isActive ? "active" : "deactivated"}`];
    } catch (e: any) {
      return [false, `Error updating active status: ${e.message}`];
    } finally {
      unlock();
    }
  }

  // ==================== Leave Requests ====================

  async requestLeave(
    username: string,
    fullName: string,
    startDate: string,
    endDate: string,
    reason: string
  ): Promise<[boolean, string]> {
    try {
      await this.leavesSheet.addRow({
        Username: username,
        "Full Name": fullName,
        "Start Date": startDate,
        "End Date": endDate,
        Reason: reason,
        Status: "Pending",
        "Requested At": timestampStr(getTimeZone()),
        "Reviewed By": "",
        "Reviewed At": "",
      });
      return [true, "Leave request submitted"];
    } catch (e: any) {
      return [false, `Error submitting leave request: ${e.message}`];
    }
  }

  async getLeavesForUser(username: string): Promise<LeaveRecord[]> {
    try {
      const rows = await this.leavesSheet.getRows<LeaveRecord>();
      const mine = rows
        .map((r) => r.toObject() as LeaveRecord)
        .filter((r) => r.Username === username);
      mine.reverse();
      return mine;
    } catch (e) {
      console.error("Error fetching leaves:", e);
      return [];
    }
  }

  async getAllLeaves(statusFilter?: string | null): Promise<LeaveRecord[]> {
    try {
      const rows = await this.leavesSheet.getRows<LeaveRecord>();
      let leaves = rows.map((r) => {
        const obj = r.toObject() as LeaveRecord;
        obj.row_index = r.rowNumber;
        return obj;
      });
      if (statusFilter) {
        leaves = leaves.filter((l) => l.Status === statusFilter);
      }
      leaves.reverse();
      return leaves;
    } catch (e) {
      console.error("Error fetching leaves:", e);
      return [];
    }
  }

  async decideLeave(
    rowIndex: number,
    decision: "Approved" | "Rejected",
    reviewedBy: string
  ): Promise<[boolean, string]> {
    try {
      const rows = await this.leavesSheet.getRows<LeaveRecord>();
      const row = rows.find((r) => r.rowNumber === rowIndex);
      if (!row) return [false, "Leave request not found"];
      row.set("Status", decision);
      row.set("Reviewed By", reviewedBy);
      row.set("Reviewed At", timestampStr(getTimeZone()));
      await row.save();
      return [true, `Leave request ${decision.toLowerCase()}`];
    } catch (e: any) {
      return [false, `Error updating leave request: ${e.message}`];
    }
  }

  // ==================== Device Binding Operations ====================

  async getDeviceToken(
    username: string
  ): Promise<{ rowIndex: number | null; token: string | null }> {
    try {
      const rows = await this.devicesSheet.getRows();
      const row = rows.find((r) => r.get("Username") === username);
      if (!row) return { rowIndex: null, token: null };
      return { rowIndex: row.rowNumber, token: row.get("Device Token") || "" };
    } catch (e) {
      console.error("Error reading device token:", e);
      return { rowIndex: null, token: null };
    }
  }

  async registerDevice(
    username: string,
    deviceToken: string,
    userAgent = ""
  ): Promise<boolean> {
    const unlock = await usersSheetLock.lock();
    try {
      await this.devicesSheet.addRow({
        Username: username,
        "Device Token": deviceToken,
        "Registered At": timestampStr(getTimeZone()),
        "User Agent": userAgent,
      });
      return true;
    } catch (e) {
      console.error("Error registering device:", e);
      return false;
    } finally {
      unlock();
    }
  }

  async resetDevice(username: string): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const { rowIndex } = await this.getDeviceToken(username);
      if (rowIndex === null) {
        return [false, "No device is registered for this user"];
      }
      const rows = await this.devicesSheet.getRows();
      const row = rows.find((r) => r.rowNumber === rowIndex);
      if (row) await row.delete();
      return [true, `Device binding cleared for ${username}`];
    } catch (e: any) {
      return [false, `Error resetting device: ${e.message}`];
    } finally {
      unlock();
    }
  }

  // ==================== Attendance Operations ====================

  async getTodayAttendanceRecord(username: string) {
    const today = todayStr(getTimeZone());
    return this._findAttendanceRecord(username, today);
  }

  private async _findAttendanceRecord(username: string, dateStr: string) {
    try {
      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const row = rows.find(
        (r) => r.get("Date") === dateStr && r.get("Username") === username
      );
      if (!row) return null;
      return {
        rowNumber: row.rowNumber,
        date: row.get("Date") || "",
        username: row.get("Username") || "",
        full_name: row.get("Full Name") || "",
        email: row.get("Email") || "",
        department: row.get("Department") || "",
        check_in_time: row.get("Check-In Time") || "",
        check_out_time: row.get("Check-Out Time") || "",
        working_hours: row.get("Working Hours") || "",
      };
    } catch (e) {
      console.error("Error getting attendance record:", e);
      return null;
    }
  }

  async checkIn(userData: UserRecord): Promise<[boolean, string]> {
    try {
      const existing = await this.getTodayAttendanceRecord(userData.Username);
      if (existing && existing.check_in_time) {
        return [false, "You have already checked in today"];
      }

      const tz = getTimeZone();
      const dateStr = todayStr(tz);
      const time = timeStr(tz);

      if (existing) {
        const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
        const row = rows.find((r) => r.rowNumber === existing.rowNumber);
        if (row) {
          row.set("Check-In Time", time);
          await row.save();
        }
      } else {
        await this.attendanceSheet.addRow({
          Date: dateStr,
          Username: userData.Username,
          "Full Name": userData["Full Name"],
          Email: userData.Email || "",
          Department: userData.Department || "",
          "Check-In Time": time,
          "Check-Out Time": "",
          "Working Hours": "",
        });
      }

      attendanceCache.clear();
      return [true, `Check-in recorded at ${time}`];
    } catch (e: any) {
      return [false, `Error recording check-in: ${e.message}`];
    }
  }

  async checkOut(username: string): Promise<[boolean, string]> {
    try {
      const existing = await this.getTodayAttendanceRecord(username);
      if (!existing) {
        return [false, "No check-in record found for today. Please check-in first."];
      }
      if (!existing.check_in_time) {
        return [false, "Please check-in first before checking out."];
      }
      if (existing.check_out_time) {
        return [false, "You have already checked out today"];
      }

      const tz = getTimeZone();
      const time = timeStr(tz);
      const workingHours = diffWorkingHours(existing.check_in_time, time);

      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const row = rows.find((r) => r.rowNumber === existing.rowNumber);
      if (row) {
        row.set("Check-Out Time", time);
        row.set("Working Hours", workingHours);
        await row.save();
      }

      attendanceCache.clear();
      return [
        true,
        `Check-out recorded at ${time}. Working hours: ${workingHours}`,
      ];
    } catch (e: any) {
      return [false, `Error recording check-out: ${e.message}`];
    }
  }

  async adminGetAttendanceRecord(username: string, dateStr: string) {
    return this._findAttendanceRecord(username, dateStr);
  }

  async adminUpdateAttendance(
    username: string,
    dateStr: string,
    checkInTimeInput: string,
    checkOutTimeInput: string
  ): Promise<[boolean, string]> {
    try {
      const record = await this.adminGetAttendanceRecord(username, dateStr);
      if (!record) {
        return [
          false,
          `No attendance record found for ${username} on ${dateStr}`,
        ];
      }

      const checkInTime = (checkInTimeInput || "").trim() || record.check_in_time;
      const checkOutTime =
        (checkOutTimeInput || "").trim() || record.check_out_time;

      let workingHoursStr = "";
      if (checkInTime && checkOutTime) {
        try {
          workingHoursStr = diffWorkingHours(checkInTime, checkOutTime);
        } catch {
          return [false, "Times must be in HH:MM or HH:MM:SS format"];
        }
      }

      const normalizedCheckIn = checkInTime
        ? formatHHMMSS(parseTimeFlexible(checkInTime))
        : "";
      const normalizedCheckOut = checkOutTime
        ? formatHHMMSS(parseTimeFlexible(checkOutTime))
        : "";

      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const row = rows.find((r) => r.rowNumber === record.rowNumber);
      if (row) {
        row.set("Check-In Time", normalizedCheckIn);
        row.set("Check-Out Time", normalizedCheckOut);
        row.set("Working Hours", workingHoursStr);
        await row.save();
      }

      attendanceCache.clear();
      return [true, `Attendance updated for ${username} on ${dateStr}`];
    } catch (e: any) {
      return [false, `Error updating attendance: ${e.message}`];
    }
  }

  async getUserWorkingHoursToday(username: string): Promise<TodayAttendanceStatus> {
    const record = await this.getTodayAttendanceRecord(username);
    if (record) {
      return {
        check_in: record.check_in_time || null,
        check_out: record.check_out_time || null,
        working_hours: record.working_hours || null,
        status: record.check_out_time
          ? "checked_out"
          : record.check_in_time
          ? "checked_in"
          : "not_checked_in",
      };
    }
    return {
      status: "not_checked_in",
      check_in: null,
      check_out: null,
      working_hours: null,
    };
  }

  async getUserAttendanceHistory(
    username: string,
    days = 30
  ): Promise<AttendanceHistory> {
    try {
      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const userRecords = rows
        .map((r) => r.toObject() as AttendanceRecord)
        .filter((r) => r.Username === username);

      userRecords.sort((a, b) => (a.Date < b.Date ? 1 : a.Date > b.Date ? -1 : 0));

      let totalHours = 0;
      let totalMinutes = 0;
      const slice = userRecords.slice(0, days);
      for (const record of slice) {
        const wh = record["Working Hours"];
        if (wh && wh.includes("h") && wh.includes("m")) {
          const parts = wh.replace("h", " ").replace("m", "").trim().split(/\s+/);
          if (parts.length >= 2) {
            totalHours += parseInt(parts[0], 10) || 0;
            totalMinutes += parseInt(parts[1], 10) || 0;
          }
        }
      }
      totalHours += Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      return {
        records: slice,
        total_working_hours: `${totalHours}h ${remainingMinutes}m`,
        days_present: slice.filter((r) => r["Check-In Time"]).length,
      };
    } catch (e) {
      console.error("Error fetching user history:", e);
      return { records: [], total_working_hours: "0h 0m", days_present: 0 };
    }
  }

  async getUserAttendanceByMonth(
    username: string,
    yearMonth: string
  ): Promise<AttendanceRecord[]> {
    try {
      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const records = rows
        .map((r) => r.toObject() as AttendanceRecord)
        .filter(
          (r) => r.Username === username && String(r.Date || "").startsWith(yearMonth)
        );
      records.sort((a, b) => (a.Date > b.Date ? 1 : a.Date < b.Date ? -1 : 0));
      return records;
    } catch (e) {
      console.error("Error fetching month attendance:", e);
      return [];
    }
  }

  async getTodayAllAttendance(): Promise<AttendanceRecord[]> {
    const today = todayStr(getTimeZone());
    return this.getAttendanceByDate(today);
  }

  async getAttendanceByDate(filterDate: string): Promise<AttendanceRecord[]> {
    try {
      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      return rows
        .map((r) => r.toObject() as AttendanceRecord)
        .filter((r) => r.Date === filterDate);
    } catch (e) {
      console.error("Error fetching date attendance:", e);
      return [];
    }
  }

  async getAttendanceStats(filterDate?: string): Promise<AttendanceStats> {
    const date = filterDate || todayStr(getTimeZone());
    try {
      const records = await this.getAttendanceByDate(date);
      const totalUsers = (await this.getAllUsers()).length;
      const checkedIn = records.filter((r) => r["Check-In Time"]).length;
      const checkedOut = records.filter((r) => r["Check-Out Time"]).length;
      return {
        total_users: totalUsers,
        checked_in: checkedIn,
        checked_out: checkedOut,
        not_checked_in: totalUsers - checkedIn,
        attendance_percentage:
          totalUsers > 0
            ? Math.round((checkedIn / totalUsers) * 10000) / 100
            : 0,
      };
    } catch (e) {
      console.error("Error getting stats:", e);
      return {
        total_users: 0,
        checked_in: 0,
        checked_out: 0,
        not_checked_in: 0,
        attendance_percentage: 0,
      };
    }
  }

  // ==================== Analytics ====================

  private lastNDates(days: number, endDateStr: string): string[] {
    const dates: string[] = [];
    const end = new Date(`${endDateStr}T00:00:00`);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`
      );
    }
    return dates;
  }

  /** Daily check-in / check-out counts (and % of headcount) for the last N days. */
  async getAttendanceTrends(days = 30): Promise<AttendanceTrendPoint[]> {
    try {
      const tz = getTimeZone();
      const endDateStr = todayStr(tz);
      const dates = this.lastNDates(days, endDateStr);
      const startStr = dates[0];

      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();
      const totalUsers = (await this.getAllUsers()).length;

      const byDate = new Map<string, { checkedIn: number; checkedOut: number }>();
      for (const d of dates) byDate.set(d, { checkedIn: 0, checkedOut: 0 });

      for (const row of rows) {
        const date = row.get("Date");
        if (date < startStr || date > endDateStr) continue;
        const bucket = byDate.get(date);
        if (!bucket) continue;
        if (row.get("Check-In Time")) bucket.checkedIn++;
        if (row.get("Check-Out Time")) bucket.checkedOut++;
      }

      return dates.map((date) => {
        const bucket = byDate.get(date)!;
        return {
          date,
          checked_in: bucket.checkedIn,
          checked_out: bucket.checkedOut,
          attendance_percentage:
            totalUsers > 0
              ? Math.round((bucket.checkedIn / totalUsers) * 10000) / 100
              : 0,
        };
      });
    } catch (e) {
      console.error("Error computing attendance trends:", e);
      return [];
    }
  }

  /** Attendance rate and average daily working hours, grouped by department. */
  async getDepartmentStats(days = 30): Promise<DepartmentStat[]> {
    try {
      const tz = getTimeZone();
      const endDateStr = todayStr(tz);
      const dates = this.lastNDates(days, endDateStr);
      const startStr = dates[0];

      const users = await this.getAllUsers();
      const rows = await this.attendanceSheet.getRows<AttendanceRecord>();

      const deptUsers = new Map<string, Set<string>>();
      for (const u of users) {
        const dept = u.Department?.trim() || "Unassigned";
        if (!deptUsers.has(dept)) deptUsers.set(dept, new Set());
        deptUsers.get(dept)!.add(u.Username);
      }

      const deptPresent = new Map<string, number>();
      const deptMinutes = new Map<string, number>();
      const deptHourRecords = new Map<string, number>();

      for (const row of rows) {
        const date = row.get("Date");
        if (date < startStr || date > endDateStr) continue;
        const dept = row.get("Department")?.trim() || "Unassigned";
        if (!deptUsers.has(dept)) deptUsers.set(dept, new Set());

        if (row.get("Check-In Time")) {
          deptPresent.set(dept, (deptPresent.get(dept) || 0) + 1);
        }
        const wh = row.get("Working Hours");
        if (wh) {
          const m = /(\d+)h\s*(\d+)m/.exec(wh);
          if (m) {
            deptMinutes.set(
              dept,
              (deptMinutes.get(dept) || 0) + parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
            );
            deptHourRecords.set(dept, (deptHourRecords.get(dept) || 0) + 1);
          }
        }
      }

      const result: DepartmentStat[] = [];
      for (const [dept, memberSet] of deptUsers) {
        const userCount = memberSet.size || 1;
        const possibleDays = userCount * days;
        const present = deptPresent.get(dept) || 0;
        const hourRecords = deptHourRecords.get(dept) || 0;
        const minutes = deptMinutes.get(dept) || 0;

        result.push({
          department: dept,
          user_count: memberSet.size,
          attendance_rate:
            possibleDays > 0 ? Math.round((present / possibleDays) * 10000) / 100 : 0,
          avg_daily_hours:
            hourRecords > 0 ? Math.round((minutes / hourRecords / 60) * 100) / 100 : 0,
        });
      }

      return result.sort((a, b) => b.attendance_rate - a.attendance_rate);
    } catch (e) {
      console.error("Error computing department stats:", e);
      return [];
    }
  }

  /**
   * Punctuality: % of check-ins at/before a configurable expected start
   * time (EXPECTED_START_TIME env var, default 09:00:00, with a grace
   * period from EXPECTED_GRACE_MINUTES, default 15).
   */
  /** "expected_start"/"grace_minutes" on the returned object are the global
   * fallback only — individual records may be judged against a per-user or
   * per-department override instead; see resolveExpectedStart. */
  async getPunctualityStats(days = 30): Promise<PunctualityStats> {
    const defaultExpectedStart = process.env.EXPECTED_START_TIME?.trim() || "09:00:00";
    const defaultGraceMinutes = parseInt(process.env.EXPECTED_GRACE_MINUTES || "15", 10);

    try {
      const tz = getTimeZone();
      const endDateStr = todayStr(tz);
      const dates = this.lastNDates(days, endDateStr);
      const startStr = dates[0];

      const [rows, config] = await Promise.all([
        this.attendanceSheet.getRows<AttendanceRecord>(),
        this.getLatenessConfig(),
      ]);

      let onTime = 0;
      let late = 0;
      const byDept = new Map<string, { onTime: number; late: number }>();

      for (const row of rows) {
        const date = row.get("Date");
        if (date < startStr || date > endDateStr) continue;
        const checkIn = row.get("Check-In Time");
        if (!checkIn) continue;

        const username = row.get("Username") || "";
        const dept = row.get("Department")?.trim() || "Unassigned";
        const { expectedStart, graceMinutes } = resolveExpectedStart(config, username, dept);

        let isLate: boolean;
        try {
          isLate = checkInIsLate(checkIn, expectedStart, graceMinutes);
        } catch {
          continue;
        }

        if (!byDept.has(dept)) byDept.set(dept, { onTime: 0, late: 0 });
        const bucket = byDept.get(dept)!;

        if (isLate) {
          late++;
          bucket.late++;
        } else {
          onTime++;
          bucket.onTime++;
        }
      }

      const total = onTime + late;
      const by_department = Array.from(byDept.entries())
        .map(([department, v]) => {
          const t = v.onTime + v.late;
          return {
            department,
            on_time: v.onTime,
            late: v.late,
            on_time_percentage: t > 0 ? Math.round((v.onTime / t) * 10000) / 100 : 0,
          };
        })
        .sort((a, b) => b.on_time_percentage - a.on_time_percentage);

      return {
        expected_start: config.defaultExpectedStart,
        grace_minutes: config.defaultGraceMinutes,
        on_time: onTime,
        late,
        on_time_percentage: total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0,
        by_department,
      };
    } catch (e) {
      console.error("Error computing punctuality stats:", e);
      return {
        expected_start: defaultExpectedStart,
        grace_minutes: defaultGraceMinutes,
        on_time: 0,
        late: 0,
        on_time_percentage: 0,
        by_department: [],
      };
    }
  }

  async bulkImportUsers(
    usersList: Array<{
      username: string;
      password?: string;
      full_name: string;
      email?: string;
      department?: string;
      designation?: string;
      phone?: string;
      is_active?: boolean;
      is_admin?: boolean;
      expected_start_time?: string;
      grace_minutes?: string;
    }>
  ): Promise<[boolean, string]> {
    const unlock = await usersSheetLock.lock();
    try {
      const rowsToAdd = usersList.map((user) => {
        let normalizedStart = "";
        if (user.expected_start_time?.trim()) {
          try {
            normalizedStart = formatHHMMSS(parseTimeFlexible(user.expected_start_time.trim()));
          } catch {
            // Ignore an unparseable expected-start column rather than failing the whole import.
          }
        }
        return {
          Username: user.username,
          Password: generatePasswordHash(user.password || "Welcome123"),
          "Full Name": user.full_name,
          Email: user.email || "",
          Department: user.department || "",
          Designation: user.designation || "",
          Phone: user.phone || "",
          "Is Active": String(user.is_active ?? true).toUpperCase(),
          "Is Admin": String(user.is_admin ?? false).toUpperCase(),
          "Expected Start Time": normalizedStart,
          "Grace Minutes": user.grace_minutes?.trim() || "",
        };
      });

      if (rowsToAdd.length) {
        await this.usersSheet.addRows(rowsToAdd);
        userCache.clear();
        return [true, `Successfully imported ${rowsToAdd.length} users`];
      }
      return [false, "No users to import"];
    } catch (e: any) {
      return [false, `Error importing users: ${e.message}`];
    } finally {
      unlock();
    }
  }
}

// Singleton, mirrors `db = GoogleSheetsDB()` in the Flask app.
let _db: GoogleSheetsDB | null = null;

export async function getDb(): Promise<GoogleSheetsDB> {
  if (!_db) {
    _db = new GoogleSheetsDB();
  }
  await _db.ensureConnected();
  return _db;
}

export { diffWorkingHours, todayStr, timeStr, timestampStr, parseTimeFlexible, formatHHMMSS };
// resolveExpectedStart and checkInIsLate are already exported at their declarations above.
