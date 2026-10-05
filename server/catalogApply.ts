import { eq, inArray } from "drizzle-orm";
import { categorySections, categories, products } from "../drizzle/schema";
import {
  validateAndPlan,
  type ApplyOperation,
  type CatalogSnapshot,
  type ParsedCatalogFile,
  type SectionReference,
} from "./catalogCsv";

export class CatalogApplyError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : "Catalog apply failed");
    this.name = "CatalogApplyError";
  }
}

export type CatalogApplyCounts = { creates: number; updates: number; deletes: number };
export type CatalogApplyReaders = {
  readSnapshot: (tx: unknown) => Promise<CatalogSnapshot>;
  readOrderedIds: (tx: unknown) => Promise<{ orderedProductIds: Set<number>; unreadableOrderCount: number }>;
};

type WriteExecutor = {
  insert: (table: unknown) => any;
  update: (table: unknown) => any;
  delete: (table: unknown) => any;
  select: (...fields: unknown[]) => any;
};

function fail(message: string): never {
  throw new Error(message);
}

function ensureNoUndefined(value: unknown, label: string): void {
  if (value === undefined) fail(`${label} must not be undefined`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => ensureNoUndefined(item, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => ensureNoUndefined(item, `${label}.${key}`));
  }
}

function validateOperations(operations: ApplyOperation[]): void {
  const knownKinds = new Set<ApplyOperation["kind"]>([
    "createSection", "updateSection", "deleteSection", "createCategory", "updateCategory",
    "deleteCategory", "createProduct", "updateProduct", "deleteProduct",
  ]);
  const createdSections = new Set(operations.filter((operation) => operation.kind === "createSection").map((operation) => operation.key));
  const checkRef = (reference: SectionReference | null | undefined, label: string) => {
    if (reference === undefined || reference === null || "existingId" in reference) return;
    if (!createdSections.has(reference.newSectionKey)) fail(`${label} has an unresolved section reference`);
  };
  operations.forEach((operation) => {
    if (!knownKinds.has((operation as { kind?: ApplyOperation["kind"] }).kind as ApplyOperation["kind"])) fail("Unknown catalog apply operation");
    ensureNoUndefined(operation, operation.kind);
    if (operation.kind === "createCategory") checkRef(operation.section, operation.kind);
    if (operation.kind === "updateCategory") checkRef(operation.section, operation.kind);
  });
}

function resolveSectionReference(reference: SectionReference, createdSectionIds: Map<string, number>): number {
  if ("existingId" in reference) return reference.existingId;
  const id = createdSectionIds.get(reference.newSectionKey);
  if (id === undefined) fail(`Unresolved new section key: ${reference.newSectionKey}`);
  return id;
}

function ensureUpdateValues(values: Record<string, unknown>, label: string): void {
  ensureNoUndefined(values, label);
  if (Object.keys(values).length === 0) fail(`${label} has no values to write`);
}

/** Applies validated operations in catalog dependency order. It intentionally performs no reads. */
export async function applyOperations(tx: unknown, operations: ApplyOperation[]): Promise<CatalogApplyCounts> {
  validateOperations(operations);
  const executor = tx as WriteExecutor;
  const counts: CatalogApplyCounts = { creates: 0, updates: 0, deletes: 0 };
  const createdSectionIds = new Map<string, number>();
  const byKind = <Kind extends ApplyOperation["kind"]>(kind: Kind): Extract<ApplyOperation, { kind: Kind }>[] => (
    operations.filter((operation): operation is Extract<ApplyOperation, { kind: Kind }> => operation.kind === kind)
  );

  for (const operation of byKind("createSection")) {
    const values = { name: operation.name, sortOrder: operation.sortOrder };
    ensureNoUndefined(values, operation.kind);
    const ids = await executor.insert(categorySections).values(values).$returningId();
    const id = ids?.[0]?.id;
    if (typeof id !== "number") fail("createSection did not return an id");
    createdSectionIds.set(operation.key, id);
    counts.creates += 1;
  }

  for (const operation of byKind("updateSection")) {
    ensureUpdateValues(operation.set, operation.kind);
    await executor.update(categorySections).set(operation.set).where(eq(categorySections.id, operation.id));
    counts.updates += 1;
  }

  for (const operation of byKind("createCategory")) {
    const values = {
      slug: operation.slug,
      name: operation.name,
      powerDropName: operation.powerDropName,
      emoji: operation.emoji,
      visibility: operation.visibility,
      sortOrder: operation.sortOrder,
      sectionId: operation.section === null ? null : resolveSectionReference(operation.section, createdSectionIds),
    };
    ensureNoUndefined(values, operation.kind);
    await executor.insert(categories).values(values);
    counts.creates += 1;
  }

  for (const operation of byKind("updateCategory")) {
    const values: Record<string, unknown> = { ...operation.set };
    if (operation.section !== undefined) values.sectionId = operation.section === null ? null : resolveSectionReference(operation.section, createdSectionIds);
    ensureUpdateValues(values, operation.kind);
    await executor.update(categories).set(values).where(eq(categories.slug, operation.slug));
    counts.updates += 1;
  }

  for (const operation of byKind("createProduct")) {
    const values = {
      name: operation.name,
      cut: operation.cut,
      category: operation.category,
      description: operation.description,
      price: operation.price,
      powerDropPrice: operation.powerDropPrice,
      retailPrice: operation.retailPrice,
      unit: operation.unit,
      badge: operation.badge,
      available: operation.available,
      visibility: operation.visibility,
      stockLimit: operation.stockLimit,
      sortOrder: operation.sortOrder,
      img: operation.img,
    };
    ensureNoUndefined(values, operation.kind);
    await executor.insert(products).values(values);
    counts.creates += 1;
  }

  for (const operation of byKind("updateProduct")) {
    ensureUpdateValues(operation.set, operation.kind);
    await executor.update(products).set(operation.set).where(eq(products.id, operation.id));
    counts.updates += 1;
  }

  for (const operation of byKind("deleteProduct")) {
    await executor.delete(products).where(eq(products.id, operation.id));
    counts.deletes += 1;
  }

  for (const operation of byKind("deleteCategory")) {
    await executor.delete(categories).where(eq(categories.slug, operation.slug));
    counts.deletes += 1;
  }

  for (const operation of byKind("deleteSection")) {
    await executor.update(categories).set({ sectionId: null }).where(eq(categories.sectionId, operation.id));
    await executor.delete(categorySections).where(eq(categorySections.id, operation.id));
    counts.deletes += 1;
  }

  return counts;
}

/** Re-plans and applies one immutable preview inside the caller's transaction. */
export async function runApply(
  tx: unknown,
  parsedFiles: ParsedCatalogFile[],
  planHash: string,
  restoreMode: boolean,
  readers: CatalogApplyReaders,
): Promise<CatalogApplyCounts> {
  const snapshot = await readers.readSnapshot(tx);
  const ordered = await readers.readOrderedIds(tx);
  const plan = validateAndPlan(parsedFiles, { ...snapshot, ...ordered }, { restoreMode });

  if (plan.planHash !== planHash) {
    throw new CatalogApplyError(409, { error: "Catalog changed since preview: preview again" });
  }
  if (plan.errors.length > 0 || plan.blockers.length > 0 || (!restoreMode && plan.conflicts.length > 0)) {
    throw new CatalogApplyError(400, { error: "Preview has problems", plan });
  }
  if (plan.operations.length === 0) {
    throw new CatalogApplyError(400, { error: "Nothing to apply" });
  }
  if (plan.operations.length > 1000) {
    throw new CatalogApplyError(400, { error: "Too many changes in one upload (max 1000): split the file" });
  }

  const counts = await applyOperations(tx, plan.operations);
  const deletedSlugs = plan.operations.filter((operation) => operation.kind === "deleteCategory").map((operation) => operation.slug);
  if (deletedSlugs.length > 0) {
    const rows = await (tx as WriteExecutor).select().from(products).where(inArray(products.category, deletedSlugs)).for("update");
    if (rows.length > 0) {
      throw new CatalogApplyError(409, { error: "A product was added to a deleted category during apply: preview again" });
    }
  }
  return counts;
}
