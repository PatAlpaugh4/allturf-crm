"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Info,
  Package,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { NUDGE_TYPE_COLORS, type NudgeType } from "@/lib/types";

interface NudgePreview {
  id: string;
  nudge_type: NudgeType;
  priority: string;
  title: string;
  message: string | null;
  created_at: string;
  is_dismissed: boolean;
  is_completed: boolean;
  company: { id: string; name: string } | null;
}

const NUDGE_ICONS: Record<NudgeType, typeof Bell> = {
  inventory_alert: Package,
  promo_available: Tag,
  related_info: Info,
  action_reminder: AlertTriangle,
  cross_sell: ShoppingCart,
  disease_alert: Sparkles,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NudgeBell() {
  const { profile } = useAuth();
  const supabase = createBrowserClient();
  const [count, setCount] = useState(0);
  const [nudges, setNudges] = useState<NudgePreview[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch unread count
  const fetchCount = useCallback(async () => {
    if (!profile?.id) return;
    const { count: total } = await supabase
      .from("rep_nudges")
      .select("id", { count: "exact", head: true })
      .eq("rep_id", profile.id)
      .eq("is_dismissed", false)
      .eq("is_completed", false);

    setCount(total || 0);
  }, [profile?.id, supabase]);

  // Fetch recent nudges for the dropdown
  const fetchNudges = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("rep_nudges")
      .select(
        `id, nudge_type, priority, title, message, created_at, is_dismissed, is_completed,
         company:companies(id, name)`
      )
      .eq("rep_id", profile.id)
      .eq("is_dismissed", false)
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(8);

    setNudges((data as unknown as NudgePreview[]) || []);
    setLoaded(true);
  }, [profile?.id, supabase]);

  useEffect(() => {
    fetchCount();
    // Re-fetch count every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open && !loaded) {
      fetchNudges();
    }
  }, [open, loaded, fetchNudges]);

  const handleDismiss = async (nudgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase
      .from("rep_nudges")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    setCount((prev) => Math.max(0, prev - 1));
  };

  const handleComplete = async (nudgeId: string) => {
    await supabase
      .from("rep_nudges")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", nudgeId);

    setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    setCount((prev) => Math.max(0, prev - 1));
  };

  if (!profile) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 sm:w-96"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {count} active
            </Badge>
          )}
        </div>

        {/* Nudge list */}
        <ScrollArea className="max-h-[400px]">
          {nudges.length === 0 && loaded && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No active suggestions
            </div>
          )}
          {nudges.map((nudge) => {
            const Icon = NUDGE_ICONS[nudge.nudge_type] || Bell;
            return (
              <div
                key={nudge.id}
                className="border-b last:border-b-0 px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${NUDGE_TYPE_COLORS[nudge.nudge_type]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{nudge.title}</p>
                    {nudge.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {nudge.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(nudge.created_at)}
                      </span>
                      {nudge.company && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {nudge.company.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleComplete(nudge.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-green-100 hover:text-green-600 transition-colors"
                      title="Mark as done"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDismiss(nudge.id, e)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <Link
            href="/nudges"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
