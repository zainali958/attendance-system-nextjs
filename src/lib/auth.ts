import { redirect } from "next/navigation";
import { getSession, SessionPayload } from "./session";

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireUser();
  if (!session.isAdmin) {
    redirect("/dashboard");
  }
  return session;
}
