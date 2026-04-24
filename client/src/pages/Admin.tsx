/*
 * GROUPBUY Admin Dashboard
 * Design: DashboardLayout (sidebar + main), brand tokens for key actions
 * Sections:
 *   1. Power Drop toggle — live on/off with visual feedback
 *   2. Announcement banner editor — message text + active toggle
 *   3. Product management — table with add/edit/delete/availability
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Zap, Plus, Pencil, Trash2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "beef" | "pork" | "lamb" | "poultry" | "seafood" | "other";
type Badge = "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;

interface ProductForm {
  id?: number;
  name: string;
  cut: string;
  category: Category;
  description: string;
  price: string;
  powerDropPrice: string;
  unit: string;
  badge: Badge;
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
          <p className="text-sm text-muted-foreground mb-4">Please sign in to access the admin panel.</p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button>
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

  // ─── Product modal state ─────────────────────────────────────────────────────
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingProduct(EMPTY_FORM);
    setProductModalOpen(true);
  };

  const openEditModal = (p: typeof products extends (infer T)[] | undefined ? T : never) => {
    if (!p) return;
    setEditingProduct({
      id: p.id,
      name: p.name,
      cut: p.cut,
      category: p.category as Category,
      description: p.description ?? "",
      price: p.price,
      powerDropPrice: p.powerDropPrice ?? "",
      unit: p.unit,
      badge: p.badge as Badge,
      available: p.available,
      img: p.img ?? "",
      sortOrder: p.sortOrder,
    });
    setProductModalOpen(true);
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
      unit: editingProduct.unit,
      badge: editingProduct.badge,
      available: editingProduct.available,
      img: editingProduct.img || undefined,
      sortOrder: editingProduct.sortOrder,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
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
            <div className={`mt-0.5 p-2 rounded-md ${powerDropActive ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>
              <Zap className={`h-5 w-5 ${powerDropActive ? "fill-current" : ""}`} />
            </div>
            <div>
              <h2 className="font-semibold text-base">Power Drop Event</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                When active, all products show their Power Drop price and the site shows a live indicator.
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
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-base">Products</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {products?.length ?? 0} product{products?.length !== 1 ? "s" : ""} in the database
            </p>
          </div>
          <Button size="sm" onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        </div>

        {productsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading products…</div>
        ) : !products || products.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No products yet. Click "Add Product" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>PD Price</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.cut && (
                          <p className="text-xs text-muted-foreground">{p.cut}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{p.category}</TableCell>
                    <TableCell className="font-mono text-sm">${p.price}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {p.powerDropPrice ? (
                        <span className="text-red-600">${p.powerDropPrice}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.available}
                        onCheckedChange={(checked) => {
                          setAvailability.mutate({ id: p.id, available: checked });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditModal(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ─── Product Add/Edit Modal ───────────────────────────────────────────── */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct.id ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Wagyu Ribeye MS7+"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cut / Description</label>
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
                  onValueChange={(v) => setEditingProduct((p) => ({ ...p, category: v as Category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["beef", "pork", "lamb", "poultry", "seafood", "other"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Price * (e.g. 42.00)</label>
                <Input
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, price: e.target.value }))}
                  placeholder="42.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Power Drop Price</label>
                <Input
                  value={editingProduct.powerDropPrice}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, powerDropPrice: e.target.value }))}
                  placeholder="34.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Unit</label>
                <Input
                  value={editingProduct.unit}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="/ kg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Badge</label>
                <Select
                  value={editingProduct.badge ?? "__none__"}
                  onValueChange={(v) =>
                    setEditingProduct((p) => ({
                      ...p,
                      badge: v === "__none__" ? null : (v as Badge),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="LIMITED">LIMITED</SelectItem>
                    <SelectItem value="POPULAR">POPULAR</SelectItem>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="SOLD OUT">SOLD OUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Image URL</label>
                <Input
                  value={editingProduct.img}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, img: e.target.value }))}
                  placeholder="/manus-storage/product-xxx.jpg"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional product description…"
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sort Order</label>
                <Input
                  type="number"
                  value={editingProduct.sortOrder}
                  onChange={(e) =>
                    setEditingProduct((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={editingProduct.available}
                  onCheckedChange={(v) => setEditingProduct((p) => ({ ...p, available: v }))}
                />
                <label className="text-sm font-medium">Available</label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleProductSubmit}
              disabled={upsertProduct.isPending}
            >
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
