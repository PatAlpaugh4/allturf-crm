"use client";

import { useAuth } from "@/components/auth-provider";
import { RepDashboard } from "@/components/dashboard/rep-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";

export default function DashboardPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="page-enter space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isAdmin ? "Management Dashboard" : "Dashboard"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isAdmin
            ? "Field intelligence and team activity overview"
            : "What needs your attention today"}
        </p>
      </div>

      {isAdmin ? <ManagerDashboard /> : <RepDashboard />}
    </div>
  );
}
