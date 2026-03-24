"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import type { NudgeType } from "@/lib/types";

interface RealtimeNudge {
  id: string;
  nudge_type: NudgeType;
  priority: string;
  title: string;
  message: string | null;
  company_id: string | null;
  contact_id: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600",
  high: "text-orange-600",
  medium: "text-yellow-600",
  low: "text-muted-foreground",
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-slate-400",
};

export function NudgeToastListener() {
  const { profile, isAdmin } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient();
  const seenIdsRef = useRef(new Set<string>());
  const lastCheckRef = useRef<string>(new Date().toISOString());

  const showNudgeToast = useCallback(
    (nudge: RealtimeNudge) => {
      if (seenIdsRef.current.has(nudge.id)) return;
      seenIdsRef.current.add(nudge.id);

      const duration =
        nudge.priority === "urgent" ? 15000 : nudge.priority === "high" ? 12000 : 8000;

      const viewPath = nudge.company_id
        ? `/courses/${nudge.company_id}`
        : "/nudges";

      toast(nudge.title, {
        description: nudge.message?.slice(0, 160) || undefined,
        duration,
        icon: (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${PRIORITY_DOT[nudge.priority] || PRIORITY_DOT.medium}`}
          />
        ),
        classNames: {
          title: `font-semibold text-sm ${PRIORITY_COLORS[nudge.priority] || ""}`,
          description: "text-xs text-muted-foreground leading-relaxed",
        },
        action: {
          label: "View",
          onClick: () => router.push(viewPath),
        },
      });
    },
    [router],
  );

  // Poll for new nudges every 30 seconds
  const pollForNewNudges = useCallback(async () => {
    if (!profile?.id) return;

    let query = supabase
      .from("rep_nudges")
      .select("id, nudge_type, priority, title, message, company_id, contact_id")
      .eq("is_dismissed", false)
      .eq("is_completed", false)
      .gt("created_at", lastCheckRef.current)
      .order("created_at", { ascending: true })
      .limit(5);
    if (!isAdmin) query = query.eq("rep_id", profile.id);

    const { data } = await query;

    lastCheckRef.current = new Date().toISOString();

    if (data && data.length > 0) {
      // Queue toasts with a small delay between each
      for (let i = 0; i < data.length; i++) {
        setTimeout(() => {
          showNudgeToast(data[i] as RealtimeNudge);
        }, i * 1500);
      }
    }
  }, [profile?.id, isAdmin, supabase, showNudgeToast]);

  useEffect(() => {
    if (!profile?.id) return;

    // Try Supabase Realtime first
    const realtimeFilter = isAdmin
      ? { event: "INSERT" as const, schema: "public", table: "rep_nudges" }
      : { event: "INSERT" as const, schema: "public", table: "rep_nudges", filter: `rep_id=eq.${profile.id}` };

    const channel = supabase
      .channel("nudge-toasts")
      .on(
        "postgres_changes",
        realtimeFilter,
        (payload) => {
          const nudge = payload.new as RealtimeNudge;
          showNudgeToast(nudge);
        },
      )
      .subscribe((status) => {
        // If realtime subscription fails, fall back to polling
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Realtime subscription failed, falling back to polling");
          startPolling();
        }
      });

    // Also poll as a fallback — realtime can be unreliable on some Supabase plans
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(pollForNewNudges, 30000);
    }

    // Start polling after a short delay (gives realtime time to connect)
    const pollDelay = setTimeout(startPolling, 5000);

    return () => {
      clearTimeout(pollDelay);
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, isAdmin, supabase, showNudgeToast, pollForNewNudges]);

  // Keep seen IDs from growing unbounded
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (seenIdsRef.current.size > 200) {
        const arr = Array.from(seenIdsRef.current);
        seenIdsRef.current = new Set(arr.slice(-50));
      }
    }, 300000);
    return () => clearInterval(cleanup);
  }, []);

  return null; // Invisible listener component
}
