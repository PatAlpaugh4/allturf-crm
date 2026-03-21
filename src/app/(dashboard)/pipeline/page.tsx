"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
  Search,
  Loader2,
  MoreVertical,
  Send,
  Package,
  Truck,
  DollarSign,
  GripVertical,
  Filter,
} from "lucide-react";
import {
  STAGE_COLORS,
  type QuoteStage,
} from "@/lib/types";

// Pipeline stages (excludes Paid & Closed Lost — those are terminal)
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
  company_name: string | null;
  item_count: number;
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function ageBadge(days: number) {
  if (days <= 7) return null;
  if (days <= 14) return <Badge variant="outline" className="text-[10px] h-4 bg-yellow-50 text-yellow-700 border-yellow-200">{days}d</Badge>;
  if (days <= 30) return <Badge variant="outline" className="text-[10px] h-4 bg-orange-50 text-orange-700 border-orange-200">{days}d</Badge>;
  return <Badge variant="outline" className="text-[10px] h-4 bg-red-50 text-red-700 border-red-200">{days}d</Badge>;
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
        id, name, stage, value_cad, season, created_at,
        company:companies(name),
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
      const items = d.deal_items as unknown as Array<{ id: string }> | null;
      return {
        id: d.id,
        name: d.name,
        stage: d.stage as QuoteStage,
        value_cad: d.value_cad,
        season: d.season,
        created_at: d.created_at,
        company_name: company?.name ?? null,
        item_count: items?.length ?? 0,
      };
    });

    setDeals(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Collect unique seasons
  const seasons = Array.from(new Set(deals.map((d) => d.season).filter(Boolean))) as string[];

  // Filter
  const filtered = deals.filter((d) => {
    if (seasonFilter !== "all" && d.season !== seasonFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.company_name && d.company_name.toLowerCase().includes(q))
    );
  });

  // Group by stage
  const columns = PIPELINE_STAGES.map((stage) => ({
    stage,
    deals: filtered.filter((d) => d.stage === stage),
    total: filtered.filter((d) => d.stage === stage).reduce((s, d) => s + d.value_cad, 0),
  }));

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;
      const dealId = result.draggableId;
      const newStage = result.destination.droppableId as QuoteStage;
      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.stage === newStage) return;

      // Optimistic update
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
      );

      await supabase
        .from("deals")
        .update({ stage: newStage })
        .eq("id", dealId);
    },
    [deals, supabase]
  );

  const quickAction = useCallback(
    async (dealId: string, action: "send" | "order" | "delivered") => {
      const stageMap: Record<string, QuoteStage> = {
        send: "Quote Sent",
        order: "Order Placed",
        delivered: "Delivered",
      };
      const newStage = stageMap[action];
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d))
      );
      await supabase
        .from("deals")
        .update({ stage: newStage })
        .eq("id", dealId);
    },
    [supabase]
  );

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

      {/* Kanban Board — horizontally scrollable on mobile */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory md:snap-none scroll-smooth">
          {columns.map((col) => (
            <div key={col.stage} className="flex-shrink-0 w-[260px] snap-start">
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${STAGE_COLORS[col.stage]}`}>
                    {col.stage}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {col.deals.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ${col.total.toLocaleString()}
                </span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={col.stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-lg border p-2 min-h-[200px] transition-colors ${
                      snapshot.isDraggingOver
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30"
                    }`}
                  >
                    <ScrollArea className="max-h-[calc(100vh-260px)]">
                      <div className="space-y-2">
                        {col.deals.map((deal, index) => (
                          <Draggable
                            key={deal.id}
                            draggableId={deal.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`${
                                  snapshot.isDragging
                                    ? "shadow-lg ring-2 ring-primary/20"
                                    : ""
                                }`}
                              >
                                <PipelineCard
                                  deal={deal}
                                  dragHandleProps={provided.dragHandleProps}
                                  onAction={quickAction}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </ScrollArea>

                    {col.deals.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        No deals
                      </p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Card
// ---------------------------------------------------------------------------
function PipelineCard({
  deal,
  dragHandleProps,
  onAction,
}: {
  deal: PipelineDeal;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onAction: (id: string, action: "send" | "order" | "delivered") => void;
}) {
  const days = daysSince(deal.created_at);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          <div
            {...dragHandleProps}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{deal.name}</p>
            {deal.company_name && (
              <p className="text-xs text-muted-foreground truncate">
                {deal.company_name}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 min-h-[44px] min-w-[44px] p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {deal.stage === "Quote Draft" && (
                <DropdownMenuItem onClick={() => onAction(deal.id, "send")}>
                  <Send className="h-3.5 w-3.5 mr-2" />
                  Send Quote
                </DropdownMenuItem>
              )}
              {(deal.stage === "Quote Approved" || deal.stage === "Quote Sent") && (
                <DropdownMenuItem onClick={() => onAction(deal.id, "order")}>
                  <Package className="h-3.5 w-3.5 mr-2" />
                  Convert to Order
                </DropdownMenuItem>
              )}
              {(deal.stage === "Shipped" || deal.stage === "Order Placed") && (
                <DropdownMenuItem onClick={() => onAction(deal.id, "delivered")}>
                  <Truck className="h-3.5 w-3.5 mr-2" />
                  Mark Delivered
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">
              ${deal.value_cad.toLocaleString()}
            </span>
            {deal.item_count > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {deal.item_count} item{deal.item_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {deal.season && (
              <Badge variant="outline" className="text-[10px] h-4">
                {deal.season}
              </Badge>
            )}
            {ageBadge(days)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
