import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    const token = cookies().get("token")?.value;

    if (token && (await verifyToken(token))) {
        redirect("/dashboard");
    }

    return <LoginForm />;
}
