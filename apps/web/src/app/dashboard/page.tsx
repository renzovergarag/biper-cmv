import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
  }

  const decoded = await verifyToken(token);

  if (!decoded) {
    redirect("/login");
  }

  if (decoded.rol === "ADMIN") {
    redirect("/dashboard/admin");
  }

  redirect("/dashboard/agent");
}
