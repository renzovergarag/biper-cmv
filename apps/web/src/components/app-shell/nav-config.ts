import {
    LayoutDashboard,
    Siren,
    Users,
    Wifi,
    ScrollText,
    BarChart3,
    Settings,
    History,
    User,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

export interface NavConfig {
    admin: NavItem[];
    agent: NavItem[];
}

export const navConfig: NavConfig = {
    admin: [
        { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
        { label: "Eventos", href: "/dashboard/admin/events", icon: Siren },
        { label: "Usuarios", href: "/dashboard/admin/users", icon: Users },
        { label: "Agentes en línea", href: "/dashboard/admin/agents", icon: Wifi },
        { label: "Sesiones", href: "/dashboard/admin/sessions", icon: ScrollText },
        { label: "Reportes", href: "/dashboard/admin/reports", icon: BarChart3 },
        { label: "Configuración", href: "/dashboard/admin/settings", icon: Settings },
    ],
    agent: [
        { label: "Mis eventos", href: "/dashboard/agent", icon: Siren },
        { label: "Historial", href: "/dashboard/agent/history", icon: History },
        { label: "Mi perfil", href: "/dashboard/agent/profile", icon: User },
    ],
};

export const breadcrumbLabels: Record<string, string> = {
    "/dashboard/admin": "Dashboard",
    "/dashboard/admin/events": "Eventos",
    "/dashboard/admin/users": "Usuarios",
    "/dashboard/admin/agents": "Agentes en línea",
    "/dashboard/admin/sessions": "Sesiones",
    "/dashboard/admin/reports": "Reportes",
    "/dashboard/admin/settings": "Configuración",
    "/dashboard/agent": "Mis eventos",
    "/dashboard/agent/history": "Historial",
    "/dashboard/agent/profile": "Mi perfil",
};
