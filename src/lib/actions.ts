"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getDb } from "./sheetsDb";
import {
  setSessionCookie,
  clearSessionCookie,
  getDeviceTokenCookie,
  setDeviceTokenCookie,
} from "./session";
import { setFlash } from "./flash";
import { requireUser, requireAdmin } from "./auth";

// ==================== Auth ====================

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    await setFlash("warning", "Please enter username and password");
    redirect("/login");
  }

  const db = await getDb();
  const userData = await db.getUserByUsername(username, false);

  if (!userData || !(await db.verifyPassword(username, password))) {
    await setFlash("danger", "Invalid username or password");
    redirect("/login");
  }

  // Device binding: first successful login for a username binds that
  // browser as the account's one trusted device. Later logins with the
  // correct password but a different/missing device cookie are blocked.
  const deviceToken = await getDeviceTokenCookie();
  const { token: registeredToken } = await db.getDeviceToken(username);

  let newDeviceToken: string | null = null;

  if (registeredToken) {
    if (deviceToken !== registeredToken) {
      await setFlash(
        "danger",
        "This account is bound to a different device. Please use your registered device, or ask an admin to reset it."
      );
      redirect("/login");
    }
  } else {
    newDeviceToken = deviceToken || crypto.randomBytes(32).toString("hex");
    await db.registerDevice(username, newDeviceToken, "");
  }

  await setSessionCookie({
    username: userData.Username,
    fullName: userData["Full Name"],
    email: userData.Email || "",
    department: userData.Department || "",
    designation: userData.Designation || "",
    isAdmin: String(userData["Is Admin"] || "FALSE").toUpperCase() === "TRUE",
  });

  if (newDeviceToken) {
    await setDeviceTokenCookie(newDeviceToken);
  }

  await setFlash("success", `Welcome back, ${userData["Full Name"]}!`);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

// ==================== Employee actions ====================

export async function checkInAction() {
  const session = await requireUser();
  const db = await getDb();
  const userData = await db.getUserByUsername(session.username);

  if (!userData) {
    await setFlash("danger", "User not found");
    redirect("/login");
  }

  const [success, message] = await db.checkIn(userData);
  await setFlash(success ? "success" : "warning", message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function checkOutAction() {
  const session = await requireUser();
  const db = await getDb();
  const [success, message] = await db.checkOut(session.username);
  await setFlash(success ? "success" : "warning", message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function requestLeaveAction(formData: FormData) {
  const session = await requireUser();
  const startDate = String(formData.get("start_date") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!startDate || !endDate || !reason) {
    await setFlash("danger", "Please fill in start date, end date, and a reason.");
    redirect("/dashboard");
  }

  const startDt = new Date(startDate);
  const endDt = new Date(endDate);
  if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) {
    await setFlash("danger", "Invalid date format.");
    redirect("/dashboard");
  }
  if (endDt < startDt) {
    await setFlash("danger", "End date cannot be before start date.");
    redirect("/dashboard");
  }

  const db = await getDb();
  const [success, message] = await db.requestLeave(
    session.username,
    session.fullName,
    startDate,
    endDate,
    reason
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ==================== Admin: users ====================

export async function addUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "");
  const email = String(formData.get("email") || "");
  const department = String(formData.get("department") || "");
  const designation = String(formData.get("designation") || "");
  const phone = String(formData.get("phone") || "");
  const expectedStartTime = String(formData.get("expected_start_time") || "");
  const graceMinutes = String(formData.get("grace_minutes") || "");

  if (!username || !password || !fullName || !email) {
    await setFlash("danger", "Please fill all required fields");
    redirect("/admin");
  }

  const db = await getDb();
  const [success, message] = await db.addUser(
    username,
    password,
    fullName,
    email,
    department,
    designation,
    phone,
    true,
    false,
    expectedStartTime,
    graceMinutes
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateUserShiftAction(username: string, formData: FormData) {
  await requireAdmin();
  const expectedStartTime = String(formData.get("expected_start_time") || "");
  const graceMinutes = String(formData.get("grace_minutes") || "");

  const db = await getDb();
  const [success, message] = await db.setUserExpectedStart(
    username,
    expectedStartTime,
    graceMinutes
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

// ==================== Admin: department shift settings ====================

export async function upsertDepartmentSettingAction(formData: FormData) {
  await requireAdmin();
  const department = String(formData.get("department") || "").trim();
  const expectedStartTime = String(formData.get("expected_start_time") || "");
  const graceMinutes = String(formData.get("grace_minutes") || "");

  if (!department) {
    await setFlash("danger", "Please choose a department");
    redirect("/admin");
  }

  const db = await getDb();
  const [success, message] = await db.upsertDepartmentSetting(
    department,
    expectedStartTime,
    graceMinutes
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function removeDepartmentSettingAction(department: string) {
  await requireAdmin();
  const db = await getDb();
  const [success, message] = await db.deleteDepartmentSetting(department);
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function changeUserPasswordAction(
  username: string,
  formData: FormData
) {
  await requireAdmin();
  const newPassword = String(formData.get("new_password") || "");

  if (!newPassword || newPassword.length < 6) {
    await setFlash("danger", "Password must be at least 6 characters");
    redirect("/admin");
  }

  const db = await getDb();
  const [success, message] = await db.updatePassword(username, newPassword);
  await setFlash(success ? "success" : "danger", message);
  redirect("/admin");
}

export async function toggleAdminAction(username: string, formData: FormData) {
  await requireAdmin();
  const makeAdmin = formData.get("make_admin") === "1";
  const db = await getDb();
  const [success, message] = await db.setAdminStatus(username, makeAdmin);
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function toggleActiveAction(username: string, formData: FormData) {
  await requireAdmin();
  const makeActive = formData.get("make_active") === "1";
  const db = await getDb();
  const [success, message] = await db.setActiveStatus(username, makeActive);
  await setFlash(success ? "success" : "danger", message);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function resetUserDeviceAction(username: string) {
  await requireAdmin();
  const db = await getDb();
  const [success, message] = await db.resetDevice(username);
  await setFlash(success ? "success" : "danger", message);
  redirect("/admin");
}

export async function importUsersAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;

  if (!file || !file.name.endsWith(".csv")) {
    await setFlash("danger", "Please upload a CSV file");
    redirect("/admin");
  }

  try {
    const text = await file!.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      await setFlash("warning", "No valid users found in CSV");
      redirect("/admin");
    }

    const header = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

    const idx = (names: string[]) =>
      header.findIndex((h) => names.includes(h.toLowerCase()) || names.includes(h));

    const usersToImport = dataRows.map((row) => {
      const get = (names: string[]) => {
        const i = header.findIndex(
          (h) => names.includes(h) || names.includes(h.toLowerCase())
        );
        return i >= 0 ? row[i] ?? "" : "";
      };
      return {
        username: get(["Username", "username"]),
        password: get(["Password", "password"]) || "Welcome123",
        full_name: get(["Full Name", "full_name"]),
        email: get(["Email", "email"]),
        department: get(["Department", "department"]),
        designation: get(["Designation", "designation"]),
        phone: get(["Phone", "phone"]),
        expected_start_time: get(["Expected Start Time", "expected_start_time"]),
        grace_minutes: get(["Grace Minutes", "grace_minutes"]),
      };
    });

    const db = await getDb();
    const [success, message] = await db.bulkImportUsers(usersToImport);
    await setFlash(success ? "success" : "danger", message);
  } catch (e: any) {
    await setFlash("danger", `Error importing users: ${e.message}`);
  }

  revalidatePath("/admin");
  redirect("/admin");
}

function parseCsv(text: string): string[][] {
  // Minimal CSV parser: handles quoted fields with commas/escaped quotes.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.some((f) => f !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ==================== Admin: attendance ====================

export async function editAttendanceAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") || "").trim();
  const recordDate = String(formData.get("date") || "").trim();
  const checkInTime = String(formData.get("check_in_time") || "").trim();
  const checkOutTime = String(formData.get("check_out_time") || "").trim();
  const returnTo = String(formData.get("return_to") || "/admin");

  if (!username || !recordDate) {
    await setFlash("danger", "Missing username or date");
    redirect(returnTo);
  }

  const db = await getDb();
  const [success, message] = await db.adminUpdateAttendance(
    username,
    recordDate,
    checkInTime,
    checkOutTime
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath(returnTo);
  redirect(returnTo);
}

// ==================== Admin: leaves ====================

export async function decideLeaveAction(rowIndex: number, formData: FormData) {
  const session = await requireAdmin();
  const decision = String(formData.get("decision") || "");
  const returnTo = String(formData.get("return_to") || "/admin/leaves");

  if (decision !== "Approved" && decision !== "Rejected") {
    await setFlash("danger", "Invalid decision");
    redirect(returnTo);
  }

  const db = await getDb();
  const [success, message] = await db.decideLeave(
    rowIndex,
    decision as "Approved" | "Rejected",
    session.username
  );
  await setFlash(success ? "success" : "danger", message);
  revalidatePath(returnTo);
  redirect(returnTo);
}
