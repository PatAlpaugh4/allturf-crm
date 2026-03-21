"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";

interface DemandRow {
  product_name: string;
  count: number;
  inventory_on_hand: number | null;
  is_low: boolean;
}

export function DemandSignalsCard() {
  const [rows, setRows] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch demand signals from the past 7 days
      const res = await fetch("/api/v1/demand-signals?days=7&limit=500");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const signals = data.signals || [];

      // Count by product
      const counts = new Map<string, { count: number; productId: string | null }>();
      for (const s of signals) {
        const name = (s.product?.name || s.product_name || "Unknown").toLowerCase();
        const existing = counts.get(name) || { count: 0, productId: s.product_id };
        existing.count++;
        counts.set(name, existing);
      }

      // Fetch inventory for top products
      const invRes = await fetch("/api/v1/inventory");
      const invData = invRes.ok ? await invRes.json() : { inventory: [] };
      const invMap = new Map<string, { on_hand: number; reorder_point: number }>();
      for (const inv of invData.inventory || []) {
        if (inv.product?.name) {
          invMap.set(inv.product.name.toLowerCase(), {
            on_hand: inv.quantity_on_hand,
            reorder_point: inv.reorder_point,
          });
        }
      }

      const topProducts = Array.from(counts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, data]) => {
          const inv = invMap.get(name);
          return {
            product_name: name,
            count: data.count,
            inventory_on_hand: inv?.on_hand ?? null,
            is_low: inv ? inv.on_hand <= inv.reorder_point && inv.reorder_point > 0 : false,
          };
        });

      setRows(topProducts);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Demand Signals (7 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No demand signals this week
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.product_name} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm capitalize truncate">{row.product_name}</span>
                  {row.is_low && (
                    <Badge className="text-[9px] bg-red-100 text-red-700 shrink-0">LOW</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="font-semibold text-primary">{row.count}</span>
                  <span className="text-muted-foreground">signals</span>
                  {row.inventory_on_hand != null && (
                    <span className={`text-[10px] ${row.is_low ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                      ({row.inventory_on_hand} on hand)
                    </span>
                  )}
                </div>
              </div>
            ))}
            <Link
              href="/products"
              className="flex items-center justify-center gap-1 pt-1 text-xs text-primary hover:underline"
            >
              View inventory
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
