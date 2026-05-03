"use client";

import ConnectedAgentsPanel from "@/components/ConnectedAgentsPanel";

export default function DashboardContent({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-6">
            <main className="flex-1 min-w-0">{children}</main>
            <ConnectedAgentsPanel />
        </div>
    );
}
