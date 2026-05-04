import Navigation from "@/components/Navigation";
import DashboardContent from "@/components/DashboardContent";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-secondary/30">
            <Navigation />
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <DashboardContent>{children}</DashboardContent>
            </div>
        </div>
    );
}
