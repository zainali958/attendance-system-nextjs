import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loginAction } from "@/lib/actions";
import FlashBanner from "@/components/FlashBanner";

export const metadata = { title: "Attendance System - Login" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 15,
          boxShadow: "0 15px 35px rgba(0,0,0,0.2)",
          padding: 40,
          width: "100%",
          maxWidth: 420,
        }}
      >
        <div className="text-center mb-4">
          <h2 style={{ color: "#667eea", fontWeight: 700, marginBottom: 10 }}>
            📋 Attendance System
          </h2>
          <p className="text-muted">Login to mark your attendance</p>
        </div>

        <FlashBanner />

        <form action={loginAction}>
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              className="form-control"
              required
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-control"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-100"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              padding: 12,
              fontWeight: 600,
            }}
          >
            Login &amp; Mark Attendance
          </button>
        </form>

        <div className="mt-4 text-center">
          <small className="text-muted">
            All employees are registered in Google Sheets
            <br />
            Contact admin if you can&apos;t login
          </small>
        </div>
      </div>
    </div>
  );
}
