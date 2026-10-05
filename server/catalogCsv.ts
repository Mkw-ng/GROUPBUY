import { createHash } from "node:crypto";
import { effectiveVisibility, isVisibleInMode, type VisibilityMode } from "../shared/visibility";

export const SECTION_HEADERS = ["id", "name", "sortOrder", "updatedAt", "action"] as const;
export const CATEGORY_HEADERS = ["slug", "name", "powerDropName", "emoji", "section", "visibility", "sortOrder", "updatedAt", "action"] as const;
export const PRODUCT_HEADERS = [
  "id", "name", "cut", "category", "description", "price", "powerDropPrice", "retailPrice",
  "unit", "badge", "available", "visibility", "stockLimit", "sortOrder", "img", "updatedAt", "action",
] as const;

export type CatalogFileType = "sections" | "categories" | "products";
export type CatalogAction = "create" | "update" | "delete";
export type SectionReference = { existingId: number } | { newSectionKey: string };

type NullableProductField = "description" | "powerDropPrice" | "retailPrice" | "badge" | "stockLimit" | "img";
type NullableCategoryField = "powerDropName" | "emoji";
type ChangeValue = string | number | boolean | null;
type ChangeFields = Record<string, { oldValue: ChangeValue; newValue: ChangeValue }>;

export interface CatalogSectionSnapshot {
  id: number;
  name: string;
  sortOrder: number;
  createdAt?: Date | string;
  updatedAt: Date | string;
}

export interface CatalogCategorySnapshot {
  id: number;
  slug: string;
  name: string;
  powerDropName: string | null;
  emoji: string | null;
  sectionId: number | null;
  visibility: VisibilityMode;
  sortOrder: number;
  createdAt?: Date | string;
  updatedAt: Date | string;
}

export interface CatalogProductSnapshot {
  id: number;
  name: string;
  cut: string;
  category: string;
  description: string | null;
  price: string;
  powerDropPrice: string | null;
  retailPrice: string | null;
  unit: string;
  badge: "LIMITED" | "POPULAR" | "NEW" | "SOLD OUT" | null;
  available: boolean;
  visibility: VisibilityMode;
  stockLimit: string | null;
  sortOrder: number;
  img: string | null;
  createdAt?: Date | string;
  updatedAt: Date | string;
}

export interface CatalogSnapshot {
  sections: CatalogSectionSnapshot[];
  categories: CatalogCategorySnapshot[];
  products: CatalogProductSnapshot[];
  orderedProductIds: Set<number> | number[];
  unreadableOrderCount?: number;
}

export interface CatalogIssue {
  file: string;
  row: number;
  message: string;
}

export interface CatalogChange {
  action: CatalogAction;
  item: string;
  file: string;
  row: number;
  field: string;
  oldValue: ChangeValue;
  newValue: ChangeValue;
}

export type CreateSectionOperation = {
  kind: "createSection";
  target: string;
  key: string;
  name: string;
  sortOrder: number;
};
export type UpdateSectionOperation = {
  kind: "updateSection";
  target: string;
  id: number;
  set: Partial<Pick<CatalogSectionSnapshot, "name" | "sortOrder">>;
};
export type DeleteSectionOperation = { kind: "deleteSection"; target: string; id: number };
export type CreateCategoryOperation = {
  kind: "createCategory";
  target: string;
  slug: string;
  name: string;
  powerDropName: string | null;
  emoji: string | null;
  visibility: VisibilityMode;
  sortOrder: number;
  section: SectionReference | null;
};
export type UpdateCategoryOperation = {
  kind: "updateCategory";
  target: string;
  slug: string;
  set: Partial<Pick<CatalogCategorySnapshot, "name" | "powerDropName" | "emoji" | "visibility" | "sortOrder">>;
  section?: SectionReference | null;
};
export type DeleteCategoryOperation = { kind: "deleteCategory"; target: string; slug: string };
export type CreateProductOperation = {
  kind: "createProduct";
  target: string;
  name: string;
  cut: string;
  category: string;
  description: string | null;
  price: string;
  powerDropPrice: string | null;
  retailPrice: string | null;
  unit: string;
  badge: CatalogProductSnapshot["badge"];
  available: boolean;
  visibility: VisibilityMode;
  stockLimit: string | null;
  sortOrder: number;
  img: string | null;
};
export type UpdateProductOperation = {
  kind: "updateProduct";
  target: string;
  id: number;
  set: Partial<Pick<CatalogProductSnapshot, "name" | "cut" | "category" | "description" | "price" | "powerDropPrice" | "retailPrice" | "unit" | "badge" | "available" | "visibility" | "stockLimit" | "sortOrder" | "img">>;
};
export type DeleteProductOperation = { kind: "deleteProduct"; target: string; id: number };
export type ApplyOperation =
  | CreateSectionOperation
  | UpdateSectionOperation
  | DeleteSectionOperation
  | CreateCategoryOperation
  | UpdateCategoryOperation
  | DeleteCategoryOperation
  | CreateProductOperation
  | UpdateProductOperation
  | DeleteProductOperation;

export interface CatalogPlan {
  creates: number;
  updates: number;
  deletes: number;
  unchanged: number;
  conflicts: CatalogIssue[];
  errors: CatalogIssue[];
  warnings: string[];
  blockers: string[];
  changes: CatalogChange[];
  operations: ApplyOperation[];
  safety: {
    visibleAvailableBefore: number;
    visibleAvailableAfter: number;
  };
  planHash: string;
}

interface CsvRow {
  row: number;
  values: Record<string, string>;
}

export interface ParsedCatalogFile {
  filename: string;
  type: CatalogFileType | null;
  headers: string[];
  rows: CsvRow[];
  errors: CatalogIssue[];
}

interface PlanOptions {
  restoreMode?: boolean;
}

interface OperationDraft {
  action: CatalogAction;
  target: string;
  file: string;
  row: number;
  fields: ChangeFields;
  operation: ApplyOperation;
}

interface SectionEntry {
  ref: SectionReference;
  id?: number;
  key?: string;
  name: string;
  sortOrder: number;
  initial?: CatalogSectionSnapshot;
  row?: CsvRow;
  action?: CatalogAction;
  changedName: boolean;
}

interface InternalCategory {
  id?: number;
  slug: string;
  name: string;
  powerDropName: string | null;
  emoji: string | null;
  section: SectionReference | null;
  visibility: VisibilityMode;
  sortOrder: number;
  initial?: CatalogCategorySnapshot;
  row?: CsvRow;
  action?: CatalogAction;
  changedName: boolean;
}

interface ProductEntry {
  product: CatalogProductSnapshot;
  row?: CsvRow;
  action?: CatalogAction;
}

const VISIBILITY_VALUES = new Set<VisibilityMode>(["regular_only", "always", "power_drop_only"]);
const BADGE_VALUES = new Set(["LIMITED", "POPULAR", "NEW", "SOLD OUT"]);
const PRODUCT_FIELDS = ["name", "cut", "category", "description", "price", "powerDropPrice", "retailPrice", "unit", "badge", "available", "visibility", "stockLimit", "sortOrder", "img"] as const;
const PRODUCT_NULLABLE = new Set<NullableProductField>(["description", "powerDropPrice", "retailPrice", "badge", "stockLimit", "img"]);
const PRODUCT_DECIMALS = new Set(["price", "powerDropPrice", "retailPrice", "stockLimit"]);
const MAX_SORT_ORDER = 2_147_483_647;
const MAX_TEXT_BYTES = 65_535;

function headersFor(type: CatalogFileType): readonly string[] {
  if (type === "sections") return SECTION_HEADERS;
  if (type === "categories") return CATEGORY_HEADERS;
  return PRODUCT_HEADERS;
}

function normaliseText(value: unknown): string {
  return String(value ?? "").replace(/\r\n|\r/g, "\n").trim();
}

function lower(value: unknown): string {
  return normaliseText(value).toLocaleLowerCase();
}

function nullableText(value: unknown): string | null {
  const text = normaliseText(value);
  return text === "" ? null : text;
}

function displayValue(value: unknown): ChangeValue {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return normaliseText(value);
  return value as string | number | boolean;
}

function copySection(section: CatalogSectionSnapshot): CatalogSectionSnapshot {
  return { ...section };
}
function copyCategory(category: CatalogCategorySnapshot): CatalogCategorySnapshot {
  return { ...category };
}
function copyProduct(product: CatalogProductSnapshot): CatalogProductSnapshot {
  return { ...product };
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value).replace(/\r\n|\r|\n/g, "\r\n");
  return `"${text.replace(/"/g, '""')}"`;
}

function dateFromDb(value: Date | string | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wholeSecondFromDb(value: Date | string | undefined): number | null {
  const date = dateFromDb(value);
  return date ? Math.floor(date.getTime() / 1000) : null;
}

function utcIso(value: Date | string | undefined): string {
  const date = dateFromDb(value);
  return date ? date.toISOString().replace(/\.\d{3}Z$/, "Z") : "";
}

/** Detects the catalog file family from its filename. */
export function detectCatalogFileType(filename: string): CatalogFileType | null {
  const matches = (["sections", "categories", "products"] as const)
    .filter((type) => filename.toLocaleLowerCase().includes(type));
  return matches.length === 1 ? matches[0] : null;
}

/** Strict CSV reader supporting BOM, CRLF/LF/lone-CR and quoted line breaks. */
export function parseCatalogCsv(filename: string, raw: string): ParsedCatalogFile {
  const type = detectCatalogFileType(filename);
  const source = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const errors: CatalogIssue[] = [];
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let state: "unquoted" | "quoted" | "afterQuote" = "unquoted";
  let rowNumber = 1;

  const pushRecord = () => {
    record.push(cell);
    records.push(record);
    record = [];
    cell = "";
    state = "unquoted";
    rowNumber += 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (state === "quoted") {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          state = "afterQuote";
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (state === "afterQuote") {
      if (char === ",") {
        record.push(cell);
        cell = "";
        state = "unquoted";
      } else if (char === "\n" || char === "\r") {
        pushRecord();
        if (char === "\r" && source[index + 1] === "\n") index += 1;
      } else {
        errors.push({ file: filename, row: rowNumber, message: "text after closing quote" });
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      if (cell !== "") {
        errors.push({ file: filename, row: rowNumber, message: "quote inside unquoted cell" });
        cell += char;
      } else {
        state = "quoted";
      }
    } else if (char === ",") {
      record.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      pushRecord();
      if (char === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      cell += char;
    }
  }
  if (state === "quoted") errors.push({ file: filename, row: rowNumber, message: "unterminated quote" });
  if (cell !== "" || record.length > 0 || state === "afterQuote") {
    record.push(cell);
    records.push(record);
  }

  if (!type) {
    errors.push({ file: filename, row: 1, message: `unrecognised catalog file: ${filename}` });
    return { filename, type: null, headers: [], rows: [], errors };
  }
  if (records.length === 0) {
    errors.push({ file: filename, row: 1, message: "CSV file is empty" });
    return { filename, type, headers: [], rows: [], errors };
  }

  const headers = records[0].map((header) => normaliseText(header));
  const allowed = new Set(headersFor(type));
  const seen = new Set<string>();
  for (const header of headers) {
    if (!allowed.has(header)) errors.push({ file: filename, row: 1, message: `unknown header: ${header || "(blank)"}` });
    if (seen.has(header)) errors.push({ file: filename, row: 1, message: `duplicate header: ${header || "(blank)"}` });
    seen.add(header);
  }
  const key = type === "categories" ? "slug" : "id";
  if (!seen.has(key)) errors.push({ file: filename, row: 1, message: `missing key column: ${key}` });

  const rows: CsvRow[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const cells = records[index];
    if (cells.every((value) => normaliseText(value) === "")) continue;
    const values: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      if (header) values[header] = cells[cellIndex] ?? "";
    });
    rows.push({ row: index + 1, values });
  }
  return { filename, type, headers, rows, errors };
}

/** Parses every uploaded file and catches duplicate/misnamed file families before planning. */
export function parseCatalogFiles(files: Array<{ filename: string; text: string }>): ParsedCatalogFile[] {
  const parsed = files.map((file) => parseCatalogCsv(file.filename, file.text));
  const groups = new Map<CatalogFileType, ParsedCatalogFile[]>();
  parsed.forEach((file) => {
    if (!file.type) return;
    const group = groups.get(file.type) ?? [];
    group.push(file);
    groups.set(file.type, group);
  });
  Array.from(groups.values()).forEach((group) => {
    if (group.length < 2) return;
    const names = group.map((file) => file.filename).join(", ");
    group.forEach((file) => file.errors.push({ file: file.filename, row: 1, message: `two files of the same type: ${names}` }));
  });
  return parsed;
}

/** Writes a BOM-prefixed, CRLF-delimited catalog CSV. */
export function exportCatalogRows(headers: readonly string[], rows: unknown[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

/** Exports the three catalog data sets using stable, user-editable reference values. */
export function exportCatalogCsv(snapshot: CatalogSnapshot): Record<`${CatalogFileType}.csv`, string> {
  const sectionById = new Map(snapshot.sections.map((section) => [section.id, section]));
  const sections = [...snapshot.sections].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const categories = [...snapshot.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const products = [...snapshot.products].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return {
    "sections.csv": exportCatalogRows(SECTION_HEADERS, sections.map((section) => [section.id, section.name, section.sortOrder, utcIso(section.updatedAt), ""])),
    "categories.csv": exportCatalogRows(CATEGORY_HEADERS, categories.map((category) => [
      category.slug, category.name, category.powerDropName, category.emoji,
      category.sectionId == null ? "" : sectionById.get(category.sectionId)?.name ?? "",
      category.visibility, category.sortOrder, utcIso(category.updatedAt), "",
    ])),
    "products.csv": exportCatalogRows(PRODUCT_HEADERS, products.map((product) => [
      product.id, product.name, product.cut, product.category, product.description, product.price,
      product.powerDropPrice, product.retailPrice, product.unit, product.badge,
      product.available ? "TRUE" : "FALSE", product.visibility, product.stockLimit, product.sortOrder,
      product.img, utcIso(product.updatedAt), "",
    ])),
  };
}

/** Strictly extracts every ordered product id without touching a database. */
export function parseOrderedProductIds(itemsTexts: string[]): { orderedProductIds: Set<number>; unreadableOrderCount: number } {
  const orderedProductIds = new Set<number>();
  let unreadableOrderCount = 0;
  itemsTexts.forEach((itemsText) => {
    try {
      const parsed: unknown = JSON.parse(itemsText);
      if (!Array.isArray(parsed)) throw new Error("items is not an array");
      const ids = new Set<number>();
      parsed.forEach((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("item is not an object");
        const rawId = (item as { id?: unknown }).id;
        const id = typeof rawId === "number"
          ? (Number.isSafeInteger(rawId) ? rawId : null)
          : (typeof rawId === "string" && /^[0-9]+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) ? Number(rawId) : null);
        if (id === null) throw new Error("item id is invalid");
        ids.add(id);
      });
      ids.forEach((id) => orderedProductIds.add(id));
    } catch {
      unreadableOrderCount += 1;
    }
  });
  return { orderedProductIds, unreadableOrderCount };
}

class Issues {
  readonly errors: CatalogIssue[];
  private readonly rows = new Set<string>();

  constructor(initial: CatalogIssue[]) {
    this.errors = [...initial];
    initial.forEach((entry) => this.rows.add(this.key(entry.file, entry.row)));
  }

  add(file: ParsedCatalogFile, row: number, message: string): void {
    this.errors.push({ file: file.filename, row, message });
    this.rows.add(this.key(file.filename, row));
  }

  has(file: ParsedCatalogFile, row: number): boolean {
    return this.rows.has(this.key(file.filename, row));
  }

  private key(file: string, row: number): string {
    return `${file}\u0000${row}`;
  }
}

function present(file: ParsedCatalogFile, field: string): boolean {
  return file.headers.includes(field);
}

function parseAction(file: ParsedCatalogFile, row: CsvRow, issues: Issues): "" | "delete" {
  if (!present(file, "action")) return "";
  const action = lower(row.values.action);
  if (action === "" || action === "delete") return action;
  issues.add(file, row.row, "action must be blank or delete");
  return "";
}

function parsePositiveInteger(value: string): number | null {
  const text = normaliseText(value);
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function parseNonNegativeInteger(value: string): number | null {
  const text = normaliseText(value);
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 && number <= MAX_SORT_ORDER ? number : null;
}

function sortOrderError(issues: Issues, file: ParsedCatalogFile, row: number): void {
  issues.add(file, row, `sortOrder must be an integer from 0 to ${MAX_SORT_ORDER}`);
}

function exceedsTextBytes(value: string | null): boolean {
  return value !== null && Buffer.byteLength(value, "utf8") > MAX_TEXT_BYTES;
}

function parseBoolean(value: string): boolean | null {
  const text = lower(value);
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}

function parseDecimal(value: string, max: number, decimalPlaces: number): string | null {
  const text = normaliseText(value);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimalPlaces}})?$`).test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number <= max ? text : null;
}

function equalValue(field: string, previous: unknown, next: unknown): boolean {
  if (PRODUCT_DECIMALS.has(field)) {
    const a = nullableText(previous);
    const b = nullableText(next);
    return a === null || b === null ? a === b : Number(a) === Number(b);
  }
  if (field === "available") return Boolean(previous) === Boolean(next);
  if (field === "sortOrder") return Number(previous ?? 0) === Number(next ?? 0);
  return normaliseText(previous) === normaliseText(next);
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: readonly string[]): ChangeFields {
  const result: ChangeFields = {};
  fields.forEach((field) => {
    if (!equalValue(field, before[field], after[field])) {
      result[field] = { oldValue: displayValue(before[field]), newValue: displayValue(after[field]) };
    }
  });
  return result;
}

function allCreateFields(after: Record<string, unknown>, fields: readonly string[]): ChangeFields {
  const result: ChangeFields = {};
  fields.forEach((field) => {
    result[field] = { oldValue: null, newValue: after[field] === undefined ? null : displayValue(after[field]) };
  });
  return result;
}

/** Parses accepted CSV updatedAt text as a UTC whole-second timestamp. */
export function parseUpdatedAtUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|\+00:00)?$/.exec(normaliseText(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const millis = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(millis);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(millis / 1000);
}

function checkConflict(
  file: ParsedCatalogFile,
  row: CsvRow,
  current: { updatedAt: Date | string },
  changed: boolean,
  issues: Issues,
  conflicts: CatalogIssue[],
  warnings: string[],
  restoreMode: boolean,
): boolean {
  if (!present(file, "updatedAt")) return false;
  const exportSecond = parseUpdatedAtUtc(row.values.updatedAt);
  if (exportSecond === null) {
    issues.add(file, row.row, "updatedAt must be an ISO date");
    return true;
  }
  if (!changed) return false;
  const databaseSecond = wholeSecondFromDb(current.updatedAt);
  if (databaseSecond !== null && databaseSecond > exportSecond) {
    if (restoreMode) {
      warnings.push(`${file.filename}: row ${row.row}: changed in admin since export (restore mode: overwriting)`);
      return false;
    }
    conflicts.push({ file: file.filename, row: row.row, message: "changed in admin since export: re-export and redo this edit" });
    return true;
  }
  return false;
}

function sectionTarget(id: number): string { return `section:${id}`; }
function newSectionTarget(key: string): string { return `section:new:${key}`; }
function categoryTarget(slug: string): string { return `category:${slug}`; }
function productTarget(id: number): string { return `product:${id}`; }
function newProductTarget(row: number): string { return `product:new:${row}`; }

function sectionKey(name: string): string {
  return lower(name);
}

function sectionRefForId(id: number | null): SectionReference | null {
  return id === null ? null : { existingId: id };
}

function sameSectionRef(left: SectionReference | null, right: SectionReference | null): boolean {
  if (left === null || right === null) return left === right;
  if ("existingId" in left && "existingId" in right) return left.existingId === right.existingId;
  if ("newSectionKey" in left && "newSectionKey" in right) return left.newSectionKey === right.newSectionKey;
  return false;
}

function productTuple(product: Pick<CatalogProductSnapshot, "name" | "cut" | "category">): string {
  return [product.name, product.cut, product.category].map(lower).join("\u0000");
}

function countVisibleAvailable(products: Iterable<CatalogProductSnapshot>, categories: Iterable<InternalCategory | CatalogCategorySnapshot>): number {
  const categoryVisibility = new Map<string, VisibilityMode>();
  Array.from(categories).forEach((category) => categoryVisibility.set(category.slug, category.visibility));
  return Array.from(products).filter((product) => {
    const visibility = categoryVisibility.get(product.category) ?? "always";
    return product.available && isVisibleInMode(effectiveVisibility(product.visibility, visibility), false);
  }).length;
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, stableJson(nested)]));
}

function isStructuralFileError(file: ParsedCatalogFile): boolean {
  return file.errors.some((error) => error.row === 1);
}

function addDraft(drafts: Map<string, OperationDraft>, draft: OperationDraft): void {
  drafts.set(draft.target, draft);
}

function mergeCategoryUpdateDraft(
  drafts: Map<string, OperationDraft>,
  category: InternalCategory,
  file: string,
  row: number,
  fields: ChangeFields,
  set: UpdateCategoryOperation["set"],
  section: SectionReference | null | undefined,
): void {
  const target = categoryTarget(category.slug);
  const existing = drafts.get(target);
  if (existing && existing.operation.kind === "updateCategory") {
    existing.fields = { ...existing.fields, ...fields };
    existing.operation.set = { ...existing.operation.set, ...set };
    if (section !== undefined) existing.operation.section = section;
    return;
  }
  addDraft(drafts, {
    action: "update",
    target,
    file,
    row,
    fields,
    operation: { kind: "updateCategory", target, slug: category.slug, set, ...(section !== undefined ? { section } : {}) },
  });
}

function referenceDisplay(ref: SectionReference | null, sections: Map<number, SectionEntry>, newSections: Map<string, SectionEntry>): ChangeValue {
  if (ref === null) return null;
  if ("existingId" in ref) return sections.get(ref.existingId)?.name ?? ref.existingId;
  return newSections.get(ref.newSectionKey)?.name ?? ref.newSectionKey;
}

function allSections(sections: Map<number, SectionEntry>, newSections: Map<string, SectionEntry>): SectionEntry[] {
  return [...Array.from(sections.values()), ...Array.from(newSections.values())];
}

function resolveSectionReference(
  file: ParsedCatalogFile,
  row: CsvRow,
  current: SectionReference | null,
  initial: SectionReference | null,
  sections: Map<number, SectionEntry>,
  newSections: Map<string, SectionEntry>,
  deletedSectionIds: Set<number>,
  initialSections: Map<number, CatalogSectionSnapshot>,
  issues: Issues,
  warnings: string[],
  warningKeys: Set<string>,
  categorySlug: string,
  isNewCategory: boolean,
): SectionReference | null | undefined {
  if (!present(file, "section")) return isNewCategory ? null : current;
  const supplied = normaliseText(row.values.section);
  if (supplied === "") {
    if (current && "existingId" in current && !sections.has(current.existingId)) return current;
    return null;
  }

  if (!isNewCategory && current && "existingId" in current && !deletedSectionIds.has(current.existingId)) {
    const before = initial && "existingId" in initial ? initialSections.get(initial.existingId)?.name : undefined;
    const after = sections.get(current.existingId)?.name;
    const matchesBefore = Boolean(before && lower(supplied) === lower(before));
    const matchesAfter = Boolean(after && lower(supplied) === lower(after));
    if (matchesBefore || matchesAfter) {
      if (before && after && lower(before) !== lower(after) && matchesBefore && !matchesAfter) {
        const warning = `category ${categorySlug} stays in renamed section ${after}`;
        if (!warningKeys.has(warning)) {
          warningKeys.add(warning);
          warnings.push(warning);
        }
      }
      return current;
    }
  }

  const liveMatches = allSections(sections, newSections).filter((section) => lower(section.name) === lower(supplied));
  if (liveMatches.length === 1) return liveMatches[0].ref;
  if (liveMatches.length > 1) {
    issues.add(file, row.row, `ambiguous section name: ${liveMatches.map((section) => section.id ?? `row ${section.row?.row ?? "?"}`).join(", ")}`);
    return undefined;
  }
  const deletedMatches = Array.from(deletedSectionIds)
    .map((id) => initialSections.get(id))
    .filter((section): section is CatalogSectionSnapshot => Boolean(section))
    .filter((section) => lower(section.name) === lower(supplied));
  if (deletedMatches.length > 0) {
    issues.add(file, row.row, "section is being deleted");
    return undefined;
  }
  issues.add(file, row.row, "unknown section name: renamed? Update this column or leave categories.csv out");
  return undefined;
}

function productSetForTuple(index: Map<string, Set<string>>, tuple: string): Set<string> {
  const found = index.get(tuple);
  if (found) return found;
  const created = new Set<string>();
  index.set(tuple, created);
  return created;
}

function tupleRemove(index: Map<string, Set<string>>, tuple: string, reference: string): void {
  const group = index.get(tuple);
  if (!group) return;
  group.delete(reference);
  if (group.size === 0) index.delete(tuple);
}

function tupleAdd(index: Map<string, Set<string>>, tuple: string, reference: string): void {
  productSetForTuple(index, tuple).add(reference);
}

/**
 * Validates uploaded catalog files and returns a deterministic, pure plan.
 * No database helper or mutation is called from this module.
 */
export function validateAndPlan(parsedFiles: ParsedCatalogFile[], snapshot: CatalogSnapshot, options: PlanOptions = {}): CatalogPlan {
  const restoreMode = options.restoreMode === true;
  const issues = new Issues(parsedFiles.flatMap((file) => file.errors));
  const conflicts: CatalogIssue[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const warningKeys = new Set<string>();
  const drafts = new Map<string, OperationDraft>();
  const rowStatus = new Map<string, "changed" | "unchanged" | "error" | "conflict">();
  const statusKey = (file: ParsedCatalogFile, row: CsvRow) => `${file.filename}\u0000${row.row}`;
  const validFile = (type: CatalogFileType): ParsedCatalogFile | undefined => {
    const matches = parsedFiles.filter((file) => file.type === type);
    return matches.length === 1 && !isStructuralFileError(matches[0]) ? matches[0] : undefined;
  };

  parsedFiles.forEach((file) => {
    if (!file.type) return;
    const key = file.type === "categories" ? "slug" : "id";
    const groups = new Map<string, CsvRow[]>();
    file.rows.forEach((row) => {
      const raw = normaliseText(row.values[key]);
      if (!raw) return;
      const normalized = key === "id" ? String(parsePositiveInteger(raw) ?? raw) : lower(raw);
      const group = groups.get(normalized) ?? [];
      group.push(row);
      groups.set(normalized, group);
    });
    Array.from(groups.entries()).forEach(([value, rows]) => {
      if (rows.length > 1) rows.forEach((row) => issues.add(file, row.row, `duplicate ${key}: ${value}`));
    });
  });

  // Sections are planned first, then final-state section names are checked collectively.
  const initialSections = new Map(snapshot.sections.map((section) => [section.id, copySection(section)]));
  const sections = new Map<number, SectionEntry>(snapshot.sections.map((section) => [section.id, {
    ref: { existingId: section.id }, id: section.id, name: section.name, sortOrder: section.sortOrder,
    initial: copySection(section), changedName: false,
  }]));
  const newSections = new Map<string, SectionEntry>();
  const deletedSectionIds = new Set<number>();
  const sectionRows = new Map<number | string, { row: CsvRow; action: CatalogAction; previous?: CatalogSectionSnapshot; candidate?: SectionEntry; fields: ChangeFields }>();
  let nextSectionSort = Math.max(-1, ...snapshot.sections.map((section) => section.sortOrder)) + 1;
  const sectionsFile = validFile("sections");

  if (sectionsFile) {
    sectionsFile.rows.forEach((row) => {
      const key = statusKey(sectionsFile, row);
      const deleteAction = parseAction(sectionsFile, row, issues);
      const rawId = normaliseText(row.values.id);
      const id = rawId === "" ? null : parsePositiveInteger(rawId);
      if (rawId !== "" && id === null) issues.add(sectionsFile, row.row, "id must be a positive integer");
      if (issues.has(sectionsFile, row.row)) { rowStatus.set(key, "error"); return; }
      if (deleteAction === "delete") {
        const existing = id === null ? undefined : sections.get(id);
        if (!existing || id === null) { issues.add(sectionsFile, row.row, "section id does not exist"); rowStatus.set(key, "error"); return; }
        sections.delete(id);
        deletedSectionIds.add(id);
        sectionRows.set(id, { row, action: "delete", previous: existing.initial, fields: { name: { oldValue: existing.name, newValue: "DELETE" } } });
        rowStatus.set(key, "changed");
        return;
      }
      if (id === null) {
        const name = normaliseText(row.values.name);
        if (!present(sectionsFile, "name") || !name) issues.add(sectionsFile, row.row, "name is required for a new section");
        if (name.length > 64) issues.add(sectionsFile, row.row, "name must be at most 64 characters");
        const sortOrder = !present(sectionsFile, "sortOrder") || normaliseText(row.values.sortOrder) === "" ? nextSectionSort++ : parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null || sortOrder > MAX_SORT_ORDER) sortOrderError(issues, sectionsFile, row.row);
        if (issues.has(sectionsFile, row.row)) { rowStatus.set(key, "error"); return; }
        const section: SectionEntry = { ref: { newSectionKey: sectionKey(name) }, key: sectionKey(name), name, sortOrder: sortOrder!, row, action: "create", changedName: true };
        const sameNewSection = newSections.get(section.key!);
        if (sameNewSection) {
          issues.add(sectionsFile, row.row, `section name already exists: row ${sameNewSection.row?.row ?? "?"}`);
          rowStatus.set(key, "error");
          return;
        }
        newSections.set(section.key!, section);
        sectionRows.set(section.key!, { row, action: "create", candidate: section, fields: allCreateFields(section as unknown as Record<string, unknown>, ["name", "sortOrder"]) });
        rowStatus.set(key, "changed");
        return;
      }
      const existing = sections.get(id);
      if (!existing || !existing.initial) { issues.add(sectionsFile, row.row, "section id does not exist"); rowStatus.set(key, "error"); return; }
      const candidate: SectionEntry = { ...existing, row, action: "update" };
      if (present(sectionsFile, "name")) {
        const name = normaliseText(row.values.name);
        if (!name) issues.add(sectionsFile, row.row, "name is required");
        else if (name.length > 64) issues.add(sectionsFile, row.row, "name must be at most 64 characters");
        else candidate.name = name;
      }
      if (present(sectionsFile, "sortOrder")) {
        const sortOrder = parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) sortOrderError(issues, sectionsFile, row.row);
        else candidate.sortOrder = sortOrder;
      }
      candidate.changedName = lower(candidate.name) !== lower(existing.initial.name);
      const fields = changedFields(existing.initial as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["name", "sortOrder"]);
      if (issues.has(sectionsFile, row.row) || checkConflict(sectionsFile, row, existing.initial, Object.keys(fields).length > 0, issues, conflicts, warnings, restoreMode)) {
        rowStatus.set(key, issues.has(sectionsFile, row.row) ? "error" : "conflict");
        return;
      }
      sections.set(id, candidate);
      sectionRows.set(id, { row, action: "update", previous: existing.initial, candidate, fields });
      rowStatus.set(key, Object.keys(fields).length ? "changed" : "unchanged");
    });

    const duplicateGroups = new Map<string, SectionEntry[]>();
    allSections(sections, newSections).forEach((section) => {
      const group = duplicateGroups.get(lower(section.name)) ?? [];
      group.push(section);
      duplicateGroups.set(lower(section.name), group);
    });
    Array.from(duplicateGroups.values()).forEach((group) => {
      if (group.length < 2) return;
      group.filter((section) => section.action === "create" || section.changedName).forEach((section) => {
        const other = group.find((candidate) => candidate !== section)!;
        issues.add(sectionsFile, section.row?.row ?? 1, `section name already exists: ${other.id ?? `row ${other.row?.row ?? "?"}`}`);
        if (section.id !== undefined && section.initial) sections.set(section.id, {
          ref: { existingId: section.id }, id: section.id, name: section.initial.name, sortOrder: section.initial.sortOrder,
          initial: section.initial, changedName: false,
        });
        if (section.key) newSections.delete(section.key);
        if (section.id !== undefined) sectionRows.delete(section.id);
        if (section.key) sectionRows.delete(section.key);
        if (section.row) rowStatus.set(statusKey(sectionsFile, section.row), "error");
      });
    });
  }

  // Categories reference the final section state and have a matching final-state name pass.
  const initialCategories = new Map(snapshot.categories.map((category) => [category.slug, copyCategory(category)]));
  const categories = new Map<string, InternalCategory>(snapshot.categories.map((category) => [category.slug, {
    id: category.id, slug: category.slug, name: category.name, powerDropName: category.powerDropName, emoji: category.emoji,
    section: sectionRefForId(category.sectionId), visibility: category.visibility, sortOrder: category.sortOrder,
    initial: copyCategory(category), changedName: false,
  }]));
  const deletedCategorySlugs = new Set<string>();
  const categoryRows = new Map<string, { row: CsvRow; action: CatalogAction; previous?: InternalCategory; candidate?: InternalCategory; fields: ChangeFields; set: UpdateCategoryOperation["set"]; section?: SectionReference | null }>();
  let nextCategorySort = Math.max(-1, ...snapshot.categories.map((category) => category.sortOrder)) + 1;
  const categoriesFile = validFile("categories");

  if (categoriesFile) {
    categoriesFile.rows.forEach((row) => {
      const key = statusKey(categoriesFile, row);
      const deleteAction = parseAction(categoriesFile, row, issues);
      const slug = normaliseText(row.values.slug);
      if (!slug) issues.add(categoriesFile, row.row, "slug is required");
      if (issues.has(categoriesFile, row.row)) { rowStatus.set(key, "error"); return; }
      const existing = categories.get(slug);
      if (deleteAction === "delete") {
        if (!existing) { issues.add(categoriesFile, row.row, "category slug does not exist"); rowStatus.set(key, "error"); return; }
        categories.delete(slug);
        deletedCategorySlugs.add(slug);
        categoryRows.set(slug, { row, action: "delete", previous: existing, fields: { name: { oldValue: existing.name, newValue: "DELETE" } }, set: {} });
        rowStatus.set(key, "changed");
        return;
      }
      if (!existing) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === "all" || slug.length > 64) issues.add(categoriesFile, row.row, "slug must match ^[a-z0-9]+(-[a-z0-9]+)*$, be at most 64 characters, and not be all");
        const name = normaliseText(row.values.name);
        if (!present(categoriesFile, "name") || !name) issues.add(categoriesFile, row.row, "name is required for a new category");
        if (name.length > 64) issues.add(categoriesFile, row.row, "name must be at most 64 characters");
        const visibility = present(categoriesFile, "visibility") ? normaliseText(row.values.visibility) : "always";
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) issues.add(categoriesFile, row.row, "visibility must be regular_only, always, or power_drop_only");
        const powerDropName = present(categoriesFile, "powerDropName") ? nullableText(row.values.powerDropName) : null;
        const emoji = present(categoriesFile, "emoji") ? nullableText(row.values.emoji) : null;
        if ((powerDropName?.length ?? 0) > 64) issues.add(categoriesFile, row.row, "powerDropName must be at most 64 characters");
        if ((emoji?.length ?? 0) > 16) issues.add(categoriesFile, row.row, "emoji must be at most 16 characters");
        const sortOrder = !present(categoriesFile, "sortOrder") || normaliseText(row.values.sortOrder) === "" ? nextCategorySort++ : parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null || sortOrder > MAX_SORT_ORDER) sortOrderError(issues, categoriesFile, row.row);
        const section = resolveSectionReference(categoriesFile, row, null, null, sections, newSections, deletedSectionIds, initialSections, issues, warnings, warningKeys, slug, true);
        if (issues.has(categoriesFile, row.row) || section === undefined) { rowStatus.set(key, "error"); return; }
        const category: InternalCategory = { slug, name, powerDropName, emoji, section, visibility: visibility as VisibilityMode, sortOrder: sortOrder!, row, action: "create", changedName: true };
        categories.set(slug, category);
        const values = { slug, name, powerDropName, emoji, section: referenceDisplay(section, sections, newSections), visibility: category.visibility, sortOrder: category.sortOrder };
        categoryRows.set(slug, { row, action: "create", candidate: category, fields: allCreateFields(values, ["slug", "name", "powerDropName", "emoji", "section", "visibility", "sortOrder"]), set: {} });
        rowStatus.set(key, "changed");
        return;
      }

      const candidate: InternalCategory = { ...existing, row, action: "update" };
      if (present(categoriesFile, "name")) {
        const name = normaliseText(row.values.name);
        if (!name) issues.add(categoriesFile, row.row, "name is required");
        else if (name.length > 64) issues.add(categoriesFile, row.row, "name must be at most 64 characters");
        else candidate.name = name;
      }
      if (present(categoriesFile, "powerDropName")) {
        candidate.powerDropName = nullableText(row.values.powerDropName);
        if ((candidate.powerDropName?.length ?? 0) > 64) issues.add(categoriesFile, row.row, "powerDropName must be at most 64 characters");
      }
      if (present(categoriesFile, "emoji")) {
        candidate.emoji = nullableText(row.values.emoji);
        if ((candidate.emoji?.length ?? 0) > 16) issues.add(categoriesFile, row.row, "emoji must be at most 16 characters");
      }
      if (present(categoriesFile, "visibility")) {
        const visibility = normaliseText(row.values.visibility);
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) issues.add(categoriesFile, row.row, "visibility must be regular_only, always, or power_drop_only");
        else candidate.visibility = visibility as VisibilityMode;
      }
      if (present(categoriesFile, "sortOrder")) {
        const sortOrder = parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) sortOrderError(issues, categoriesFile, row.row);
        else candidate.sortOrder = sortOrder;
      }
      const section = resolveSectionReference(categoriesFile, row, candidate.section, sectionRefForId(existing.initial?.sectionId ?? null), sections, newSections, deletedSectionIds, initialSections, issues, warnings, warningKeys, slug, false);
      if (section !== undefined) candidate.section = section;
      candidate.changedName = lower(candidate.name) !== lower(existing.name);
      const before = {
        name: existing.name, powerDropName: existing.powerDropName, emoji: existing.emoji,
        section: referenceDisplay(existing.section, sections, newSections), visibility: existing.visibility, sortOrder: existing.sortOrder,
      };
      const after = {
        name: candidate.name, powerDropName: candidate.powerDropName, emoji: candidate.emoji,
        section: referenceDisplay(candidate.section, sections, newSections), visibility: candidate.visibility, sortOrder: candidate.sortOrder,
      };
      const fields = changedFields(before, after, ["name", "powerDropName", "emoji", "section", "visibility", "sortOrder"]);
      const set: UpdateCategoryOperation["set"] = {};
      (["name", "powerDropName", "emoji", "visibility", "sortOrder"] as const).forEach((field) => {
        if (fields[field]) (set as Record<string, unknown>)[field] = candidate[field];
      });
      if (issues.has(categoriesFile, row.row) || (existing.initial && checkConflict(categoriesFile, row, existing.initial, Object.keys(fields).length > 0, issues, conflicts, warnings, restoreMode))) {
        rowStatus.set(key, issues.has(categoriesFile, row.row) ? "error" : "conflict");
        return;
      }
      categories.set(slug, candidate);
      categoryRows.set(slug, { row, action: "update", previous: existing, candidate, fields, set, ...(fields.section ? { section: candidate.section } : {}) });
      rowStatus.set(key, Object.keys(fields).length ? "changed" : "unchanged");
    });

    const duplicateGroups = new Map<string, InternalCategory[]>();
    Array.from(categories.values()).forEach((category) => {
      const group = duplicateGroups.get(lower(category.name)) ?? [];
      group.push(category);
      duplicateGroups.set(lower(category.name), group);
    });
    Array.from(duplicateGroups.values()).forEach((group) => {
      if (group.length < 2) return;
      group.filter((category) => category.action === "create" || category.changedName).forEach((category) => {
        const other = group.find((candidate) => candidate !== category)!;
        const otherLabel = other.action === "create" ? `row ${other.row?.row ?? "?"}` : other.slug;
        issues.add(categoriesFile, category.row?.row ?? 1, `category name already exists: ${otherLabel}`);
        if (category.action === "create") categories.delete(category.slug);
        else if (category.initial) categories.set(category.slug, { ...category, name: category.initial.name, powerDropName: category.initial.powerDropName, emoji: category.initial.emoji, section: sectionRefForId(category.initial.sectionId), visibility: category.initial.visibility, sortOrder: category.initial.sortOrder, action: undefined, row: undefined, changedName: false });
        categoryRows.delete(category.slug);
        if (category.row) rowStatus.set(statusKey(categoriesFile, category.row), "error");
      });
    });
  }

  // Products use the final category state and an incrementally maintained tuple index.
  const products = new Map<number, ProductEntry>(snapshot.products.map((product) => [product.id, { product: copyProduct(product) }]));
  const tupleIndex = new Map<string, Set<string>>();
  snapshot.products.forEach((product) => tupleAdd(tupleIndex, productTuple(product), String(product.id)));
  const productRows = new Map<number | string, { row: CsvRow; action: CatalogAction; previous?: CatalogProductSnapshot; candidate?: CatalogProductSnapshot; fields: ChangeFields }>();
  let nextProductSort = Math.max(-1, ...snapshot.products.map((product) => product.sortOrder)) + 1;
  const productsFile = validFile("products");
  const orderedProductIds = snapshot.orderedProductIds instanceof Set ? snapshot.orderedProductIds : new Set(snapshot.orderedProductIds);

  if (productsFile) {
    const existingRows = productsFile.rows.filter((row) => normaliseText(row.values.id) !== "");
    const newRows = productsFile.rows.filter((row) => normaliseText(row.values.id) === "");
    [...existingRows, ...newRows].forEach((row) => {
      const key = statusKey(productsFile, row);
      const deleteAction = parseAction(productsFile, row, issues);
      const rawId = normaliseText(row.values.id);
      const id = rawId === "" ? null : parsePositiveInteger(rawId);
      if (rawId !== "" && id === null) issues.add(productsFile, row.row, "id must be a positive integer");
      if (issues.has(productsFile, row.row)) { rowStatus.set(key, "error"); return; }
      const existing = id === null ? undefined : products.get(id);
      if (deleteAction === "delete") {
        if (!existing || id === null) { issues.add(productsFile, row.row, "product id does not exist"); rowStatus.set(key, "error"); return; }
        if ((snapshot.unreadableOrderCount ?? 0) > 0) { issues.add(productsFile, row.row, `order data unreadable (${snapshot.unreadableOrderCount} orders)`); rowStatus.set(key, "error"); return; }
        if (orderedProductIds.has(id)) { issues.add(productsFile, row.row, "This product has orders, so it can't be deleted. Set available to FALSE (it stays visible as SOLD OUT) instead."); rowStatus.set(key, "error"); return; }
        if (existing.product.available) { issues.add(productsFile, row.row, "Set available to FALSE in an earlier upload (or in admin) before deleting."); rowStatus.set(key, "error"); return; }
        products.delete(id);
        tupleRemove(tupleIndex, productTuple(existing.product), String(id));
        productRows.set(id, { row, action: "delete", previous: existing.product, fields: { name: { oldValue: existing.product.name, newValue: "DELETE" } } });
        rowStatus.set(key, "changed");
        return;
      }
      if (!existing && id !== null) { issues.add(productsFile, row.row, "product id does not exist"); rowStatus.set(key, "error"); return; }
      if (!existing) {
        const required = ["name", "category", "price", "unit", "available", "visibility"];
        required.forEach((field) => { if (!present(productsFile, field) || normaliseText(row.values[field]) === "") issues.add(productsFile, row.row, `${field} is required for a new product`); });
        const name = normaliseText(row.values.name);
        const cut = present(productsFile, "cut") ? normaliseText(row.values.cut) : "";
        const category = normaliseText(row.values.category);
        const price = parseDecimal(row.values.price, 99_999_999.99, 2);
        const powerDropPrice = present(productsFile, "powerDropPrice") ? nullableText(row.values.powerDropPrice) : null;
        const retailPrice = present(productsFile, "retailPrice") ? nullableText(row.values.retailPrice) : null;
        const unit = normaliseText(row.values.unit);
        const badge = present(productsFile, "badge") ? nullableText(row.values.badge) : null;
        const available = parseBoolean(row.values.available);
        const visibility = normaliseText(row.values.visibility);
        const stockLimit = present(productsFile, "stockLimit") ? nullableText(row.values.stockLimit) : null;
        const sortOrder = !present(productsFile, "sortOrder") || normaliseText(row.values.sortOrder) === "" ? nextProductSort++ : parseNonNegativeInteger(row.values.sortOrder);
        const img = present(productsFile, "img") ? nullableText(row.values.img) : null;
        const description = present(productsFile, "description") ? nullableText(row.values.description) : null;
        if (name.length > 255) issues.add(productsFile, row.row, "name must be at most 255 characters");
        if (cut.length > 255) issues.add(productsFile, row.row, "cut must be at most 255 characters");
        if (unit.length > 64) issues.add(productsFile, row.row, "unit must be at most 64 characters");
        if (!price) issues.add(productsFile, row.row, "price must be a valid decimal number up to 99999999.99");
        if (powerDropPrice !== null && !parseDecimal(powerDropPrice, 99_999_999.99, 2)) issues.add(productsFile, row.row, "powerDropPrice must be a valid decimal number up to 99999999.99");
        if (retailPrice !== null && !parseDecimal(retailPrice, 99_999_999.99, 2)) issues.add(productsFile, row.row, "retailPrice must be a valid decimal number up to 99999999.99");
        if (stockLimit !== null && !parseDecimal(stockLimit, 9_999_999.999, 3)) issues.add(productsFile, row.row, "stockLimit must be a valid decimal number up to 9999999.999");
        if (badge !== null && !BADGE_VALUES.has(badge)) issues.add(productsFile, row.row, "badge must be LIMITED, POPULAR, NEW, or SOLD OUT");
        if (available === null) issues.add(productsFile, row.row, "available must be TRUE or FALSE");
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) issues.add(productsFile, row.row, "visibility must be regular_only, always, or power_drop_only");
        if (!categories.has(category) || deletedCategorySlugs.has(category)) issues.add(productsFile, row.row, "category must be an existing, non-deleted category slug");
        if (sortOrder === null || sortOrder > MAX_SORT_ORDER) sortOrderError(issues, productsFile, row.row);
        if (exceedsTextBytes(description)) issues.add(productsFile, row.row, "description must be at most 65535 bytes in UTF-8");
        if (exceedsTextBytes(img)) issues.add(productsFile, row.row, "img must be at most 65535 bytes in UTF-8");
        if (issues.has(productsFile, row.row)) { rowStatus.set(key, "error"); return; }
        const candidate: CatalogProductSnapshot = {
          id: -row.row, name, cut, category, description, price: price!, powerDropPrice, retailPrice, unit,
          badge: badge as CatalogProductSnapshot["badge"], available: available!, visibility: visibility as VisibilityMode,
          stockLimit, sortOrder: sortOrder!, img, updatedAt: new Date(0),
        };
        const tuple = productTuple(candidate);
        const duplicate = tupleIndex.get(tuple);
        if (duplicate && duplicate.size > 0) {
          const other = Array.from(duplicate.values())[0];
          issues.add(productsFile, row.row, `product already exists: ${other.startsWith("new:") ? `row ${other.slice(4)}` : other}`);
          rowStatus.set(key, "error");
          return;
        }
        products.set(candidate.id, { product: candidate, row, action: "create" });
        tupleAdd(tupleIndex, tuple, `new:${row.row}`);
        productRows.set(`new:${row.row}`, { row, action: "create", candidate, fields: allCreateFields(candidate as unknown as Record<string, unknown>, PRODUCT_FIELDS) });
        rowStatus.set(key, "changed");
        return;
      }

      const previous = existing.product;
      const candidate = copyProduct(previous);
      PRODUCT_FIELDS.forEach((field) => {
        if (!present(productsFile, field)) return;
        const raw = normaliseText(row.values[field]);
        if (PRODUCT_NULLABLE.has(field as NullableProductField)) (candidate as unknown as Record<string, unknown>)[field] = raw === "" ? null : raw;
        else if (field === "available") {
          const parsed = parseBoolean(raw);
          if (parsed === null) issues.add(productsFile, row.row, "available must be TRUE or FALSE");
          else candidate.available = parsed;
        } else if (field === "visibility") candidate.visibility = raw as VisibilityMode;
        else if (field === "sortOrder") candidate.sortOrder = raw === "" ? 0 : (parseNonNegativeInteger(raw) ?? -1);
        else (candidate as unknown as Record<string, unknown>)[field] = raw;
      });
      const fields = changedFields(previous as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, PRODUCT_FIELDS);
      Object.keys(fields).forEach((field) => {
        const value = (candidate as unknown as Record<string, unknown>)[field];
        if (field === "name" && (!normaliseText(value) || normaliseText(value).length > 255)) issues.add(productsFile, row.row, "name is required and must be at most 255 characters");
        if (field === "cut" && normaliseText(value).length > 255) issues.add(productsFile, row.row, "cut must be at most 255 characters");
        if (field === "unit" && (!normaliseText(value) || normaliseText(value).length > 64)) issues.add(productsFile, row.row, "unit is required and must be at most 64 characters");
        if (field === "category" && (!normaliseText(value) || !categories.has(normaliseText(value)) || deletedCategorySlugs.has(normaliseText(value)))) issues.add(productsFile, row.row, "category must be an existing, non-deleted category slug");
        if (field === "price" && !parseDecimal(String(value), 99_999_999.99, 2)) issues.add(productsFile, row.row, "price must be a valid decimal number up to 99999999.99");
        if (["powerDropPrice", "retailPrice"].includes(field) && value !== null && !parseDecimal(String(value), 99_999_999.99, 2)) issues.add(productsFile, row.row, `${field} must be a valid decimal number up to 99999999.99`);
        if (field === "stockLimit" && value !== null && !parseDecimal(String(value), 9_999_999.999, 3)) issues.add(productsFile, row.row, "stockLimit must be a valid decimal number up to 9999999.999");
        if (field === "badge" && value !== null && !BADGE_VALUES.has(String(value))) issues.add(productsFile, row.row, "badge must be LIMITED, POPULAR, NEW, or SOLD OUT");
        if (field === "visibility" && !VISIBILITY_VALUES.has(value as VisibilityMode)) issues.add(productsFile, row.row, "visibility must be regular_only, always, or power_drop_only");
        if (field === "sortOrder" && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > MAX_SORT_ORDER)) sortOrderError(issues, productsFile, row.row);
        if (field === "description" && exceedsTextBytes(value as string | null)) issues.add(productsFile, row.row, "description must be at most 65535 bytes in UTF-8");
        if (field === "img" && exceedsTextBytes(value as string | null)) issues.add(productsFile, row.row, "img must be at most 65535 bytes in UTF-8");
      });
      if (issues.has(productsFile, row.row) || checkConflict(productsFile, row, previous, Object.keys(fields).length > 0, issues, conflicts, warnings, restoreMode)) {
        rowStatus.set(key, issues.has(productsFile, row.row) ? "error" : "conflict");
        return;
      }
      const previousTuple = productTuple(previous);
      const nextTuple = productTuple(candidate);
      if (previousTuple !== nextTuple) {
        tupleRemove(tupleIndex, previousTuple, String(previous.id));
        const duplicate = tupleIndex.get(nextTuple);
        if (duplicate && duplicate.size > 0) {
          tupleAdd(tupleIndex, previousTuple, String(previous.id));
          const other = Array.from(duplicate.values())[0];
          issues.add(productsFile, row.row, `product name + cut + category already exists: ${other.startsWith("new:") ? `row ${other.slice(4)}` : other}`);
          rowStatus.set(key, "error");
          return;
        }
        tupleAdd(tupleIndex, nextTuple, String(previous.id));
      }
      products.set(previous.id, { product: candidate, row, action: "update" });
      productRows.set(previous.id, { row, action: "update", previous, candidate, fields });
      rowStatus.set(key, Object.keys(fields).length ? "changed" : "unchanged");
    });
  }

  // A category delete only survives when no final product still references it.
  Array.from(deletedCategorySlugs).forEach((slug) => {
    const used = Array.from(products.values()).some((entry) => entry.product.category === slug);
    if (!used) return;
    const attempted = categoryRows.get(slug);
    if (attempted && categoriesFile) {
      issues.add(categoriesFile, attempted.row.row, `category cannot be deleted while products use ${slug}`);
      rowStatus.set(statusKey(categoriesFile, attempted.row), "error");
    }
    const initial = initialCategories.get(slug);
    if (initial) categories.set(slug, {
      id: initial.id, slug: initial.slug, name: initial.name, powerDropName: initial.powerDropName, emoji: initial.emoji,
      section: sectionRefForId(initial.sectionId), visibility: initial.visibility, sortOrder: initial.sortOrder, initial: copyCategory(initial), changedName: false,
    });
    deletedCategorySlugs.delete(slug);
    categoryRows.delete(slug);
  });

  // A section delete unassigns categories that still point at that deleted id. This merges with any ordinary category edit.
  Array.from(categories.values()).forEach((category) => {
    if (!category.section || !("existingId" in category.section) || !deletedSectionIds.has(category.section.existingId)) return;
    const previousSection = category.section;
    category.section = null;
    const existingRow = categoryRows.get(category.slug);
    const sectionChange: ChangeFields = { section: { oldValue: referenceDisplay(previousSection, initialSectionsToEntries(initialSections), new Map()), newValue: null } };
    if (existingRow && existingRow.action === "update") {
      existingRow.fields = { ...existingRow.fields, ...sectionChange };
      existingRow.section = null;
      existingRow.candidate = category;
    } else {
      categoryRows.set(category.slug, { row: { row: 0, values: {} }, action: "update", previous: category, candidate: category, fields: sectionChange, set: {}, section: null });
    }
  });

  // Convert accepted section rows into operation drafts.
  Array.from(sectionRows.entries()).forEach(([identifier, entry]) => {
    if (typeof identifier === "number" && !sections.has(identifier) && entry.action !== "delete") return;
    if (entry.action === "delete") {
      const previous = entry.previous!;
      addDraft(drafts, { action: "delete", target: sectionTarget(previous.id), file: sectionsFile?.filename ?? "sections.csv", row: entry.row.row, fields: entry.fields, operation: { kind: "deleteSection", target: sectionTarget(previous.id), id: previous.id } });
      return;
    }
    if (entry.action === "create" && entry.candidate?.key) {
      const section = entry.candidate;
      const key = section.key;
      if (!key) return;
      addDraft(drafts, { action: "create", target: newSectionTarget(key), file: sectionsFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "createSection", target: newSectionTarget(key), key, name: section.name, sortOrder: section.sortOrder } });
      return;
    }
    if (entry.action === "update" && entry.previous && entry.candidate && Object.keys(entry.fields).length > 0) {
      const set: UpdateSectionOperation["set"] = {};
      if (entry.fields.name) set.name = entry.candidate.name;
      if (entry.fields.sortOrder) set.sortOrder = entry.candidate.sortOrder;
      addDraft(drafts, { action: "update", target: sectionTarget(entry.previous.id), file: sectionsFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "updateSection", target: sectionTarget(entry.previous.id), id: entry.previous.id, set } });
    }
  });

  // Convert category rows and automatic unassignments into merged operation drafts.
  Array.from(categoryRows.entries()).forEach(([slug, entry]) => {
    if (entry.action === "delete") {
      if (deletedCategorySlugs.has(slug) && entry.previous) addDraft(drafts, { action: "delete", target: categoryTarget(slug), file: categoriesFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "deleteCategory", target: categoryTarget(slug), slug } });
      return;
    }
    const category = categories.get(slug);
    if (!category) return;
    if (entry.action === "create") {
      const fields = entry.fields;
      addDraft(drafts, {
        action: "create", target: categoryTarget(slug), file: categoriesFile!.filename, row: entry.row.row, fields,
        operation: { kind: "createCategory", target: categoryTarget(slug), slug, name: category.name, powerDropName: category.powerDropName, emoji: category.emoji, visibility: category.visibility, sortOrder: category.sortOrder, section: category.section },
      });
      return;
    }
    if (Object.keys(entry.fields).length > 0) mergeCategoryUpdateDraft(drafts, category, entry.row.row ? categoriesFile?.filename ?? "categories.csv" : sectionsFile?.filename ?? "sections.csv", entry.row.row, entry.fields, entry.set, entry.section);
  });

  // Convert products after final category validation.
  Array.from(productRows.entries()).forEach(([identifier, entry]) => {
    if (entry.action === "delete" && entry.previous) {
      addDraft(drafts, { action: "delete", target: productTarget(entry.previous.id), file: productsFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "deleteProduct", target: productTarget(entry.previous.id), id: entry.previous.id } });
      return;
    }
    if (entry.action === "create" && entry.candidate) {
      const product = entry.candidate;
      const target = newProductTarget(entry.row.row);
      addDraft(drafts, { action: "create", target, file: productsFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "createProduct", target, name: product.name, cut: product.cut, category: product.category, description: product.description, price: product.price, powerDropPrice: product.powerDropPrice, retailPrice: product.retailPrice, unit: product.unit, badge: product.badge, available: product.available, visibility: product.visibility, stockLimit: product.stockLimit, sortOrder: product.sortOrder, img: product.img } });
      return;
    }
    if (entry.action === "update" && entry.previous && entry.candidate && Object.keys(entry.fields).length > 0) {
      const set: UpdateProductOperation["set"] = {};
      PRODUCT_FIELDS.forEach((field) => { if (entry.fields[field]) (set as Record<string, unknown>)[field] = entry.candidate![field]; });
      addDraft(drafts, { action: "update", target: productTarget(entry.previous.id), file: productsFile!.filename, row: entry.row.row, fields: entry.fields, operation: { kind: "updateProduct", target: productTarget(entry.previous.id), id: entry.previous.id, set } });
    }
  });

  // Warnings that depend on final product category assignments happen only after product planning.
  Array.from(drafts.values()).forEach((draft) => {
    const operation = draft.operation;
    if (operation.kind !== "updateCategory" || !operation.set.visibility) return;
    const count = Array.from(products.values()).filter((entry) => entry.product.category === operation.slug).length;
    warnings.push(`category visibility change: ${operation.slug} affects all ${count} products in this category`);
  });
  const changedUnavailable = Array.from(drafts.values()).filter((draft) => draft.operation.kind === "updateProduct" && draft.operation.set.available === false && draft.fields.available?.oldValue === true).length;
  if (changedUnavailable > 20) warnings.push(`${changedUnavailable} products made unavailable`);
  Array.from(drafts.values()).forEach((draft) => {
    const operation = draft.operation;
    if (operation.kind !== "updateProduct") return;
    (["stockLimit", "img", "powerDropPrice", "retailPrice"] as const).forEach((field) => {
      if (draft.fields[field]?.newValue === null) warnings.push(`cleared ${field}: product ${operation.id}`);
    });
    if (draft.fields.name) warnings.push(`product name change: ${operation.id} (${draft.fields.name.oldValue} → ${draft.fields.name.newValue}) — historic analytics look up category by product name`);
  });

  const beforeVisible = countVisibleAvailable(snapshot.products, snapshot.categories);
  const afterVisible = countVisibleAvailable(Array.from(products.values()).map((entry) => entry.product), categories.values());
  if (afterVisible === 0) blockers.push("Storefront safety blocker: zero available products would be visible in Regular mode");

  const operationDrafts = Array.from(drafts.values()).sort((left, right) => left.target.localeCompare(right.target));
  const operations = operationDrafts.map((draft) => draft.operation);
  const changes = operationDrafts.flatMap((draft) => Object.entries(draft.fields).map(([field, value]) => ({
    action: draft.action, item: draft.target, file: draft.file, row: draft.row, field, oldValue: value.oldValue, newValue: value.newValue,
  })));
  const unchanged = Array.from(rowStatus.values()).filter((status) => status === "unchanged").length;
  const canonical = { operations: operations.map(stableJson).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))), restoreMode };
  const planHash = createHash("sha256").update(JSON.stringify(stableJson(canonical))).digest("hex");
  const creates = operationDrafts.filter((draft) => draft.action === "create").length;
  const updates = operationDrafts.filter((draft) => draft.action === "update").length;
  const deletes = operationDrafts.filter((draft) => draft.action === "delete").length;

  return { creates, updates, deletes, unchanged, conflicts, errors: issues.errors, warnings, blockers, changes, operations, safety: { visibleAvailableBefore: beforeVisible, visibleAvailableAfter: afterVisible }, planHash };
}

function initialSectionsToEntries(initial: Map<number, CatalogSectionSnapshot>): Map<number, SectionEntry> {
  return new Map(Array.from(initial.entries()).map(([id, section]) => [id, {
    ref: { existingId: id }, id, name: section.name, sortOrder: section.sortOrder, initial: section, changedName: false,
  }]));
}
