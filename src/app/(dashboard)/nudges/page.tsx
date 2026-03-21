"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  NUDGE_TYPES,
  NUDGE_TYPE_COLORS,
  type NudgeType,
} from "@/lib/types";

interface NudgeRow {
  id: string;
  nudge_type: NudgeType;
  priority: string;
  title: string;
  message: string | null;
  suggested_action: string | null;
  due_date: string | null;
  is_dismissed: boolean;
  is_completed: boolean;
  created_at: string;
  company: { id: string; name: string } | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  call_log: { id: string; created_at: string } | null;
}

const NUDGE_ICONS: Record<NudgeType, typeof Bell> = {
  inventory_alert: Package,
  promo_available: Tag,
  related_info: Info,
  action_reminder: AlertTriangle,
  cross_sell: ShoppingCart,
  disease_alert: Sparkles,
};

const NUDGE_TYPE_LABELS: Record<NudgeType, string> = {
  inventory_alert: "Inventory Alert",
  promo_available: "Promo Available",
  related_info: "Related Info",
  action_reminder: "Action Reminder",
  cross_sell: "Cross-Sell",
  disease_alert: "Disease Alert",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

export default function NudgesPage() {
  const { profile } = useAuth();
  const supabase = createBrowserClient();
  const [nudges, setNudges] = useState<NudgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");

  const fetchNudges = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    let query = supabase
      .from("rep_nudges")
      .select(
        `*, company:companies(id, name),
         contact:contacts(id, first_name, last_name),
         call_log:call_logs(id, created_at)`
      )
      .eq("rep_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    // Status filter
    if (statusFilter === "active") {
      query = query.eq("is_dismissed", false).eq("is_completed", false);
    } else if (statusFilter === "dismissed") {
      query = query.eq("is_dismissed", true);
    } else if (statusFilter === "completed") {
      query = query.eq("is_completed", true);
    }

    // Type filter
    if (typeFilter !== "all") {
      query = query.eq("nudge_type", typeFilter);
    }

    const { data } = await query;
    setNudges((data as unknown as NudgeRow[]) || []);
    setLoading(false);
  }, [profile?.id, supabase, typeFilter, statusFilter]);

  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  const handleDismiss = async (nudgeId: string) => {
    await supabase
      .from("rep_nudges")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const handleComplete = async (nudgeId: string) => {
    await supabase
      .from("rep_nudges")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const handleDismissAll = async () => {
    if (!profile?.id) return;
    const activeIds = nudges.filter((n) => !n.is_dismissed && !n.is_completed).map((n) => n.id);
    if (activeIds.length === 0) return;

    await supabase
      .from("rep_nudges")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .in("id", activeIds);

    setNudges((prev) => prev.filter((n) => !activeIds.includes(n.id)));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const activeCount = nudges.length;

  return (
    <div className="page-enter mx-auto max-w-2xl space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Suggestions
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} suggestion{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        {statusFilter === "active" && activeCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismissAll}
            className="gap-2 min-h-[44px]"
          >
            <X className="h-4 w-4" />
            Dismiss All
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-[44px]">All Types</SelectItem>
            {NUDGE_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="min-h-[44px]">
                {NUDGE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active" className="min-h-[44px]">Active</SelectItem>
            <SelectItem value="completed" className="min-h-[44px]">Completed</SelectItem>
            <SelectItem value="dismissed" className="min-h-[44px]">Dismissed</SelectItem>
            <SelectItem value="all" className="min-h-[44px]">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && nudges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Bell className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {statusFilter === "active"
              ? "No active suggestions — you're all caught up!"
              : "No suggestions matching filters"}
          </p>
        </div>
      )}

      {/* Nudge cards */}
      {!loading && (
        <div className="space-y-3">
          {nudges.map((nudge) => {
            const Icon = NUDGE_ICONS[nudge.nudge_type] || Bell;
            const isDone = nudge.is_completed || nudge.is_dismissed;

            return (
              <div
                key={nudge.id}
                className={`rounded-xl border p-4 space-y-3 transition-opacity ${
                  isDone ? "opacity-50" : ""
                }`}
              >
                {/* Top row: type badge + priority + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${NUDGE_TYPE_COLORS[nudge.nudge_type]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <Badge
                      className={`text-[10px] ${NUDGE_TYPE_COLORS[nudge.nudge_type]}`}
                    >
                      {NUDGE_TYPE_LABELS[nudge.nudge_type]}
                    </Badge>
                    <Badge
                      className={`text-[10px] ${PRIORITY_STYLES[nudge.priority] || PRIORITY_STYLES.medium}`}
                    >
                      {nudge.priority}
                    </Badge>
                    {nudge.is_completed && (
                      <Badge className="text-[10px] bg-green-100 text-green-700">done</Badge>
                    )}
                    {nudge.is_dismissed && (
                      <Badge className="text-[10px] bg-slate-100 text-slate-500">dismissed</Badge>
                    )}
                  </div>

                  {!isDone && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleComplete(nudge.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-green-100 hover:text-green-600 transition-colors"
                        title="Mark as done"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDismiss(nudge.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Title and message */}
                <div>
                  <p className="text-sm font-medium">{nudge.title}</p>
                  {nudge.message && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {nudge.message}
                    </p>
                  )}
                  {nudge.suggested_action && (
                    <p className="text-sm mt-1.5 text-primary/80 italic">
                      Suggestion: {nudge.suggested_action}
                    </p>
                  )}
                </div>

                {/* Links row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {nudge.company && (
                    <Link
                      href={`/courses/${nudge.company.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {nudge.company.name}
                    </Link>
                  )}
                  {nudge.contact && (
                    <span>
                      {nudge.contact.first_name} {nudge.contact.last_name}
                    </span>
                  )}
                  {nudge.call_log && (
                    <Link
                      href="/calls"
                      className="hover:text-primary hover:underline"
                    >
                      From call on {formatDate(nudge.call_log.created_at)}
                    </Link>
                  )}
                  {nudge.due_date && (
                    <span className={nudge.due_date < new Date().toISOString().split("T")[0] ? "text-destructive font-medium" : ""}>
                      Due: {nudge.due_date}
                    </span>
                  )}
                  <span className="ml-auto">{formatDate(nudge.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
