"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  Bot,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Content", href: "/admin/content", icon: FileText },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart2 },
  { label: "AI Monitor", href: "/admin/ai-monitor", icon: Bot },
];

const roleBadgeClass: Record<"USER" | "ADMIN" | "SUPER_ADMIN", string> = {
  SUPER_ADMIN: "bg-emerald-700/50 text-emerald-300",
  ADMIN: "bg-teal-700/50 text-teal-300",
  USER: "bg-gray-700 text-gray-400",
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col bg-slate-900 text-white transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header — dynamic user profile */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-emerald-400" />
            {user ? (
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-tight text-white">
                  {user.email.split("@")[0]}
                </p>
                <span
                  className={cn(
                    "mt-0.5 inline-flex rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide",
                    roleBadgeClass[user.role]
                  )}
                >
                  {user.role.replace("_", " ")}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        )}
        {collapsed && <Shield className="mx-auto h-5 w-5 text-emerald-400" />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          onClick={() => void logout()}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            "text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
