/*
 * GROUPBUY Admin Dashboard
 * Products panel: card grid, category filter tabs, search, drag-to-reorder,
 * coloured badge chips, image preview, skeleton loading, missing-PD-price warning
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Search,
  GripVertical,
  ImageOff,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

// dnd-kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Sort types ──────────────────────────────────────────────────────────────

type SortField = "custom" | "name" | "price" | "date" | "availability";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { field: SortField; dir: SortDir; label: string }[] = [
  { field: "custom",       dir: "asc",  label: "Custom (drag order)" },
  { field: "name",         dir: "asc",  label: "Name A → Z" },
  { field: "name",         dir: "desc", label: "Name Z → A" },
  { field: "price",        dir: "asc",  label: "Price low → high" },
  { field: "price",        dir: "desc", label: "Price high → low" },
  { field: "date",         dir: "desc", label: "Date added (newest)" },
  { field: "date",         dir: "asc",  label: "Date added (oldest)" },
  { field: "availability", dir: "asc",  label: "Unavailable first" },
  { field: "availability", dir: "desc", label: "Available first" },
];

function sortKey(field: SortField, dir: SortDir): string {
  return `${field}:${dir}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type Category =
  | "limited-offer"
  | "featured-deals"
  | "beef"
  | "pork"
  | "lamb"
  | "poultry"
  | "seafood"
  | "whole-slabs"
  | "whole-animal"
  | "box-deals"
  | "mince"
  | "offal-tallow"
  | "value-added"
  | "korean-bbq-hotpot"
  | "freezer"
  | "other";
type BadgeType = "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all",               label: "All" },
  { value: "limited-offer",     label: "Limited Offer" },
  { value: "featured-deals",    label: "Featured Deals" },
  { value: "beef",              label: "Beef" },
  { value: "pork",              label: "Pork" },
  { value: "lamb",              label: "Lamb" },
  { value: "poultry",           label: "Poultry" },
  { value: "seafood",           label: "Seafood" },
  { value: "whole-slabs",       label: "Whole Slabs" },
  { value: "whole-animal",      label: "Whole Animal & Sides" },
  { value: "box-deals",         label: "Box Deals" },
  { value: "mince",             label: "Mince" },
  { value: "offal-tallow",      label: "Offal & Tallow" },
  { value: "value-added",       label: "Value Added" },
  { value: "korean-bbq-hotpot", label: "Korean BBQ / Hotpot" },
  { value: "freezer",           label: "Freezer" },
  { value: "other",             label: "Other" },
];

const BADGE_STYLES: Record<string, string> = {
  LIMITED: "bg-amber-100 text-amber-800 border-amber-200",
  POPULAR: "bg-green-100 text-green-800 border-green-200",
  NEW: "bg-blue-100 text-blue-800 border-blue-200",
  "SOLD OUT": "bg-red-100 text-red-800 border-red-200",
};

const CATEGORY_EMOJI: Record<string, string> = {
  "limited-offer":     "⭐",
  "featured-deals":    "🔥",
  beef:                "🥩",
  pork:                "🐷",
  lamb:                "🐑",
  poultry:             "🍗",
  seafood:             "🦐",
  "whole-slabs":       "🍖",
  "whole-animal":      "🐄",
  "box-deals":         "📦",
  mince:               "🫙",
  "offal-tallow":      "🫀",
  "value-added":       "✨",
  "korean-bbq-hotpot": "🍲",
  freezer:             "🧊",
  other:               "🛒",
};

interface ProductForm {
  id?: number;
  name: string;
  cut: string;
  category: Category;
  description: string;
  price: string;
  powerDropPrice: string;
  unit: string;
  badge: BadgeType;
  available: boolean;
  img: string;
  sortOrder: number;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  cut: "",
  category: "beef",
  description: "",
  price: "",
  powerDropPrice: "",
  unit: "/ kg",
  badge: null,
  available: true,
  img: "",
  sortOrder: 0,
};

// ─── Admin Guard ──────────────────────────────────────────────────────────────

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Please sign in to access the admin panel.
          </p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You need admin privileges to access this page.
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function Admin() {
  return (
    <AdminGuard>
      <DashboardLayout>
        <AdminContent />
      </DashboardLayout>
    </AdminGuard>
  );
}

// ─── Sortable Product Card ────────────────────────────────────────────────────

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    cut: string;
    category: string;
    price: string;
    powerDropPrice?: string | null;
    unit: string;
    badge?: string | null;
    available: boolean;
    img?: string | null;
    sortOrder: number;
    description?: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: (available: boolean) => void;
  isUpdatingAvailability: boolean;
}

function SortableProductCard({
  product,
  onEdit,
  onDelete,
  onToggleAvailability,
  isUpdatingAvailability,
}: ProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const hasMissingPdPrice = !product.powerDropPrice;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-md ${
        !product.available ? "opacity-60" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Image */}
      <div className="relative h-36 bg-muted flex items-center justify-center overflow-hidden">
        {product.img ? (
          <img
            src={product.img}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`flex flex-col items-center gap-1 text-muted-foreground ${product.img ? "hidden" : ""}`}>
          <ImageOff className="h-8 w-8 opacity-30" />
          <span className="text-xs opacity-50">No image</span>
        </div>

        {/* Category emoji pill */}
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium capitalize flex items-center gap-1">
          <span>{CATEGORY_EMOJI[product.category] ?? "📦"}</span>
          <span>{product.category}</span>
        </div>

        {/* Badge chip */}
        {product.badge && (
          <div
            className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${
              BADGE_STYLES[product.badge] ?? "bg-muted text-muted-foreground border-border"
            }`}
          >
            {product.badge}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <p className="font-semibold text-sm leading-snug line-clamp-1">{product.name}</p>
          {product.cut && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.cut}</p>
          )}
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-base font-bold">${product.price}</span>
          <span className="text-xs text-muted-foreground">{product.unit}</span>
          {product.powerDropPrice ? (
            <span className="ml-auto font-mono text-xs font-semibold text-red-600 flex items-center gap-0.5">
              <Zap className="h-3 w-3 fill-current" />
              ${product.powerDropPrice}
            </span>
          ) : (
            <span
              className="ml-auto flex items-center gap-1 text-[10px] text-amber-600 font-medium"
              title="No Power Drop price set"
            >
              <AlertCircle className="h-3 w-3" />
              No PD price
            </span>
          )}
        </div>

        {/* Footer: availability + actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 mt-auto">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={product.available}
              disabled={isUpdatingAvailability}
              onCheckedChange={onToggleAvailability}
              className="scale-75 origin-left"
            />
            <span className="text-xs text-muted-foreground">
              {product.available ? "Available" : "Unavailable"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}

// ─── Admin Content ────────────────────────────────────────────────────────────

function AdminContent() {
  const utils = trpc.useUtils();

  // ─── Settings ───────────────────────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = trpc.settings.getAll.useQuery(undefined, {
    staleTime: 10_000,
  });

  const setSetting = trpc.admin.settings.set.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  });

  const setMultipleSettings = trpc.admin.settings.setMultiple.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  });

  const powerDropActive = settings?.powerDropActive === "true";
  const announcementActive = settings?.announcementActive !== "false";
  const announcementMessage = settings?.announcementMessage ?? "";

  const [localAnnouncement, setLocalAnnouncement] = useState<string | null>(null);
  const displayAnnouncement = localAnnouncement ?? announcementMessage;

  // ─── Products ────────────────────────────────────────────────────────────────
  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery(undefined, {
    staleTime: 10_000,
  });

  // Local order state for drag-to-reorder
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  // Derive display order: use localOrder if set, else use DB order
  const orderedProducts = useMemo(() => {
    if (!products) return [];
    if (!localOrder) return [...products].sort((a, b) => a.sortOrder - b.sortOrder);
    return localOrder
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products;
  }, [products, localOrder]);

  const upsertProduct = trpc.admin.products.upsert.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      setProductModalOpen(false);
      toast.success(editingProduct?.id ? "Product updated" : "Product created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProductMutation = trpc.admin.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Product deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const setAvailability = trpc.admin.products.setAvailability.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // Batch reorder — save new sortOrder values after drag
  const batchReorder = trpc.admin.products.batchReorder.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
    onError: (err) => {
      toast.error("Failed to save order: " + err.message);
      setLocalOrder(null);
    },
  });

  // ─── Filter & sort state ─────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("custom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSortChange = (value: string) => {
    const opt = SORT_OPTIONS.find((o) => sortKey(o.field, o.dir) === value);
    if (opt) {
      setSortField(opt.field);
      setSortDir(opt.dir);
    }
  };

  const activeSortLabel = useMemo(() => {
    if (sortField === "custom") return "Sort";
    const opt = SORT_OPTIONS.find((o) => o.field === sortField && o.dir === sortDir);
    return opt?.label ?? "Sort";
  }, [sortField, sortDir]);

  const filteredProducts = useMemo(() => {
    const filtered = orderedProducts.filter((p) => {
      const matchCat = activeCategory === "all" || p.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.cut.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    if (sortField === "custom") return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "price") {
        cmp = parseFloat(a.price) - parseFloat(b.price);
      } else if (sortField === "date") {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime();
        cmp = aTime - bTime;
      } else if (sortField === "availability") {
        // false (unavailable=0) sorts before true (available=1) in asc → unavailable first
        cmp = (a.available ? 1 : 0) - (b.available ? 1 : 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orderedProducts, activeCategory, searchQuery, sortField, sortDir]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products?.length ?? 0 };
    for (const p of products ?? []) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  // ─── Product modal state ─────────────────────────────────────────────────────
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingProduct({ ...EMPTY_FORM, sortOrder: (products?.length ?? 0) + 1 });
    setProductModalOpen(true);
  };

  const openEditModal = useCallback(
    (p: (typeof orderedProducts)[number]) => {
      setEditingProduct({
        id: p.id,
        name: p.name,
        cut: p.cut,
        category: p.category as Category,
        description: p.description ?? "",
        price: p.price,
        powerDropPrice: p.powerDropPrice ?? "",
        unit: p.unit,
        badge: p.badge as BadgeType,
        available: p.available,
        img: p.img ?? "",
        sortOrder: p.sortOrder,
      });
      setProductModalOpen(true);
    },
    []
  );

  const handleProductSubmit = () => {
    if (!editingProduct.name || !editingProduct.price) {
      toast.error("Name and price are required");
      return;
    }
    upsertProduct.mutate({
      id: editingProduct.id,
      name: editingProduct.name,
      cut: editingProduct.cut,
      category: editingProduct.category,
      description: editingProduct.description || undefined,
      price: editingProduct.price,
      powerDropPrice: editingProduct.powerDropPrice || undefined,
      unit: editingProduct.unit,
      badge: editingProduct.badge,
      available: editingProduct.available,
      img: editingProduct.img || undefined,
      sortOrder: editingProduct.sortOrder,
    });
  };

  // ─── Drag-to-reorder ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentIds = orderedProducts.map((p) => p.id);
      const oldIndex = currentIds.indexOf(active.id as number);
      const newIndex = currentIds.indexOf(over.id as number);
      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Persist new sortOrder values
      const updates = newOrder.map((id, idx) => ({ id, sortOrder: idx + 1 }));
      batchReorder.mutate({ updates });
    },
    [orderedProducts, batchReorder]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage Power Drop events, announcements, and products.
        </p>
      </div>

      {/* ─── Power Drop ──────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 p-2 rounded-md ${
                powerDropActive
                  ? "bg-red-100 text-red-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Zap className={`h-5 w-5 ${powerDropActive ? "fill-current" : ""}`} />
            </div>
            <div>
              <h2 className="font-semibold text-base">Power Drop Event</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                When active, all products show their Power Drop price and the site shows a live
                indicator.
              </p>
              {powerDropActive && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-xs font-medium text-red-600">LIVE NOW</span>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={powerDropActive}
            disabled={settingsLoading || setSetting.isPending}
            onCheckedChange={(checked) => {
              setSetting.mutate(
                { key: "powerDropActive", value: checked ? "true" : "false" },
                {
                  onSuccess: () =>
                    toast.success(checked ? "⚡ Power Drop is now LIVE" : "Power Drop ended"),
                }
              );
            }}
          />
        </div>
      </section>

      {/* ─── Announcement Banner ─────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Announcement Banner</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              The red strip at the top of the site.
            </p>
          </div>
          <Switch
            checked={announcementActive}
            disabled={settingsLoading || setSetting.isPending}
            onCheckedChange={(checked) => {
              setSetting.mutate(
                { key: "announcementActive", value: checked ? "true" : "false" },
                { onSuccess: () => toast.success(checked ? "Banner shown" : "Banner hidden") }
              );
            }}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={displayAnnouncement}
            onChange={(e) => setLocalAnnouncement(e.target.value)}
            rows={2}
            placeholder="Enter announcement message…"
            className="resize-none"
          />
          <Button
            size="sm"
            disabled={setSetting.isPending || displayAnnouncement === announcementMessage}
            onClick={() => {
              setMultipleSettings.mutate(
                [{ key: "announcementMessage", value: displayAnnouncement }],
                {
                  onSuccess: () => {
                    setLocalAnnouncement(null);
                    toast.success("Announcement updated");
                  },
                }
              );
            }}
          >
            Save Message
          </Button>
        </div>
      </section>

      {/* ─── Products ────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-card p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-base">Products</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {products?.length ?? 0} product{products?.length !== 1 ? "s" : ""} · drag cards to reorder
            </p>
          </div>
          <Button size="sm" onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        </div>

        {/* Search + Sort row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or cut…"
              className="pl-9"
            />
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`shrink-0 gap-1.5 ${
                  sortField !== "custom" ? "border-foreground/60 text-foreground" : ""
                }`}
              >
                {sortField === "custom" ? (
                  <ArrowUpDown className="h-3.5 w-3.5" />
                ) : sortDir === "asc" ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {activeSortLabel}
                </span>
                <span className="sm:hidden">Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Sort products by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortKey(sortField, sortDir)}
                onValueChange={handleSortChange}
              >
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuRadioItem
                    key={sortKey(opt.field, opt.dir)}
                    value={sortKey(opt.field, opt.dir)}
                    className="gap-2"
                  >
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.value] ?? 0;
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value as Category | "all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {cat.value !== "all" && (
                  <span>{CATEGORY_EMOJI[cat.value]}</span>
                )}
                {cat.label}
                <span
                  className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                    isActive ? "bg-background/20" : "bg-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-5xl opacity-30">
              {activeCategory !== "all" ? CATEGORY_EMOJI[activeCategory] : "📦"}
            </div>
            <p className="font-medium text-sm">
              {searchQuery
                ? `No products match "${searchQuery}"`
                : activeCategory !== "all"
                ? `No ${activeCategory} products yet`
                : "No products yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? "Try a different search term" : 'Click "Add Product" to get started'}
            </p>
            {!searchQuery && (
              <Button size="sm" variant="outline" onClick={openAddModal} className="mt-1">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredProducts.map((p) => p.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((p) => (
                  <SortableProductCard
                    key={p.id}
                    product={p}
                    onEdit={() => openEditModal(p)}
                    onDelete={() => setDeleteConfirmId(p.id)}
                    onToggleAvailability={(available) =>
                      setAvailability.mutate({ id: p.id, available })
                    }
                    isUpdatingAvailability={setAvailability.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* ─── Product Add/Edit Modal ───────────────────────────────────────────── */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct.id ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-5 gap-6 py-2">
            {/* Left: image preview */}
            <div className="col-span-2 flex flex-col gap-3">
              <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {editingProduct.img ? (
                  <img
                    src={editingProduct.img}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageOff className="h-10 w-10 opacity-30" />
                    <span className="text-xs opacity-50 text-center px-2">
                      Enter an image URL to preview
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Image URL</label>
                <Input
                  value={editingProduct.img}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, img: e.target.value }))}
                  placeholder="/manus-storage/product-xxx.jpg"
                  className="text-xs"
                />
              </div>
              {/* Badge preview */}
              {editingProduct.badge && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Badge preview:</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      BADGE_STYLES[editingProduct.badge] ?? "bg-muted"
                    }`}
                  >
                    {editingProduct.badge}
                  </span>
                </div>
              )}
            </div>

            {/* Right: form fields */}
            <div className="col-span-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Wagyu Ribeye MS7+"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cut / Spec</label>
                  <Input
                    value={editingProduct.cut}
                    onChange={(e) => setEditingProduct((p) => ({ ...p, cut: e.target.value }))}
                    placeholder="e.g. 300g avg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Category *</label>
                  <Select
                    value={editingProduct.category}
                    onValueChange={(v) =>
                      setEditingProduct((p) => ({ ...p, category: v as Category }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((cat) => cat.value !== "all").map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {CATEGORY_EMOJI[cat.value]} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      value={editingProduct.price}
                      onChange={(e) => setEditingProduct((p) => ({ ...p, price: e.target.value }))}
                      placeholder="42.00"
                      className="pl-6"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3 text-red-500 fill-current" />
                    PD Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      value={editingProduct.powerDropPrice}
                      onChange={(e) =>
                        setEditingProduct((p) => ({ ...p, powerDropPrice: e.target.value }))
                      }
                      placeholder="34.00"
                      className="pl-6"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Unit</label>
                  <Input
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct((p) => ({ ...p, unit: e.target.value }))}
                    placeholder="/ kg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Badge</label>
                  <Select
                    value={editingProduct.badge ?? "__none__"}
                    onValueChange={(v) =>
                      setEditingProduct((p) => ({
                        ...p,
                        badge: v === "__none__" ? null : (v as BadgeType),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="LIMITED">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                          LIMITED
                        </span>
                      </SelectItem>
                      <SelectItem value="POPULAR">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          POPULAR
                        </span>
                      </SelectItem>
                      <SelectItem value="NEW">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          NEW
                        </span>
                      </SelectItem>
                      <SelectItem value="SOLD OUT">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          SOLD OUT
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sort Order</label>
                  <Input
                    type="number"
                    value={editingProduct.sortOrder}
                    onChange={(e) =>
                      setEditingProduct((p) => ({
                        ...p,
                        sortOrder: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={2}
                  placeholder="Optional product description…"
                  className="resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={editingProduct.available}
                  onCheckedChange={(v) => setEditingProduct((p) => ({ ...p, available: v }))}
                />
                <label className="text-sm font-medium">Available for ordering</label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProductSubmit} disabled={upsertProduct.isPending}>
              {upsertProduct.isPending ? "Saving…" : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Modal ─────────────────────────────────────────────── */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this product? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteProductMutation.isPending}
              onClick={() => {
                if (deleteConfirmId !== null) {
                  deleteProductMutation.mutate(
                    { id: deleteConfirmId },
                    { onSuccess: () => setDeleteConfirmId(null) }
                  );
                }
              }}
            >
              {deleteProductMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
