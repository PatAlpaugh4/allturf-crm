"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bell,
  Check,
  Info,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
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
}

const NUDGE_ICONS: Record<NudgeType, typeof Bell> = {
  inventory_alert: Package,
  promo_available: Tag,
  related_info: Info,
  action_reminder: AlertTriangle,
  cross_sell: ShoppingCart,
  disease_alert: Sparkles,
};

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-transparent",
  low: "border-l-transparent",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
  const dateOnlyStr = date.toISOString().split("T")[0];

  if (dateOnlyStr === todayStr) return "Today";
  if (dateOnlyStr === yesterdayStr) return "Yesterday";

  // Check if within this week (last 7 days)
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  if (date > weekAgo) return "This Week";

  return "Earlier";
}

export default function NudgesPage() {
  const { profile } = useAuth();
  const supabase = createBrowserClient();
  const [nudges, setNudges] = useState<NudgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);

  const fetchNudges = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    let query = supabase
      .from("rep_nudges")
      .select(
        `*, company:companies(id, name),
         contact:contacts(id, first_name, last_name)`
      )
      .eq("rep_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!showDismissed) {
      query = query.eq("is_dismissed", false).eq("is_completed", false);
    }

    const { data } = await query;
    setNudges((data as unknown as NudgeRow[]) || []);
    setLoading(false);
  }, [profile?.id, supabase, showDismissed]);

  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  const handleDismiss = async (nudgeId: string) => {
    const { error } = await supabase
      .from("rep_nudges")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    if (error) return;
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  const handleComplete = async (nudgeId: string) => {
    const { error } = await supabase
      .from("rep_nudges")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    if (error) return;
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
  };

  // Group nudges by date
  const grouped = nudges.reduce<Record<string, NudgeRow[]>>((acc, nudge) => {
    const group = getDateGroup(nudge.created_at);
    if (!acc[group]) acc[group] = [];
    acc[group].push(nudge);
    return acc;
  }, {});

  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];
  const activeCount = nudges.filter((n) => !n.is_dismissed && !n.is_completed).length;

  return (
    <div className="page-enter mx-auto max-w-xl space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount > 0
              ? `${activeCount} new suggestion${activeCount !== 1 ? "s" : ""}`
              : "You're all caught up"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDismissed(!showDismissed)}
          className="text-xs text-muted-foreground"
        >
          {showDismissed ? "Hide dismissed" : "Show all"}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && nudges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-muted-foreground text-sm">
            No notifications yet — log a call and AI will send you tips.
          </p>
        </div>
      )}

      {/* Grouped feed */}
      {!loading &&
        groupOrder.map((group) => {
          const items = grouped[group];
          if (!items || items.length === 0) return null;

          return (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {group}
              </p>
              <div className="space-y-2">
                {items.map((nudge) => (
                  <NudgeCard
                    key={nudge.id}
                    nudge={nudge}
                    onDismiss={handleDismiss}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function NudgeCard({
  nudge,
  onDismiss,
  onComplete,
}: {
  nudge: NudgeRow;
  onDismiss: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const Icon = NUDGE_ICONS[nudge.nudge_type] || Bell;
  const isDone = nudge.is_completed || nudge.is_dismissed;

  return (
    <div
      className={`rounded-xl border border-l-4 ${PRIORITY_BORDER[nudge.priority] || ""} bg-card p-4 transition-opacity ${
        isDone ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${NUDGE_TYPE_COLORS[nudge.nudge_type]}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{nudge.title}</p>
          {nudge.message && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {nudge.message}
            </p>
          )}
          {nudge.suggested_action && (
            <p className="text-xs mt-1.5 text-primary/80 italic">
              {nudge.suggested_action}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
            <span>{timeAgo(nudge.created_at)}</span>
            {nudge.company && (
              <Link
                href={`/courses/${nudge.company.id}`}
                className="hover:text-primary hover:underline truncate max-w-[150px]"
              >
                {nudge.company.name}
              </Link>
            )}
            {nudge.contact && (
              <span className="truncate max-w-[120px]">
                {nudge.contact.first_name} {nudge.contact.last_name}
              </span>
            )}
            {nudge.due_date && (
              <span
                className={
                  nudge.due_date < new Date().toISOString().split("T")[0]
                    ? "text-destructive font-medium"
                    : ""
                }
              >
                Due {nudge.due_date}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isDone && (
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={() => onComplete(nudge.id)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-green-100 hover:text-green-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Mark as done"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDismiss(nudge.id)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
