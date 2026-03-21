"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  DollarSign,
  Filter,
} from "lucide-react";
import {
  STAGE_COLORS,
  type QuoteStage,
} from "@/lib/types";

const PIPELINE_STAGES: QuoteStage[] = [
  "Quote Draft",
  "Quote Sent",
  "Quote Approved",
  "Order Placed",
  "Shipped",
  "Delivered",
  "Invoiced",
];

interface PipelineDeal {
  id: string;
  name: string;
  stage: QuoteStage;
  value_cad: number;
  season: string | null;
  created_at: string;
  updated_at: string | null;
  company_name: string | null;
  rep_name: string | null;
  item_count: number;
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeason] = useState<string>("all");
  const supabase = createBrowserClient();

  const load = useCallback(async () => {
    const { data: rawDeals } = await supabase
      .from("deals")
      .select(`
        id, name, stage, value_cad, season, created_at, updated_at,
        company:companies(name),
        rep:user_profiles(full_name),
        deal_items(id)
      `)
      .in("stage", PIPELINE_STAGES)
      .order("created_at", { ascending: false });

    if (!rawDeals) {
      setLoading(false);
      return;
    }

    const rows: PipelineDeal[] = rawDeals.map((d) => {
      const company = d.company as unknown as { name: string } | null;
      const rep = d.rep as unknown as { full_name: string | null } | null;
      const items = d.deal_items as unknown as Array<{ id: string }> | null;
      return {
        id: d.id,
        name: d.name,
        stage: d.stage as QuoteStage,
        value_cad: d.value_cad,
        season: d.season,
        created_at: d.created_at,
        updated_at: d.updated_at ?? null,
        company_name: company?.name ?? null,
        rep_name: rep?.full_name ?? null,
        item_count: items?.length ?? 0,
      };
    });

    setDeals(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const seasons = Array.from(new Set(deals.map((d) => d.season).filter(Boolean))) as string[];

  const filtered = deals.filter((d) => {
    if (seasonFilter !== "all" && d.season !== seasonFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.company_name && d.company_name.toLowerCase().includes(q)) ||
      (d.rep_name && d.rep_name.toLowerCase().includes(q))
    );
  });

  const handleStageChange = async (dealId: string, newStage: QuoteStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
    );
    const { error } = await supabase
      .from("deals")
      .update({ stage: newStage })
      .eq("id", dealId);
    if (error) {
      console.error("Failed to update deal stage:", error);
      load();
    }
  };

  if (loading) {
    return (
      <div className="page-enter flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} deal{filtered.length !== 1 ? "s" : ""} ·{" "}
            ${filtered.reduce((s, d) => s + d.value_cad, 0).toLocaleString()} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>

          <Select value={seasonFilter} onValueChange={setSeason}>
            <SelectTrigger className="w-36 gap-2">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue placeholder="All seasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {seasons.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deal table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead className="hidden sm:table-cell">Course</TableHead>
              <TableHead className="hidden md:table-cell text-center">Products</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="hidden lg:table-cell">Rep</TableHead>
              <TableHead className="hidden md:table-cell">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((deal) => (
              <TableRow key={deal.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{deal.name}</p>
                    {deal.season && (
                      <Badge variant="outline" className="text-[10px] h-4 mt-0.5">
                        {deal.season}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {deal.company_name || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-center text-sm">
                  {deal.item_count > 0 ? (
                    <span>{deal.item_count} item{deal.item_count !== 1 ? "s" : ""}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  ${deal.value_cad.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Select
                    value={deal.stage}
                    onValueChange={(val) => handleStageChange(deal.id, val as QuoteStage)}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[130px] border-0 p-0 shadow-none focus:ring-0">
                      <Badge className={`text-[10px] ${STAGE_COLORS[deal.stage]}`}>
                        {deal.stage}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          <Badge className={`text-[10px] ${STAGE_COLORS[stage]}`}>
                            {stage}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {deal.rep_name || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {(deal.updated_at || deal.created_at).split("T")[0]}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No deals found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
