"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  FlaskConical,
  Calculator,
  GitCompareArrows,
  Columns3,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  CATEGORY_COLORS,
  type ProductCategory,
  type Offering,
} from "@/lib/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "All">("All");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [diseaseSearch, setDiseaseSearch] = useState("");

  // Comparison
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // Tank mix
  const [tankMixIds, setTankMixIds] = useState<Set<string>>(new Set());

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("offerings")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (data) setProducts(data as Offering[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (ingredientSearch) {
        const q = ingredientSearch.toLowerCase();
        const inIngredients = p.active_ingredients?.some((i) =>
          i.toLowerCase().includes(q)
        );
        const inName = p.name.toLowerCase().includes(q);
        const inManufacturer = p.manufacturer?.toLowerCase().includes(q);
        if (!inIngredients && !inName && !inManufacturer) return false;
      }
      if (diseaseSearch) {
        const q = diseaseSearch.toLowerCase();
        const inDiseases = p.target_diseases?.some((d) =>
          d.toLowerCase().includes(q)
        );
        const inPests = p.target_pests?.some((pe) =>
          pe.toLowerCase().includes(q)
        );
        if (!inDiseases && !inPests) return false;
      }
      return true;
    });
  }, [products, selectedCategory, ingredientSearch, diseaseSearch]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }, []);

  const toggleTankMix = useCallback((id: string) => {
    setTankMixIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const compareProducts = useMemo(
    () => products.filter((p) => compareIds.has(p.id)),
    [products, compareIds]
  );

  const tankMixProducts = useMemo(
    () => products.filter((p) => tankMixIds.has(p.id)),
    [products, tankMixIds]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
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
            <FlaskConical className="h-5 w-5 text-primary" />
            Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {products.length} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.size >= 2 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowCompare(true)}
            >
              <Columns3 className="h-4 w-4" />
              Compare ({compareIds.size})
            </Button>
          )}
          <TankMixDialog
            products={products}
            selected={tankMixProducts}
            onToggle={toggleTankMix}
          />
        </div>
      </div>

      {/* Category pills — touch-friendly */}
      <div className="flex flex-wrap gap-1.5">
        <button
          data-no-touch-resize
          onClick={() => setSelectedCategory("All")}
          className={`rounded-full px-3 py-2 text-xs font-medium transition-colors min-h-[36px] sm:min-h-0 sm:py-1 ${
            selectedCategory === "All"
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {PRODUCT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            data-no-touch-resize
            onClick={() => setSelectedCategory(cat === selectedCategory ? "All" : cat)}
            className={`rounded-full px-3 py-2 text-xs font-medium transition-colors min-h-[36px] sm:min-h-0 sm:py-1 ${
              selectedCategory === cat
                ? CATEGORY_COLORS[cat]
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ingredient, or manufacturer..."
            value={ingredientSearch}
            onChange={(e) => setIngredientSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by target disease/pest..."
            value={diseaseSearch}
            onChange={(e) => setDiseaseSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Product grid — single column on mobile */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            isComparing={compareIds.has(p.id)}
            onToggleCompare={() => toggleCompare(p.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FlaskConical className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No products match your filters</p>
        </div>
      )}

      {/* Comparison dialog */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Product Comparison</DialogTitle>
            <DialogDescription>
              Side-by-side comparison of {compareProducts.length} products
            </DialogDescription>
          </DialogHeader>
          <ComparisonTable products={compareProducts} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------
function ProductCard({
  product,
  isComparing,
  onToggleCompare,
}: {
  product: Offering;
  isComparing: boolean;
  onToggleCompare: () => void;
}) {
  return (
    <Card className="relative">
      <CardContent className="pt-4 pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{product.name}</h3>
            <p className="text-xs text-muted-foreground">
              {product.manufacturer || "—"} · PCP# {product.pcp_registration_number || "N/A"}
            </p>
          </div>
          <Badge className={`shrink-0 text-[10px] h-5 ${CATEGORY_COLORS[product.category]}`}>
            {product.category}
          </Badge>
        </div>

        {product.moa_group && (
          <p className="text-xs">
            <span className="text-muted-foreground">MOA:</span>{" "}
            <span className="font-medium">{product.moa_group}</span>
          </p>
        )}

        {product.active_ingredients && product.active_ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.active_ingredients.slice(0, 3).map((ing, i) => (
              <Badge key={i} variant="outline" className="text-[10px] h-5">
                {ing}
              </Badge>
            ))}
          </div>
        )}

        {product.target_diseases && product.target_diseases.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            Targets: {product.target_diseases.slice(0, 3).join(", ")}
          </p>
        )}

        {(product.application_rate_min != null || product.application_rate_max != null) && (
          <p className="text-xs">
            <span className="text-muted-foreground">Rate:</span>{" "}
            {product.application_rate_min ?? "—"}–{product.application_rate_max ?? "—"}{" "}
            {product.application_rate_unit || ""}
          </p>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">${product.price.toLocaleString()}</span>
          {product.ontario_class ? (
            <Badge variant="outline" className="text-[10px] h-5 border-green-300 text-green-700 dark:border-green-800 dark:text-green-400">
              ON: {product.ontario_class}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] h-5 border-red-300 text-red-600">
              Not ON registered
            </Badge>
          )}
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <RateCalculatorSheet product={product} />
          <div className="flex items-center gap-1.5 ml-auto">
            <Checkbox
              checked={isComparing}
              onCheckedChange={onToggleCompare}
              id={`compare-${product.id}`}
            />
            <label
              htmlFor={`compare-${product.id}`}
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Compare
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Rate Calculator Sheet
// ---------------------------------------------------------------------------
function RateCalculatorSheet({ product }: { product: Offering }) {
  const [acreage, setAcreage] = useState("");
  const [rate, setRate] = useState("");

  const acreageNum = parseFloat(acreage) || 0;
  const rateNum = parseFloat(rate) || product.application_rate_max || 0;

  // Convert acreage to hectares (1 acre = 0.404686 ha)
  const hectares = acreageNum * 0.404686;

  // Calculate total product needed
  const unit = product.application_rate_unit || "L/ha";
  let totalNeeded = 0;
  if (unit.includes("/ha")) {
    totalNeeded = rateNum * hectares;
  } else if (unit.includes("/100m")) {
    totalNeeded = rateNum * (hectares * 100); // 1 ha = 100 × 100m²
  } else if (unit.includes("/1000ft")) {
    totalNeeded = rateNum * (acreageNum * 43.56); // 1 acre = 43,560 ft² = 43.56 × 1000ft²
  } else {
    totalNeeded = rateNum * hectares;
  }

  // Calculate packs needed
  const packSizes = product.pack_sizes as Record<string, number> | null;
  const packs = packSizes
    ? Object.entries(packSizes).map(([label, size]) => ({
        label,
        size: typeof size === "number" ? size : parseFloat(String(size)) || 0,
        needed: typeof size === "number" && size > 0 ? Math.ceil(totalNeeded / size) : 0,
      }))
    : [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
          <Calculator className="h-3.5 w-3.5" />
          Rate Calc
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Application Rate Calculator</SheetTitle>
          <SheetDescription>{product.name}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Area (acres)</label>
            <Input
              type="number"
              placeholder="e.g. 5"
              value={acreage}
              onChange={(e) => setAcreage(e.target.value)}
              className="mt-1"
            />
            {acreageNum > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                = {hectares.toFixed(2)} hectares
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">
              Application Rate ({unit})
            </label>
            <Input
              type="number"
              placeholder={`${product.application_rate_min ?? "—"}–${product.application_rate_max ?? "—"}`}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Label range: {product.application_rate_min ?? "—"} – {product.application_rate_max ?? "—"} {unit}
            </p>
            {rateNum > 0 && product.application_rate_max != null && rateNum > product.application_rate_max && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Exceeds PMRA label maximum!
              </p>
            )}
          </div>

          <Separator />

          {acreageNum > 0 && rateNum > 0 && (
            <div className="space-y-3">
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-sm font-medium">Total Product Needed</p>
                <p className="text-2xl font-bold text-primary">
                  {totalNeeded.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {unit.split("/")[0] || "units"}
                  </span>
                </p>
              </div>

              {packs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Packages Needed</p>
                  <div className="space-y-1.5">
                    {packs.map((pack) => (
                      <div
                        key={pack.label}
                        className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2 text-sm"
                      >
                        <span>{pack.label} ({pack.size})</span>
                        <span className="font-semibold">{pack.needed} pack{pack.needed !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md bg-accent/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Estimated cost: <span className="font-semibold text-foreground">${(totalNeeded * product.price).toFixed(2)} CAD</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Tank Mix Dialog
// ---------------------------------------------------------------------------
function TankMixDialog({
  products,
  selected,
  onToggle,
}: {
  products: Offering[];
  selected: Offering[];
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredForSelect = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  // Build compatibility matrix
  const matrix = useMemo(() => {
    if (selected.length < 2) return null;
    const results: { a: string; b: string; compatible: boolean }[] = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i];
        const b = selected[j];
        const aCompat = a.compatible_tank_mixes?.includes(b.id) ?? false;
        const bCompat = b.compatible_tank_mixes?.includes(a.id) ?? false;
        results.push({
          a: a.name,
          b: b.name,
          compatible: aCompat || bCompat,
        });
      }
    }
    return results;
  }, [selected]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GitCompareArrows className="h-4 w-4" />
          Tank Mix Check
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Tank Mix Compatibility Checker</DialogTitle>
          <DialogDescription>
            Select 2 or more products to check compatibility
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product selector */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-48 rounded-md border">
            <div className="p-2 space-y-0.5">
              {filteredForSelect.slice(0, 20).map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selected.some((s) => s.id === p.id)}
                    onCheckedChange={() => onToggle(p.id)}
                  />
                  <span className="truncate">{p.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 ml-auto shrink-0">
                    {p.category}
                  </Badge>
                </label>
              ))}
            </div>
          </ScrollArea>

          {/* Selected pills */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1 text-xs">
                  {p.name}
                  <button onClick={() => onToggle(p.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Compatibility matrix */}
          {matrix && matrix.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <p className="text-sm font-medium">Compatibility Results</p>
              <div className="space-y-1.5">
                {matrix.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      m.compatible
                        ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50"
                        : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
                    }`}
                  >
                    {m.compatible ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span>
                      <span className="font-medium">{m.a}</span>
                      {" + "}
                      <span className="font-medium">{m.b}</span>
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {m.compatible ? "Compatible" : "Not verified"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Select at least 2 products to check compatibility
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Comparison Table
// ---------------------------------------------------------------------------
function ComparisonTable({ products }: { products: Offering[] }) {
  if (products.length === 0) return null;

  const rows: { label: string; getValue: (p: Offering) => string }[] = [
    { label: "Category", getValue: (p) => p.category },
    { label: "Manufacturer", getValue: (p) => p.manufacturer || "—" },
    { label: "PCP#", getValue: (p) => p.pcp_registration_number || "N/A" },
    { label: "MOA Group", getValue: (p) => p.moa_group || "—" },
    { label: "Active Ingredients", getValue: (p) => p.active_ingredients?.join(", ") || "—" },
    {
      label: "Rate Range",
      getValue: (p) =>
        `${p.application_rate_min ?? "—"}–${p.application_rate_max ?? "—"} ${p.application_rate_unit || ""}`,
    },
    { label: "Price", getValue: (p) => `$${p.price.toLocaleString()}` },
    { label: "Target Diseases", getValue: (p) => p.target_diseases?.join(", ") || "—" },
    { label: "Target Pests", getValue: (p) => p.target_pests?.join(", ") || "—" },
    { label: "REI", getValue: (p) => p.re_entry_interval_hours != null ? `${p.re_entry_interval_hours}h` : "—" },
    { label: "Rain-fast", getValue: (p) => p.rain_fast_hours != null ? `${p.rain_fast_hours}h` : "—" },
    { label: "Signal Word", getValue: (p) => p.signal_word || "—" },
    { label: "Ontario Class", getValue: (p) => p.ontario_class || "Not registered" },
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Property</TableHead>
            {products.map((p) => (
              <TableHead key={p.id} className="min-w-[180px]">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <Badge className={`text-[10px] h-4 mt-1 ${CATEGORY_COLORS[p.category]}`}>
                    {p.category}
                  </Badge>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium text-muted-foreground text-xs">
                {row.label}
              </TableCell>
              {products.map((p) => (
                <TableCell key={p.id} className="text-sm">
                  {row.getValue(p)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
