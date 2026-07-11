/*
 * GROUPBUY Admin Dashboard
 * Products panel: card grid, category filter tabs, search, drag-to-reorder,
 * coloured badge chips, image preview, skeleton loading, missing-PD-price warning
 */
import { useState, useMemo, useCallback, useRef } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Tag,
  Download,
  Upload,
  FileText,
  BarChart3,
  Package,
  X,
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
import { useLocation, Link } from "wouter";
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
  | "m3atfr3ak"
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
  | "burger-sausages"
  | "bbq-packs"
  | "quick-meals"
  | "freezer"
  | "other";
type BadgeType = "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all",               label: "All" },
  { value: "limited-offer",     label: "Limited Offer" },
  { value: "featured-deals",    label: "Featured Deals" },
  { value: "m3atfr3ak",         label: "M3ATFR3AK" },
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
  { value: "burger-sausages",   label: "Burger & Sausages" },
  { value: "bbq-packs",         label: "BBQ Packs" },
  { value: "quick-meals",       label: "Quick Meals" },
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
  "limited-offer":     "🔥",
  "featured-deals":    "⭐",
  "m3atfr3ak":         "🥩🔥",
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
  "burger-sausages":   "🍔",
  "bbq-packs":         "🔥",
  "quick-meals":        "⏱️",
  freezer:             "🧊",
  other:               "🛒",
};

type VisibilityMode = "regular_only" | "always" | "power_drop_only";

interface ProductForm {
  id?: number;
  name: string;
  cut: string;
  category: string;
  description: string;
  price: string;
  powerDropPrice: string;
  retailPrice: string;
  unit: string;
  badge: BadgeType;
  available: boolean;
  img: string;
  sortOrder: number;
  stockLimit: string;
  visibility: VisibilityMode;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  cut: "",
  category: "",
  description: "",
  price: "",
  powerDropPrice: "",
  retailPrice: "",
  unit: "/ kg",
  badge: null,
  available: true,
  img: "",
  sortOrder: 0,
  stockLimit: "",
  visibility: "regular_only",
};

// ─── Admin Guard ──────────────────────────────────────────────────────────────


// ─── Category Row (sortable) ────────────────────────────────────────────────

// ─── SectionRow — sortable section row in Manage Categories dialog ───────────

interface SectionRowProps {
  section: { id: number; name: string };
  isEditing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (v: string) => void;
  onDelete: () => void;
  isSaving: boolean;
}

function SectionRow({
  section,
  isEditing,
  editName,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNameChange,
  onDelete,
  isSaving,
}: SectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `section-${section.id}` });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>
      {isEditing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            placeholder="Section name"
            className="flex-1 h-7 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter" && editName.trim()) onSaveEdit(); if (e.key === "Escape") onCancelEdit(); }}
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={onSaveEdit} disabled={!editName.trim() || isSaving}>Save</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onCancelEdit}>Cancel</Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.name}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onStartEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete section (categories become ungrouped)"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
}

interface CategoryRowProps {
  cat: { id: number; slug: string; name: string; emoji?: string | null; powerDropName?: string | null; sectionId?: number | null; visibility: "regular_only" | "always" | "power_drop_only" };
  isEditing: boolean;
  editName: string;
  editEmoji: string;
  editPdName: string;
  productCount: number;
  sections: { id: number; name: string }[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (v: string) => void;
  onEditEmojiChange: (v: string) => void;
  onEditPdNameChange: (v: string) => void;
  onSetSection: (sectionId: number | null) => void;
  onSetVisibility: (v: "regular_only" | "always" | "power_drop_only") => void;
  onDelete: () => void;
  isSaving: boolean;
}

function CategoryRow({
  cat,
  isEditing,
  editName,
  editEmoji,
  editPdName,
  productCount,
  sections,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNameChange,
  onEditEmojiChange,
  onEditPdNameChange,
  onSetSection,
  onSetVisibility,
  onDelete,
  isSaving,
}: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border bg-card">
      {isEditing ? (
        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            <Input value={editEmoji} onChange={(e) => onEditEmojiChange(e.target.value)} placeholder="📦" className="w-14 text-center shrink-0" maxLength={4} />
            <Input value={editName} onChange={(e) => onEditNameChange(e.target.value)} placeholder="Name" className="flex-1" />
          </div>
          <Input value={editPdName} onChange={(e) => onEditPdNameChange(e.target.value)} placeholder="Power Drop name (optional, e.g. PD Beef)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSaveEdit} disabled={!editName.trim() || isSaving}>Save</Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        /* Grid: drag | emoji+name | visibility | section | count | actions */
        <div className="grid items-center gap-x-2 px-2 py-1.5" style={{ gridTemplateColumns: "16px minmax(0,1fr) 90px 100px 56px 56px" }}>
          {/* Drag handle */}
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
          {/* Emoji + name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0">{cat.emoji ?? "📦"}</span>
            <span
              className="text-sm font-medium truncate"
              title={cat.name + (cat.powerDropName ? ` · PD: ${cat.powerDropName}` : "")}
            >
              {cat.name}
            </span>
          </div>
          {/* Visibility dropdown */}
          <Select
            value={cat.visibility}
            onValueChange={(v) => onSetVisibility(v as "regular_only" | "always" | "power_drop_only")}
          >
            <SelectTrigger className={`h-6 text-xs w-full ${VISIBILITY_COLORS[cat.visibility]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always"><span className="text-green-600">Always</span></SelectItem>
              <SelectItem value="regular_only"><span className="text-slate-500">Regular</span></SelectItem>
              <SelectItem value="power_drop_only"><span className="text-red-600">PD Only</span></SelectItem>
            </SelectContent>
          </Select>
          {/* Section dropdown */}
          <Select
            value={cat.sectionId ? String(cat.sectionId) : "none"}
            onValueChange={(v) => onSetSection(v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="h-6 text-xs w-full">
              <SelectValue placeholder="No section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No section</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Product count */}
          <span className="text-xs text-muted-foreground text-right tabular-nums whitespace-nowrap">{productCount} prods</span>
          {/* Edit / delete */}
          <div className="flex gap-0.5 justify-end">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onStartEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={productCount > 0}
              title={productCount > 0 ? `${productCount} products assigned` : "Delete category"}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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
    visibility?: "regular_only" | "always" | "power_drop_only" | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: (available: boolean) => void;
  isUpdatingAvailability: boolean;
  onSetVisibility: (v: "regular_only" | "always" | "power_drop_only") => void;
  isUpdatingVisibility: boolean;
  // Category display (resolved from live DB)
  categoryEmoji?: string;
  categoryName?: string;
  // Selection mode
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const VISIBILITY_LABELS: Record<string, string> = {
  regular_only: "Regular",
  always: "Always",
  power_drop_only: "PD Only",
};

const VISIBILITY_COLORS: Record<string, string> = {
  regular_only: "text-slate-500",
  always: "text-green-600",
  power_drop_only: "text-red-600",
};

function SortableProductCard({
  product,
  onEdit,
  onDelete,
  onToggleAvailability,
  isUpdatingAvailability,
  onSetVisibility,
  isUpdatingVisibility,
  categoryEmoji,
  categoryName,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: ProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id, disabled: selectMode });

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
      onClick={selectMode ? onToggleSelect : undefined}
      className={`group relative rounded-xl border bg-card flex flex-col overflow-hidden transition-shadow ${
        selectMode ? "cursor-pointer" : "hover:shadow-md"
      } ${
        selected ? "ring-2 ring-red-500 border-red-500" : ""
      } ${
        !product.available && !selectMode ? "opacity-60" : ""
      }`}
    >
      {/* Selection checkbox (select mode only) */}
      {selectMode && (
        <div className="absolute top-2 left-2 z-20">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 accent-red-500 cursor-pointer"
          />
        </div>
      )}

      {/* Drag handle (hidden in select mode) */}
      {!selectMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

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

        {/* Category emoji pill — resolved at call site via categoryMap prop */}
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium capitalize flex items-center gap-1">
          <span>{categoryEmoji ?? "📦"}</span>
          <span>{categoryName ?? product.category}</span>
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

        {/* Visibility chip */}
        {product.visibility && product.visibility !== "regular_only" && (
          <div className="flex">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                product.visibility === "power_drop_only"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : "bg-green-100 text-green-700 border-green-200"
              }`}
            >
              {product.visibility === "power_drop_only" ? (
                <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5 fill-current" /> PD Only</span>
              ) : (
                "Always Visible"
              )}
            </span>
          </div>
        )}

        {/* Footer: availability + actions */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50 mt-auto">
          {/* Row 1: availability toggle + edit/delete */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Switch
                checked={product.available}
                disabled={isUpdatingAvailability || selectMode}
                onCheckedChange={selectMode ? undefined : onToggleAvailability}
                className="scale-75 origin-left"
              />
              <span className="text-xs text-muted-foreground">
                {product.available ? "Available" : "Unavailable"}
              </span>
            </div>
            {!selectMode && (
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          {/* Row 2: quick visibility control */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isUpdatingVisibility || selectMode}
                className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors w-full ${
                  VISIBILITY_COLORS[product.visibility ?? "regular_only"]
                } ${isUpdatingVisibility ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Zap className="h-3 w-3 shrink-0" />
                <span>Visibility: {VISIBILITY_LABELS[product.visibility ?? "regular_only"]}</span>
                <ArrowUpDown className="h-2.5 w-2.5 ml-auto shrink-0 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">Power Drop Visibility</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={product.visibility ?? "regular_only"}
                onValueChange={(v) =>
                  onSetVisibility(v as "regular_only" | "always" | "power_drop_only")
                }
              >
                <DropdownMenuRadioItem value="regular_only">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                    Regular only
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="always">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Always visible
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="power_drop_only">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Power Drop only
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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

  // ─── Categories ─────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: categoriesLoading } = trpc.categories.list.useQuery();
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("");
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatEmoji, setEditCatEmoji] = useState("");
  const [editCatPdName, setEditCatPdName] = useState("");
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);

  const createCategory = trpc.admin.categories.create.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setNewCatName(""); setNewCatEmoji(""); },
    onError: (err) => toast.error(err.message),
  });
  const updateCategory = trpc.admin.categories.update.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setEditCatId(null); },
    onError: (err) => toast.error(err.message),
  });
  const reorderCategories = trpc.admin.categories.reorder.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const deleteCategory = trpc.admin.categories.delete.useMutation({
    onSuccess: () => { utils.categories.list.invalidate(); setDeleteCatId(null); toast.success("Category deleted"); },
    onError: (err) => { toast.error(err.message); setDeleteCatId(null); },
  });
  const setCategorySection = trpc.admin.categories.update.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const setCategoryVisibility = trpc.admin.categories.update.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // ─── Sections ────────────────────────────────────────────────────────────────
  const { data: sections = [] } = trpc.sections.list.useQuery();
  const [newSectionName, setNewSectionName] = useState("");
  const [editSectionId, setEditSectionId] = useState<number | null>(null);
  const [editSectionName, setEditSectionName] = useState("");
  const [deleteSectionId, setDeleteSectionId] = useState<number | null>(null);

  const createSection = trpc.admin.sections.create.useMutation({
    onSuccess: () => { utils.sections.list.invalidate(); setNewSectionName(""); },
    onError: (err) => toast.error(err.message),
  });
  const renameSection = trpc.admin.sections.rename.useMutation({
    onSuccess: () => { utils.sections.list.invalidate(); setEditSectionId(null); },
    onError: (err: { message: string }) => toast.error(err.message),
  });
  const reorderSections = trpc.admin.sections.reorder.useMutation({
    onSuccess: () => utils.sections.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });
  const deleteSection = trpc.admin.sections.delete.useMutation({
    onSuccess: () => { utils.sections.list.invalidate(); utils.categories.list.invalidate(); setDeleteSectionId(null); toast.success("Section deleted — categories unassigned"); },
    onError: (err) => { toast.error(err.message); setDeleteSectionId(null); },
  });

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

  // Quick visibility change from product card (uses upsert with full product data)
  const setVisibilityMutation = trpc.admin.products.upsert.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // Power Drop zero-product confirmation dialog state
  const [powerDropConfirmOpen, setPowerDropConfirmOpen] = useState(false);

  // ─── Bulk-select mode ────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{
    action: "available" | "unavailable" | "visibility" | "stockLimit";
    visibility?: "regular_only" | "always" | "power_drop_only";
    stockLimit?: string | null; // string value or null to clear
  } | null>(null);
  const [bulkStockLimitInput, setBulkStockLimitInput] = useState("");

  const bulkUpdate = trpc.admin.products.bulkUpdate.useMutation({
    onSuccess: (data) => {
      utils.products.list.invalidate();
      toast.success(`Updated ${data.updated} product${data.updated !== 1 ? "s" : ""}`);
      setBulkConfirm(null);
      // Keep selection mode on but clear selection after apply
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleOneProduct = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyBulkAction = () => {
    if (!bulkConfirm || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (bulkConfirm.action === "available") {
      bulkUpdate.mutate({ ids, set: { available: true } });
    } else if (bulkConfirm.action === "unavailable") {
      bulkUpdate.mutate({ ids, set: { available: false } });
    } else if (bulkConfirm.action === "visibility" && bulkConfirm.visibility) {
      bulkUpdate.mutate({ ids, set: { visibility: bulkConfirm.visibility } });
    } else if (bulkConfirm.action === "stockLimit") {
      // null clears the limit; a string sets it
      bulkUpdate.mutate({ ids, set: { stockLimit: bulkConfirm.stockLimit ?? null } });
    }
  };

  // Batch reorder — save new sortOrder values after drag
  const batchReorder = trpc.admin.products.batchReorder.useMutation({
    onSuccess: () => utils.products.list.invalidate(),
    onError: (err) => {
      toast.error("Failed to save order: " + err.message);
      setLocalOrder(null);
    },
  });

  // ─── Filter & sort state ─────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string>("all");
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

  // Category counts (keyed by slug)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products?.length ?? 0 };
    for (const p of products ?? []) {
      const slug = p.category;
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
    return counts;
  }, [products]);

  // Derived selection state (depends on filteredProducts)
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));
  const someFilteredSelected = filteredProducts.some((p) => selectedIds.has(p.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  // ─── Product modal state ─────────────────────────────────────────────────────
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Stock Manager dialog state ────────────────────────────────────────────
  const [stockManagerOpen, setStockManagerOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [addLimitProductId, setAddLimitProductId] = useState<number | null>(null);
  const [addLimitValue, setAddLimitValue] = useState("");
  const [editingStockLimits, setEditingStockLimits] = useState<Record<number, string>>({});

  const { data: activeDrop } = trpc.admin.drops.getActive.useQuery(undefined, { staleTime: 30_000 });

  const setStockLimitMutation = trpc.admin.products.upsert.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Stock limit updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const saveStockLimit = (productId: number, limitStr: string) => {
    const p = (products ?? []).find((x) => x.id === productId);
    if (!p) return;
    setStockLimitMutation.mutate({
      id: p.id,
      name: p.name,
      cut: p.cut,
      category: p.category,
      description: p.description ?? undefined,
      price: p.price,
      powerDropPrice: p.powerDropPrice ?? undefined,
      retailPrice: (p as { retailPrice?: string | null }).retailPrice ?? undefined,
      unit: p.unit,
      badge: (p.badge as BadgeType) ?? null,
      available: p.available,
      img: p.img ?? undefined,
      sortOrder: p.sortOrder,
      stockLimit: limitStr === "" ? undefined : limitStr,
      visibility: p.visibility as VisibilityMode,
    });
    setEditingStockLimits((prev) => { const next = { ...prev }; delete next[productId]; return next; });
    setAddLimitProductId(null);
    setAddLimitValue("");
  };

  // ─── CSV import dialog state ─────────────────────────────────────────────────
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    updates: number;
    creates: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const csvImportInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation before upload
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed (JPG, PNG, WEBP, etc.)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/product-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        throw new Error(body.error ?? "Upload failed");
      }
      const { url } = await res.json() as { url: string };
      setEditingProduct((p) => ({ ...p, img: url }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        category: p.category,
        description: p.description ?? "",
        price: p.price,
        powerDropPrice: p.powerDropPrice ?? "",
        retailPrice: (p as { retailPrice?: string | null }).retailPrice ?? "",
        unit: p.unit,
        badge: p.badge as BadgeType,
        available: p.available,
        img: p.img ?? "",
        sortOrder: p.sortOrder,
        stockLimit: (p as { stockLimit?: string | null }).stockLimit ?? "",
        visibility: ((p as { visibility?: VisibilityMode }).visibility) ?? "regular_only",
      });
      setProductModalOpen(true);
    },
    []
  );

  // ─── CSV export / import handlers ─────────────────────────────────────────
  const handleExportCsv = () => {
    const a = document.createElement("a");
    a.href = "/api/admin/products/export";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/products/import?dryRun=true", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json() as { updates: number; creates: number; errors: Array<{ row: number; message: string }> };
      setImportPreview(data);
    } catch {
      toast.error("Failed to read CSV file");
    } finally {
      setImportLoading(false);
      if (csvImportInputRef.current) csvImportInputRef.current.value = "";
    }
  };

  const handleApplyImport = async () => {
    if (!importFile) return;
    setImportApplying(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json() as { updates: number; creates: number; errors: Array<{ row: number; message: string }> };
      if (data.errors.length > 0) {
        setImportPreview(data);
        toast.error("Import failed — see errors below");
      } else {
        toast.success(`Import complete — ${data.updates} updated, ${data.creates} created`);
        setImportDialogOpen(false);
        setImportFile(null);
        setImportPreview(null);
        utils.products.list.invalidate();
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImportApplying(false);
    }
  };

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
      retailPrice: editingProduct.retailPrice || undefined,
      unit: editingProduct.unit,
      badge: editingProduct.badge,
      available: editingProduct.available,
      img: editingProduct.img || undefined,
      sortOrder: editingProduct.sortOrder,
      stockLimit: editingProduct.stockLimit || undefined,
      visibility: editingProduct.visibility,
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Power Drop events, announcements, and products.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <span>📦</span>
              Order Management
            </Button>
          </Link>
          <Link href="/admin/drops">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <span>📊</span>
              Drops & Analytics
            </Button>
          </Link>
          <Link href="/admin/customers">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <span>👥</span>
              Customers
            </Button>
          </Link>
        </div>
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
              {/* Live count of products that will appear during a Power Drop */}
              {(() => {
                const pdCount = (products ?? []).filter(
                  (p) => (p as { visibility?: string }).visibility !== "regular_only"
                ).length;
                return (
                  <p className={`text-xs mt-1 font-medium ${
                    pdCount === 0 ? "text-amber-600" : "text-muted-foreground"
                  }`}>
                    {pdCount === 0
                      ? "⚠ No products are set to appear during a Power Drop"
                      : `${pdCount} product${pdCount !== 1 ? "s" : ""} will appear during a Power Drop`}
                  </p>
                );
              })()}
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
            disabled={settingsLoading || setSetting.isPending || setMultipleSettings.isPending}
            onCheckedChange={(checked) => {
              if (!checked) {
                // Turning OFF — no confirmation needed
                const now = new Date().toISOString();
                setMultipleSettings.mutate(
                  [
                    { key: "powerDropActive", value: "false" },
                    { key: "powerDropActivatedAt", value: now },
                  ],
                  { onSuccess: () => toast.success("Power Drop ended") }
                );
                return;
              }
              // Turning ON — check if any PD-visible products exist
              const pdCount = (products ?? []).filter(
                (p) => (p as { visibility?: string }).visibility !== "regular_only"
              ).length;
              if (pdCount === 0) {
                // Show confirmation dialog
                setPowerDropConfirmOpen(true);
              } else {
                const now = new Date().toISOString();
                setMultipleSettings.mutate(
                  [
                    { key: "powerDropActive", value: "true" },
                    { key: "powerDropActivatedAt", value: now },
                  ],
                  { onSuccess: () => toast.success("⚡ Power Drop is now LIVE") }
                );
              }
            }}
          />
        </div>
      </section>

      {/* ─── Power Drop zero-product confirmation dialog ─────────────────────── */}
      <AlertDialog open={powerDropConfirmOpen} onOpenChange={setPowerDropConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No products flagged for this Power Drop</AlertDialogTitle>
            <AlertDialogDescription>
              No products are set to appear during a Power Drop — the store will show an empty drop
              menu to customers. Turn on anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const now = new Date().toISOString();
                setMultipleSettings.mutate(
                  [
                    { key: "powerDropActive", value: "true" },
                    { key: "powerDropActivatedAt", value: now },
                  ],
                  { onSuccess: () => toast.success("⚡ Power Drop is now LIVE") }
                );
                setPowerDropConfirmOpen(false);
              }}
            >
              Turn On
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={selectMode ? "default" : "outline"}
              onClick={toggleSelectMode}
              className={selectMode ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            >
              <Check className="h-4 w-4 mr-1.5" />
              {selectMode ? "Exit Select" : "Select"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setImportFile(null);
                setImportPreview(null);
                setImportDialogOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => setManageCatsOpen(true)}>
              <Tag className="h-4 w-4 mr-1.5" />
              Categories
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStockManagerOpen(true)}>
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Stock
            </Button>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Button>
          </div>
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
          {/* All tab */}
          {([{ slug: "all", name: "All", emoji: null as string | null }] as { slug: string; name: string; emoji: string | null }[]).concat(
            categories.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji }))
          ).map((cat) => {
            const count = categoryCounts[cat.slug] ?? 0;
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {cat.slug !== "all" && cat.emoji && (
                  <span>{cat.emoji}</span>
                )}
                {cat.name}
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

        {/* Select-all row (visible in select mode when there are products) */}
        {selectMode && filteredProducts.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                onChange={toggleSelectAllFiltered}
                className="w-4 h-4 accent-red-500 cursor-pointer"
              />
              <span className="font-medium">
                {allFilteredSelected ? "Deselect all" : `Select all ${filteredProducts.length}`}
              </span>
            </label>
            {selectedIds.size > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            )}
          </div>
        )}

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
              {activeCategory !== "all"
                ? (categories.find((c) => c.slug === activeCategory)?.emoji ?? "📦")
                : "📦"}
            </div>
            <p className="font-medium text-sm">
              {searchQuery
                ? `No products match "${searchQuery}"`
                : activeCategory !== "all"
                ? `No ${categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory} products yet`
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
                {filteredProducts.map((p) => {
                  const catEntry = categories.find((c) => c.slug === p.category);
                  return (
                  <SortableProductCard
                    key={p.id}
                    product={p}
                    categoryEmoji={catEntry?.emoji ?? undefined}
                    categoryName={catEntry?.name ?? undefined}
                    onEdit={() => openEditModal(p)}
                    onDelete={() => setDeleteConfirmId(p.id)}
                    onToggleAvailability={(available) =>
                      setAvailability.mutate({ id: p.id, available })
                    }
                    isUpdatingAvailability={setAvailability.isPending}
                    onSetVisibility={(visibility) =>
                      setVisibilityMutation.mutate({
                        id: p.id,
                        name: p.name,
                        cut: p.cut,
                        category: p.category as Parameters<typeof setVisibilityMutation.mutate>[0]["category"],
                        price: p.price,
                        powerDropPrice: p.powerDropPrice ?? undefined,
                        retailPrice: (p as { retailPrice?: string | null }).retailPrice ?? undefined,
                        unit: p.unit,
                        badge: p.badge as Parameters<typeof setVisibilityMutation.mutate>[0]["badge"],
                        available: p.available,
                        img: p.img ?? undefined,
                        sortOrder: p.sortOrder,
                        stockLimit: (p as { stockLimit?: string | null }).stockLimit ?? undefined,
                        description: p.description ?? undefined,
                        visibility,
                      })
                    }
                    isUpdatingVisibility={setVisibilityMutation.isPending}
                    selectMode={selectMode}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={() => toggleOneProduct(p.id)}
                  />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* ─── Floating Bulk Action Bar ──────────────────────────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border shadow-xl rounded-full px-4 py-2.5 text-sm">
          <span className="font-semibold text-foreground mr-1">
            {selectedIds.size} selected
          </span>

          {/* Set Visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-full gap-1.5" disabled={bulkUpdate.isPending}>
                <Zap className="h-3.5 w-3.5" />
                Set Visibility
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel className="text-xs">Set visibility for {selectedIds.size} products</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value="">
                <DropdownMenuRadioItem value="regular_only" onSelect={() => setBulkConfirm({ action: "visibility", visibility: "regular_only" })}>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />Regular only</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="always" onSelect={() => setBulkConfirm({ action: "visibility", visibility: "always" })}>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Always visible</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="power_drop_only" onSelect={() => setBulkConfirm({ action: "visibility", visibility: "power_drop_only" })}>
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Power Drop only</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5"
            disabled={bulkUpdate.isPending}
            onClick={() => { setBulkStockLimitInput(""); setBulkConfirm({ action: "stockLimit", stockLimit: undefined }); }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Set Stock Limit
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5"
            disabled={bulkUpdate.isPending}
            onClick={() => setBulkConfirm({ action: "available" })}
          >
            Set Available
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="rounded-full gap-1.5"
            disabled={bulkUpdate.isPending}
            onClick={() => setBulkConfirm({ action: "unavailable" })}
          >
            Set Unavailable
          </Button>

          <button
            className="ml-1 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
            onClick={() => setSelectedIds(new Set())}
            title="Clear selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Bulk Action Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!bulkConfirm} onOpenChange={(open) => { if (!open) setBulkConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkConfirm?.action === "available" && `Mark ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} as Available?`}
              {bulkConfirm?.action === "unavailable" && `Mark ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} as Unavailable?`}
              {bulkConfirm?.action === "visibility" && `Set visibility for ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}?`}
              {bulkConfirm?.action === "stockLimit" && `Set stock limit for ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkConfirm?.action === "available" && `This will make ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} available to customers immediately.`}
              {bulkConfirm?.action === "unavailable" && `This will hide ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} from customers immediately.`}
              {bulkConfirm?.action === "visibility" && `This will set the Power Drop visibility to "${
                bulkConfirm.visibility === "regular_only" ? "Regular only" :
                bulkConfirm.visibility === "always" ? "Always visible" : "Power Drop only"
              }" for ${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""}.`}
              {bulkConfirm?.action === "stockLimit" && (
                <div className="space-y-3 mt-2">
                  <p>Enter a stock limit to apply to all {selectedIds.size} selected product{selectedIds.size !== 1 ? "s" : ""}, or leave blank to clear their limits.</p>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 50 — leave blank to clear"
                    value={bulkStockLimitInput}
                    onChange={(e) => {
                      setBulkStockLimitInput(e.target.value);
                      setBulkConfirm((prev) => prev ? { ...prev, stockLimit: e.target.value === "" ? null : e.target.value } : prev);
                    }}
                    autoFocus
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={applyBulkAction}
              disabled={bulkUpdate.isPending}
              className={bulkConfirm?.action === "unavailable" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {bulkUpdate.isPending ? "Applying…" : "Apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── CSV Import Dialog ─────────────────────────────────────────────── */}
      {/* Hidden file input for CSV import */}
      <input
        ref={csvImportInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFileSelect}
      />

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportFile(null);
            setImportPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Products from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file exported from this panel. Rows with an id update existing products;
              rows with a blank id create new ones. Products not in the file are left untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File picker */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => csvImportInputRef.current?.click()}
                disabled={importLoading || importApplying}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {importFile ? "Change File" : "Choose CSV File"}
              </Button>
              {importFile && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {importFile.name}
                </span>
              )}
              {importLoading && (
                <span className="text-sm text-muted-foreground animate-pulse">Validating…</span>
              )}
            </div>

            {/* Dry-run preview */}
            {importPreview && !importLoading && (
              <div className="space-y-3">
                {importPreview.errors.length === 0 ? (
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm">
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">Ready to import</p>
                    <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {importPreview.updates} product{importPreview.updates !== 1 ? "s" : ""} will be
                      updated, {importPreview.creates} will be created.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm space-y-1">
                    <p className="font-medium text-red-800 dark:text-red-300">
                      {importPreview.errors.length} row error{importPreview.errors.length !== 1 ? "s" : ""} — fix and re-upload
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                      {importPreview.errors.map((e) => (
                        <p key={e.row} className="text-red-700 dark:text-red-400">
                          <span className="font-mono">Row {e.row}:</span> {e.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
                setImportPreview(null);
              }}
              disabled={importApplying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyImport}
              disabled={
                !importFile ||
                !importPreview ||
                importPreview.errors.length > 0 ||
                importLoading ||
                importApplying
              }
            >
              {importApplying ? "Applying…" : "Apply Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Manage Categories Dialog ───────────────────────────────────────── */}
      <Dialog open={manageCatsOpen} onOpenChange={(open) => { setManageCatsOpen(open); if (!open) setCatSearch(""); }}>
        {/* Wide dialog: 90vw up to 1100px, 85vh tall, flex-column so header is fixed and body scrolls */}
        <DialogContent className="w-[90vw] max-w-[1100px] h-[85vh] max-h-[85vh] sm:h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Fixed header */}
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogHeader>
              <DialogTitle>Manage Categories &amp; Sections</DialogTitle>
              <DialogDescription>
                Create sections to group categories in the storefront sidebar. Assign each category to a section using the dropdown. Drag to reorder.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable body — two panels on desktop, stacked on mobile */}
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

            {/* ── LEFT PANEL: Sections (~1/3) ── */}
            <div className="sm:w-[34%] shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r overflow-hidden">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</p>
              </div>
              {/* Scrollable section list */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    const activeId = Number(String(active.id).replace("section-", ""));
                    const overId = Number(String(over.id).replace("section-", ""));
                    const oldIdx = sections.findIndex((s) => s.id === activeId);
                    const newIdx = sections.findIndex((s) => s.id === overId);
                    const reordered = arrayMove(sections, oldIdx, newIdx);
                    reorderSections.mutate({ orderedIds: reordered.map((s) => s.id) });
                  }}
                >
                  <SortableContext items={sections.map((s) => `section-${s.id}`)} strategy={rectSortingStrategy}>
                    <div className="space-y-1">
                      {sections.map((sec) => (
                        <SectionRow
                          key={sec.id}
                          section={sec}
                          isEditing={editSectionId === sec.id}
                          editName={editSectionName}
                          onStartEdit={() => { setEditSectionId(sec.id); setEditSectionName(sec.name); }}
                          onCancelEdit={() => setEditSectionId(null)}
                          onSaveEdit={() => renameSection.mutate({ id: sec.id, name: editSectionName.trim() })}
                          onEditNameChange={setEditSectionName}
                          onDelete={() => setDeleteSectionId(sec.id)}
                          isSaving={renameSection.isPending}
                        />
                      ))}
                      {sections.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">No sections yet. Add one below.</p>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              {/* Add new section — pinned at bottom of left panel */}
              <div className="px-4 py-3 border-t shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="New section name"
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && newSectionName.trim()) createSection.mutate({ name: newSectionName.trim() }); }}
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={!newSectionName.trim() || createSection.isPending}
                    onClick={() => createSection.mutate({ name: newSectionName.trim() })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL: Categories (~2/3) ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-2 shrink-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</p>
                {/* Category search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Filter categories…"
                    className="h-8 pl-7 text-sm"
                  />
                </div>
              </div>
              {/* Scrollable category list */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                {categoriesLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) return;
                      const oldIdx = categories.findIndex((c) => c.id === active.id);
                      const newIdx = categories.findIndex((c) => c.id === over.id);
                      const reordered = arrayMove(categories, oldIdx, newIdx);
                      reorderCategories.mutate({ orderedIds: reordered.map((c) => c.id) });
                    }}
                  >
                    <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
                      <div className="space-y-1">
                        {categories
                          .filter((cat) => !catSearch || cat.name.toLowerCase().includes(catSearch.toLowerCase()))
                          .map((cat) => (
                            <CategoryRow
                              key={cat.id}
                              cat={cat}
                              isEditing={editCatId === cat.id}
                              editName={editCatName}
                              editEmoji={editCatEmoji}
                              editPdName={editCatPdName}
                              productCount={categoryCounts[cat.slug] ?? 0}
                              sections={sections}
                              onStartEdit={() => {
                                setEditCatId(cat.id);
                                setEditCatName(cat.name);
                                setEditCatEmoji(cat.emoji ?? "");
                                setEditCatPdName(cat.powerDropName ?? "");
                              }}
                              onCancelEdit={() => setEditCatId(null)}
                              onSaveEdit={() => updateCategory.mutate({ id: cat.id, name: editCatName, emoji: editCatEmoji || undefined, powerDropName: editCatPdName || undefined })}
                              onEditNameChange={setEditCatName}
                              onEditEmojiChange={setEditCatEmoji}
                              onEditPdNameChange={setEditCatPdName}
                              onSetSection={(sectionId) => setCategorySection.mutate({ id: cat.id, name: cat.name, sectionId })}
                              onSetVisibility={(visibility) => setCategoryVisibility.mutate({ id: cat.id, name: cat.name, visibility })}
                              onDelete={() => setDeleteCatId(cat.id)}
                              isSaving={updateCategory.isPending}
                            />
                          ))}
                        {catSearch && categories.filter((cat) => cat.name.toLowerCase().includes(catSearch.toLowerCase())).length === 0 && (
                          <p className="text-xs text-muted-foreground py-3 text-center">No categories match "{catSearch}"</p>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
              {/* Add new category — pinned at bottom of right panel */}
              <div className="px-4 py-3 border-t shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-2">Add new category</p>
                <div className="flex gap-2">
                  <Input
                    value={newCatEmoji}
                    onChange={(e) => setNewCatEmoji(e.target.value)}
                    placeholder="📦"
                    className="w-14 text-center shrink-0"
                    maxLength={4}
                  />
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 min-w-0"
                    onKeyDown={(e) => { if (e.key === "Enter" && newCatName.trim()) createCategory.mutate({ name: newCatName.trim(), emoji: newCatEmoji || undefined }); }}
                  />
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={!newCatName.trim() || createCategory.isPending}
                    onClick={() => createCategory.mutate({ name: newCatName.trim(), emoji: newCatEmoji || undefined })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Delete category confirmation */}
      <AlertDialog open={deleteCatId !== null} onOpenChange={(open) => { if (!open) setDeleteCatId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCatId !== null && (() => {
                const cat = categories.find((c) => c.id === deleteCatId);
                const count = categoryCounts[cat?.slug ?? ""] ?? 0;
                if (count > 0) return `Cannot delete “${cat?.name}” — ${count} product${count !== 1 ? "s are" : " is"} assigned to it. Reassign those products first.`;
                return `Delete “${cat?.name}”? This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteCatId !== null && (categoryCounts[categories.find((c) => c.id === deleteCatId)?.slug ?? ""] ?? 0) === 0 && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteCatId !== null && deleteCategory.mutate({ id: deleteCatId })}
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete section confirmation */}
      <AlertDialog open={deleteSectionId !== null} onOpenChange={(open) => { if (!open) setDeleteSectionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSectionId !== null && (() => {
                const sec = sections.find((s) => s.id === deleteSectionId);
                const assignedCount = categories.filter((c) => c.sectionId === deleteSectionId).length;
                return `Delete "${sec?.name}"? The ${assignedCount} categor${assignedCount !== 1 ? "ies" : "y"} assigned to it will become ungrouped. This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSectionId !== null && deleteSection.mutate({ id: deleteSectionId })}
              disabled={deleteSection.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <label className="text-sm font-medium">Product Image</label>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading…" : "📷 Upload Photo"}
                  </Button>
                  <Input
                    value={editingProduct.img}
                    onChange={(e) => setEditingProduct((p) => ({ ...p, img: e.target.value }))}
                    placeholder="or paste image URL"
                    className="text-xs"
                  />
                </div>
                {isUploading && (
                  <p className="text-xs text-muted-foreground animate-pulse">Uploading image…</p>
                )}
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
                      setEditingProduct((p) => ({ ...p, category: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.emoji} {cat.name}
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
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    RRP / Retail
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      value={editingProduct.retailPrice}
                      onChange={(e) =>
                        setEditingProduct((p) => ({ ...p, retailPrice: e.target.value }))
                      }
                      placeholder="55.00"
                      className="pl-6"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
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

              {/* Stock Limit */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Stock Limit
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(optional — leave blank for unlimited)</span>
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="e.g. 50 for 50 kg or 50 units"
                  value={editingProduct.stockLimit}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, stockLimit: e.target.value }))
                  }
                />
{(() => {
                  // Use already-fetched products list — no hook call inside JSX
                  const editingId = (editingProduct as { id?: number }).id;
                  const existing = editingId
                    ? (products ?? []).find((p) => p.id === editingId)
                    : null;
                  const sl = existing ? (existing as { stockLimit?: string | null }).stockLimit : null;
                  if (!existing || sl == null) return null;
                  return (
                    <p className="text-xs text-muted-foreground">
                      Ordered: <strong>{((existing as { orderedQty?: number }).orderedQty ?? 0).toFixed(1)}</strong> ·
                      Remaining: <strong>{((existing as { remainingQty?: number | null }).remainingQty ?? 0).toFixed(1)}</strong>
                    </p>
                  );
                })()}
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

              {/* Visibility / Power Drop mode */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3 text-red-500" />
                  Power Drop Visibility
                </label>
                <Select
                  value={editingProduct.visibility}
                  onValueChange={(v) =>
                    setEditingProduct((p) => ({ ...p, visibility: v as VisibilityMode }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular_only">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                        Regular only (hidden during Power Drop)
                      </span>
                    </SelectItem>
                    <SelectItem value="always">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        Always visible
                      </span>
                    </SelectItem>
                    <SelectItem value="power_drop_only">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        Power Drop only (hidden outside Power Drop)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls when this product appears on the public site.
                </p>
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

      {/* ─── Stock Manager Dialog ───────────────────────────────────────────────────────────── */}
      <Dialog open={stockManagerOpen} onOpenChange={setStockManagerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Stock Manager
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />
              {activeDrop
                ? <>Counting orders from: <strong>{activeDrop.name}</strong></>
                : "No active drop — counting all active orders"}
            </DialogDescription>
          </DialogHeader>

          {/* Search row */}
          <div className="flex gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto mt-2">
            {(() => {
              const allProds = products ?? [];
              const withLimit = allProds
                .filter((p) => {
                  const sl = (p as { stockLimit?: string | null }).stockLimit;
                  return sl != null && sl !== "";
                })
                .map((p) => {
                  const sl = parseFloat((p as { stockLimit?: string | null }).stockLimit ?? "0");
                  const ordered = (p as { orderedQty?: number }).orderedQty ?? 0;
                  const remaining = Math.max(sl - ordered, 0);
                  const pct = sl > 0 ? Math.round((ordered / sl) * 100) : 0;
                  return { ...p, _sl: sl, _ordered: ordered, _remaining: remaining, _pct: pct };
                })
                .sort((a, b) => b._pct - a._pct);

              const withoutLimit = allProds.filter((p) => {
                const sl = (p as { stockLimit?: string | null }).stockLimit;
                return (sl == null || sl === "") &&
                  stockSearch.trim() !== "" &&
                  (p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                    p.cut.toLowerCase().includes(stockSearch.toLowerCase()));
              });

              const filteredWithLimit = stockSearch.trim()
                ? withLimit.filter((p) =>
                    p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                    p.cut.toLowerCase().includes(stockSearch.toLowerCase())
                  )
                : withLimit;

              return (
                <div className="space-y-1">
                  {filteredWithLimit.length === 0 && withoutLimit.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {stockSearch ? "No products match your search." : "No products have a stock limit set."}
                    </p>
                  )}

                  {filteredWithLimit.map((p) => {
                    const isEditing = editingStockLimits[p.id] !== undefined;
                    const editVal = editingStockLimits[p.id] ?? "";
                    const isKg = p.unit?.toLowerCase().includes("kg");
                    const decimals = isKg ? 1 : 0;
                    const rowClass = p._remaining <= 0
                      ? "border-red-500/40 bg-red-500/5"
                      : p._pct >= 80
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border";
                    return (
                      <div key={p.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${rowClass}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.cut}</p>
                        </div>
                        <div className="w-32 shrink-0">
                          <Progress value={p._pct} className={`h-1.5 ${p._remaining <= 0 ? "[&>div]:bg-red-500" : p._pct >= 80 ? "[&>div]:bg-amber-500" : ""}`} />
                          <p className="text-xs text-muted-foreground mt-0.5 text-right">{p._pct}% claimed</p>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <p className="text-xs text-muted-foreground">Ordered</p>
                          <p className="text-sm font-medium">{p._ordered.toFixed(decimals)}</p>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <p className="text-xs text-muted-foreground">Remaining</p>
                          <p className={`text-sm font-medium ${p._remaining <= 0 ? "text-red-500" : p._pct >= 80 ? "text-amber-500" : ""}`}>
                            {p._remaining.toFixed(decimals)}
                          </p>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={editVal}
                              onChange={(e) => setEditingStockLimits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="w-20 h-7 text-sm"
                              placeholder="Limit"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveStockLimit(p.id, editVal);
                                if (e.key === "Escape") setEditingStockLimits((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
                              }}
                            />
                            <Button size="sm" className="h-7 px-2" onClick={() => saveStockLimit(p.id, editVal)} disabled={setStockLimitMutation.isPending}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => setEditingStockLimits((prev) => { const next = { ...prev }; delete next[p.id]; return next; })}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-medium w-16 text-right">{p._sl.toFixed(decimals)}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setEditingStockLimits((prev) => ({ ...prev, [p.id]: String(p._sl) }))}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {withoutLimit.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground font-medium mb-1.5 px-1">Add limit to:</p>
                      {withoutLimit.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.cut}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">No limit</span>
                          {addLimitProductId === p.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={addLimitValue}
                                onChange={(e) => setAddLimitValue(e.target.value)}
                                className="w-20 h-7 text-sm"
                                placeholder="Limit"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveStockLimit(p.id, addLimitValue);
                                  if (e.key === "Escape") { setAddLimitProductId(null); setAddLimitValue(""); }
                                }}
                              />
                              <Button size="sm" className="h-7 px-2" onClick={() => saveStockLimit(p.id, addLimitValue)} disabled={setStockLimitMutation.isPending}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <button className="text-muted-foreground hover:text-foreground p-1" onClick={() => { setAddLimitProductId(null); setAddLimitValue(""); }}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0"
                              onClick={() => { setAddLimitProductId(p.id); setAddLimitValue(""); }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add limit
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStockManagerOpen(false)}>Close</Button>
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
