"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import NavMain from "./NavMain";
import NavUser from "./NavUser";
import { navConfig } from "./nav-config";

export default function AppSidebar() {
    const { user, isLoading } = useAuth();

    if (isLoading || !user) return null;

    const items =
        user.rol === "ADMIN" ? navConfig.admin : navConfig.agent;
    const homeHref =
        user.rol === "ADMIN" ? "/dashboard/admin" : "/dashboard/agent";

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link
                                href={homeHref}
                                className="flex items-center gap-2"
                            >
                                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary/5">
                                    <Image
                                        src="/Logo BN V.jpg"
                                        alt="CMV"
                                        width={28}
                                        height={28}
                                        className="h-7 w-auto"
                                    />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        VIPER CMV
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Corp. Municipal
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={items} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
