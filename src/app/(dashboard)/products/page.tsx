"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  Search,
  FlaskConical,
  Loader2,
  Package,
  Save,
  Tag,
  Plus,
  X,
  Pencil,
  Calendar,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  CATEGORY_COLORS,
  type ProductCategory,
  type Offering,
} from "@/lib/types";
import { toast } from "sonner";

interface InventoryRow {
  product_id: string;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_on_order: number;
  reorder_point: number;
  demand_this_week: number;
  product: { id: string; name: string; category: string; pcp_registration_number: string | null };
}

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  product_id: string | null;
  discount_type: string | null;
  discount_value: number | null;
  min_quantity: number | null;
  start_date: string;
  end_date: string;
  active: boolean;
  product: { id: string; name: string; category: string } | null;
}

export default function ProductsPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [showPromoManager, setShowPromoManager] = useState(false);

  const supabase = createBrowserClient();

  const fetchPromotions = useCallback(async () => {
    setPromosLoading(true);
    const res = await fetch("/api/v1/promotions");
    if (res.ok) {
      const data = await res.json();
      setPromotions(data.promotions || []);
    }
    setPromosLoading(false);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("offerings")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (fetchError) throw fetchError;
      if (data) setProducts(data as Offering[]);
      setLoading(false);
    } catch {
      setError("Failed to load products. Please try again.");
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProducts();
    fetchPromotions();
  }, [loadProducts, fetchPromotions]);

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    const res = await fetch("/api/v1/inventory");
    if (res.ok) {
      const data = await res.json();
      setInventory(data.inventory || []);
    }
    setInventoryLoading(false);
  }, []);

  useEffect(() => {
    if (showInventory) fetchInventory();
  }, [showInventory, fetchInventory]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const inName = p.name.toLowerCase().includes(q);
        const inIngredients = p.active_ingredients?.some((i) =>
          i.toLowerCase().includes(q)
        );
        const inManufacturer = p.manufacturer?.toLowerCase().includes(q);
        const inDiseases = p.target_diseases?.some((d) =>
          d.toLowerCase().includes(q)
        );
        if (!inName && !inIngredients && !inManufacturer && !inDiseases) return false;
      }
      return true;
    });
  }, [products, selectedCategory, search]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {products.length} products
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button
                variant={showPromoManager ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPromoManager(!showPromoManager)}
                className="gap-2"
              >
                <Tag className="h-4 w-4" />
                {showPromoManager ? "Hide Specials" : "Manage Specials"}
              </Button>
              <Button
                variant={showInventory ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInventory(!showInventory)}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                {showInventory ? "Hide Inventory" : "Manage Inventory"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadProducts()}>Retry</Button>
          <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Current Specials (visible to all users) */}
      {!promosLoading && promotions.length > 0 && !showPromoManager && (
        <CurrentSpecials promotions={promotions} />
      )}

      {/* Admin promotion manager */}
      {showPromoManager && isAdmin && (
        <PromotionManager
          promotions={promotions}
          products={products}
          loading={promosLoading}
          onRefresh={fetchPromotions}
        />
      )}

      {/* Admin inventory table */}
      {showInventory && isAdmin && (
        <InventoryManager
          products={products}
          inventory={inventory}
          loading={inventoryLoading}
          onRefresh={fetchInventory}
        />
      )}

      {/* Category pills */}
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ingredient, disease, or manufacturer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Product grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FlaskConical className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No products match your filters</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Current Specials (visible to all users)
// ---------------------------------------------------------------------------

function CurrentSpecials({ promotions }: { promotions: Promotion[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Tag className="h-4 w-4 text-emerald-600" />
        Current Specials
      </h2>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((promo) => (
          <Card key={promo.id} className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="pt-3 pb-2.5 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">{promo.title}</h3>
                {promo.discount_value != null && (
                  <Badge className="shrink-0 text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {promo.discount_type === "percentage" ? `${promo.discount_value}% off` :
                     promo.discount_type === "fixed_amount" ? `$${promo.discount_value} off` :
                     promo.discount_type === "volume_pricing" ? "Volume deal" :
                     promo.discount_type === "bundle" ? "Bundle" : "Special"}
                  </Badge>
                )}
              </div>
              {promo.product?.name && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{promo.product.name}</p>
              )}
              {promo.description && (
                <p className="text-xs text-muted-foreground">{promo.description}</p>
              )}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                <Calendar className="h-3 w-3" />
                {promo.min_quantity ? `Min ${promo.min_quantity} units · ` : ""}
                Ends {new Date(promo.end_date + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promotion Manager (admin-only)
// ---------------------------------------------------------------------------

function PromotionManager({
  promotions,
  products,
  loading,
  onRefresh,
}: {
  promotions: Promotion[];
  products: Offering[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Promotions Manager
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="gap-1.5 h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Special
          </Button>
        </div>

        {showForm && (
          <PromoForm
            products={products}
            editingPromo={editingId ? promotions.find((p) => p.id === editingId) || null : null}
            onSaved={() => { setShowForm(false); setEditingId(null); onRefresh(); }}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
          />
        )}

        {promotions.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active promotions. Add one to arm your reps with pricing info.
          </p>
        )}

        {promotions.length > 0 && (
          <div className="space-y-2 mt-2">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{promo.title}</span>
                    {promo.discount_value != null && (
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                        {promo.discount_type === "percentage" ? `${promo.discount_value}%` :
                         promo.discount_type === "fixed_amount" ? `$${promo.discount_value}` :
                         promo.discount_type || "Special"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {promo.product?.name || "All products"}
                    {" · "}
                    {promo.start_date} to {promo.end_date}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingId(promo.id); setShowForm(true); }}
                    className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/v1/promotions/${promo.id}`, { method: "DELETE" });
                      if (res.ok) {
                        toast.success("Promotion deactivated");
                        onRefresh();
                      } else {
                        toast.error("Failed to deactivate");
                      }
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Deactivate"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Promo Form (add / edit)
// ---------------------------------------------------------------------------

function PromoForm({
  products,
  editingPromo,
  onSaved,
  onCancel,
}: {
  products: Offering[];
  editingPromo: Promotion | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editingPromo?.title || "");
  const [description, setDescription] = useState(editingPromo?.description || "");
  const [productId, setProductId] = useState(editingPromo?.product_id || "");
  const [discountType, setDiscountType] = useState(editingPromo?.discount_type || "percentage");
  const [discountValue, setDiscountValue] = useState(
    editingPromo?.discount_value != null ? String(editingPromo.discount_value) : ""
  );
  const [minQuantity, setMinQuantity] = useState(
    editingPromo?.min_quantity != null ? String(editingPromo.min_quantity) : ""
  );
  const [startDate, setStartDate] = useState(editingPromo?.start_date || new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(editingPromo?.end_date || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate) {
      toast.error("Title, start date, and end date are required");
      return;
    }

    setSaving(true);
    const payload = {
      title,
      description: description || null,
      product_id: productId || null,
      discount_type: discountType || null,
      discount_value: discountValue ? parseFloat(discountValue) : null,
      min_quantity: minQuantity ? parseInt(minQuantity) : null,
      start_date: startDate,
      end_date: endDate,
    };

    const url = editingPromo
      ? `/api/v1/promotions/${editingPromo.id}`
      : "/api/v1/promotions";
    const method = editingPromo ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      toast.success(editingPromo ? "Promotion updated" : "Promotion created");
      onSaved();
    } else {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(err.error || "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-accent/30 p-3 mb-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Spring Banner Maxx Sale"
            className="mt-1"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details reps can mention to customers..."
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-transparent px-2 py-2 text-sm"
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-transparent px-2 py-2 text-sm"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed_amount">Fixed Amount</option>
              <option value="volume_pricing">Volume Pricing</option>
              <option value="bundle">Bundle</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Value</label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percentage" ? "15" : "50"}
              className="mt-1"
              step="0.01"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Min Quantity</label>
          <Input
            type="number"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            placeholder="Optional"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {editingPromo ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inventory Manager (admin-only)
// ---------------------------------------------------------------------------

function InventoryManager({
  products,
  inventory,
  loading,
  onRefresh,
}: {
  products: Offering[];
  inventory: InventoryRow[];
  loading: boolean;
  onRefresh: () => void;
}) {
  // Build the display list: products that have inventory rows, plus all products that don't yet
  const rows = useMemo(() => {
    // Show tracked items first (sorted by low stock), then untracked
    const tracked = inventory.map((inv) => ({
      productId: inv.product_id,
      name: inv.product?.name || "Unknown",
      category: inv.product?.category || "",
      onHand: inv.quantity_on_hand,
      committed: inv.quantity_committed,
      onOrder: inv.quantity_on_order,
      reorderPoint: inv.reorder_point,
      demand: inv.demand_this_week,
      isLow: inv.quantity_on_hand <= inv.reorder_point && inv.reorder_point > 0,
      isTracked: true,
    }));

    // Sort: low stock first, then by demand
    tracked.sort((a, b) => {
      if (a.isLow !== b.isLow) return a.isLow ? -1 : 1;
      return b.demand - a.demand;
    });

    return tracked;
  }, [inventory]);

  const untrackedProducts = useMemo(() => {
    const trackedIds = new Set(inventory.map((r) => r.product_id));
    return products.filter((p) => !trackedIds.has(p.id));
  }, [products, inventory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Inventory Tracker
          </h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} tracked · {rows.filter((r) => r.isLow).length} low stock
          </p>
        </div>

        {rows.length === 0 && untrackedProducts.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 mb-3">
            No products tracked yet. Add a product below to start.
          </p>
        )}

        {/* Tracked inventory table */}
        {rows.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2 font-medium">Product</th>
                  <th className="text-right py-2 px-2 font-medium">On Hand</th>
                  <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Committed</th>
                  <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">On Order</th>
                  <th className="text-right py-2 px-2 font-medium">Reorder Pt</th>
                  <th className="text-right py-2 px-2 font-medium">Demand/wk</th>
                  <th className="text-right py-2 pl-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <InventoryRowEditor
                    key={row.productId}
                    row={row}
                    onSaved={onRefresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add untracked product */}
        {untrackedProducts.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <AddInventoryRow products={untrackedProducts} onAdded={onRefresh} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryRowEditor({
  row,
  onSaved,
}: {
  row: {
    productId: string;
    name: string;
    category: string;
    onHand: number;
    committed: number;
    onOrder: number;
    reorderPoint: number;
    demand: number;
    isLow: boolean;
  };
  onSaved: () => void;
}) {
  const [onHand, setOnHand] = useState(String(row.onHand));
  const [committed, setCommitted] = useState(String(row.committed));
  const [onOrder, setOnOrder] = useState(String(row.onOrder));
  const [reorderPt, setReorderPt] = useState(String(row.reorderPoint));
  const [saving, setSaving] = useState(false);

  const isDirty =
    parseInt(onHand) !== row.onHand ||
    parseInt(committed) !== row.committed ||
    parseInt(onOrder) !== row.onOrder ||
    parseInt(reorderPt) !== row.reorderPoint;

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/v1/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: row.productId,
        quantity_on_hand: parseInt(onHand) || 0,
        quantity_committed: parseInt(committed) || 0,
        quantity_on_order: parseInt(onOrder) || 0,
        reorder_point: parseInt(reorderPt) || 0,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`${row.name} inventory updated`);
      onSaved();
    } else {
      toast.error("Failed to save");
    }
  };

  return (
    <tr className={`border-b last:border-b-0 ${row.isLow ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1.5">
          <span className="truncate max-w-[180px] font-medium">{row.name}</span>
          {row.isLow && (
            <Badge className="text-[9px] bg-red-100 text-red-700 shrink-0">LOW</Badge>
          )}
        </div>
      </td>
      <td className="py-2 px-1">
        <input
          type="number"
          value={onHand}
          onChange={(e) => setOnHand(e.target.value)}
          className={`w-16 text-right rounded border px-1.5 py-1 text-xs bg-transparent ${
            row.isLow ? "border-red-300 text-red-700" : "border-border"
          }`}
        />
      </td>
      <td className="py-2 px-1 hidden sm:table-cell">
        <input
          type="number"
          value={committed}
          onChange={(e) => setCommitted(e.target.value)}
          className="w-16 text-right rounded border border-border px-1.5 py-1 text-xs bg-transparent"
        />
      </td>
      <td className="py-2 px-1 hidden sm:table-cell">
        <input
          type="number"
          value={onOrder}
          onChange={(e) => setOnOrder(e.target.value)}
          className="w-16 text-right rounded border border-border px-1.5 py-1 text-xs bg-transparent"
        />
      </td>
      <td className="py-2 px-1">
        <input
          type="number"
          value={reorderPt}
          onChange={(e) => setReorderPt(e.target.value)}
          className="w-16 text-right rounded border border-border px-1.5 py-1 text-xs bg-transparent"
        />
      </td>
      <td className="py-2 px-2 text-right text-xs text-muted-foreground">
        {row.demand > 0 ? (
          <span className={row.demand >= 3 ? "text-orange-600 font-medium" : ""}>
            {row.demand}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-2 pl-1 text-right">
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded p-1.5 text-primary hover:bg-primary/10 transition-colors"
            title="Save"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

function AddInventoryRow({
  products,
  onAdded,
}: {
  products: Offering[];
  onAdded: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selectedId) return;
    setSaving(true);
    const res = await fetch("/api/v1/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: selectedId,
        quantity_on_hand: 0,
        quantity_committed: 0,
        quantity_on_order: 0,
        reorder_point: 0,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const product = products.find((p) => p.id === selectedId);
      toast.success(`${product?.name || "Product"} added to inventory`);
      setSelectedId("");
      onAdded();
    } else {
      toast.error("Failed to add");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 rounded border border-border bg-transparent px-2 py-1.5 text-sm min-h-[36px]"
      >
        <option value="">Add a product to track...</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.category})
          </option>
        ))}
      </select>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!selectedId || saving}
        className="shrink-0"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------
function ProductCard({ product }: { product: Offering }) {
  return (
    <Card>
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

        <Separator />

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
      </CardContent>
    </Card>
  );
}
