import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#f8f9fa",
      }}
    >
      <div className="text-center">
        <div style={{ fontSize: "6rem", fontWeight: "bold", color: "#6f42c1" }}>404</div>
        <h3>Page Not Found</h3>
        <p className="text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
