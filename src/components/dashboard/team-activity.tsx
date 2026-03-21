"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2, CheckCircle2, MinusCircle } from "lucide-react";

interface RepActivity {
  id: string;
  full_name: string | null;
  email: string;
  territory: string | null;
  call_count: number;
}

export function TeamActivityCard() {
  const { profile } = useAuth();
  const [reps, setReps] = useState<RepActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    async function load() {
      // Get all reps
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, territory, role")
        .in("role", ["rep", "admin", "manager"]);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Get today's call log counts per rep
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayCalls } = await supabase
        .from("call_logs")
        .select("rep_id")
        .gte("created_at", todayStart.toISOString());

      // Count calls per rep
      const callCounts = new Map<string, number>();
      if (todayCalls) {
        for (const call of todayCalls) {
          const current = callCounts.get(call.rep_id) || 0;
          callCounts.set(call.rep_id, current + 1);
        }
      }

      const repActivity: RepActivity[] = profiles.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        territory: p.territory,
        call_count: callCounts.get(p.id) || 0,
      }));

      // Sort: active reps first, then by call count desc
      repActivity.sort((a, b) => b.call_count - a.call_count);

      setReps(repActivity);
      setLoading(false);
    }
    load();
  }, [supabase, isAdmin]);

  if (!isAdmin) return null;

  const activeCount = reps.filter((r) => r.call_count > 0).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Team Activity Today
          {!loading && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {activeCount}/{reps.length} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No team members found
          </p>
        ) : (
          <div className="space-y-1.5">
            {reps.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm"
              >
                {rep.call_count > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span
                  className={`flex-1 truncate ${
                    rep.call_count === 0 ? "text-muted-foreground" : ""
                  }`}
                >
                  {rep.full_name || rep.email}
                </span>
                {rep.territory && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {rep.territory}
                  </span>
                )}
                {rep.call_count > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {rep.call_count} call{rep.call_count !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
