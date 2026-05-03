import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { Rol } from "@prisma/client";
import UsersPageClient from "@/components/UsersPageClient";

export default async function AdminUsersPage() {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const decoded = await verifyToken(token);
    if (!decoded || decoded.rol !== Rol.ADMIN) redirect("/dashboard");

    return <UsersPageClient />;
}
