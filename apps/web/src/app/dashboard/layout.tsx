import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-shell/AppSidebar";
import SiteHeader from "@/components/app-shell/SiteHeader";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
