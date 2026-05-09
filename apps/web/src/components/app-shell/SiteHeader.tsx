"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { breadcrumbLabels } from "./nav-config";
import SocketStatus from "./SocketStatus";

function pageTitle(pathname: string): string {
    if (breadcrumbLabels[pathname]) return breadcrumbLabels[pathname];

    const match = Object.keys(breadcrumbLabels)
        .filter((key) => pathname.startsWith(key))
        .sort((a, b) => b.length - a.length)[0];

    return match ? breadcrumbLabels[match] : "Dashboard";
}

export default function SiteHeader() {
    const pathname = usePathname();
    const title = pageTitle(pathname);

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 sticky top-0 z-30">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbPage>{title}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto">
                <SocketStatus />
            </div>
        </header>
    );
}
