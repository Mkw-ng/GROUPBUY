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
  item: string;
  file: string;
  row: number;
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

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

interface PlannedOperation {
  action: CatalogAction;
  entity: CatalogFileType;
  target: string;
  file: string;
  row: number;
  fields: Record<string, { oldValue: string | number | boolean | null; newValue: string | number | boolean | null }>;
}

const VISIBILITY_VALUES = new Set<VisibilityMode>(["regular_only", "always", "power_drop_only"]);
const BADGE_VALUES = new Set(["LIMITED", "POPULAR", "NEW", "SOLD OUT"]);
const PRODUCT_NUMERIC_FIELDS = new Set(["price", "powerDropPrice", "retailPrice", "stockLimit"]);
const PRODUCT_TEXT_FIELDS = new Set(["name", "cut", "category", "description", "unit", "badge", "img"]);

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
  const normalized = normaliseText(value);
  return normalized === "" ? null : normalized;
}

function displayValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" ? normaliseText(value) : value as number | boolean;
}

function asDate(value: Date | string | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wholeSecond(value: Date | string | undefined): number | null {
  const date = asDate(value);
  return date ? Math.floor(date.getTime() / 1000) : null;
}

function utcIso(value: Date | string | undefined): string {
  const date = asDate(value);
  return date ? date.toISOString().replace(/\.\d{3}Z$/, "Z") : "";
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value).replace(/\r\n|\r|\n/g, "\r\n");
  return `"${text.replace(/"/g, '""')}"`;
}

/** Detects the catalog file family from its filename. */
export function detectCatalogFileType(filename: string): CatalogFileType | null {
  const matches = (["sections", "categories", "products"] as const)
    .filter((type) => filename.toLocaleLowerCase().includes(type));
  return matches.length === 1 ? matches[0] : null;
}

/** CSV reader that supports BOM, CRLF, LF, lone CR, quotes and quoted line breaks. */
export function parseCatalogCsv(filename: string, raw: string): ParsedCatalogFile {
  const type = detectCatalogFileType(filename);
  const source = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      continue;
    }
    cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const errors: CatalogIssue[] = [];
  if (!type) {
    errors.push({ file: filename, row: 1, message: `unrecognised catalog file: ${filename}` });
    return { filename, type: null, headers: [], rows: [], errors };
  }
  if (rows.length === 0) {
    errors.push({ file: filename, row: 1, message: "CSV file is empty" });
    return { filename, type, headers: [], rows: [], errors };
  }

  const headers = rows[0].map((header) => normaliseText(header));
  const allowed = new Set(headersFor(type));
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (!allowed.has(header)) errors.push({ file: filename, row: 1, message: `unknown header: ${header || "(blank)"}` });
    if (seenHeaders.has(header)) errors.push({ file: filename, row: 1, message: `duplicate header: ${header || "(blank)"}` });
    seenHeaders.add(header);
  }

  const key = type === "categories" ? "slug" : "id";
  if (!seenHeaders.has(key)) errors.push({ file: filename, row: 1, message: `missing key column: ${key}` });

  const parsedRows: CsvRow[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const cells = rows[index];
    if (cells.every((value) => normaliseText(value) === "")) continue;
    const values: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      if (header) values[header] = cells[cellIndex] ?? "";
    });
    parsedRows.push({ row: index + 1, values });
  }

  return { filename, type, headers, rows: parsedRows, errors };
}

/** Parses every uploaded file and catches duplicate/misnamed file families before planning. */
export function parseCatalogFiles(files: Array<{ filename: string; text: string }>): ParsedCatalogFile[] {
  const parsed = files.map((file) => parseCatalogCsv(file.filename, file.text));
  const byType = new Map<CatalogFileType, ParsedCatalogFile[]>();
  for (const file of parsed) {
    if (!file.type) continue;
    const group = byType.get(file.type) ?? [];
    group.push(file);
    byType.set(file.type, group);
  }
  for (const group of Array.from(byType.values())) {
    if (group.length < 2) continue;
    const names = group.map((file) => file.filename).join(", ");
    for (const file of group) file.errors.push({ file: file.filename, row: 1, message: `two files of the same type: ${names}` });
  }
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
    "sections.csv": exportCatalogRows(SECTION_HEADERS, sections.map((section) => [
      section.id, section.name, section.sortOrder, utcIso(section.updatedAt), "",
    ])),
    "categories.csv": exportCatalogRows(CATEGORY_HEADERS, categories.map((category) => [
      category.slug,
      category.name,
      category.powerDropName,
      category.emoji,
      category.sectionId == null ? "" : sectionById.get(category.sectionId)?.name ?? "",
      category.visibility,
      category.sortOrder,
      utcIso(category.updatedAt),
      "",
    ])),
    "products.csv": exportCatalogRows(PRODUCT_HEADERS, products.map((product) => [
      product.id,
      product.name,
      product.cut,
      product.category,
      product.description,
      product.price,
      product.powerDropPrice,
      product.retailPrice,
      product.unit,
      product.badge,
      product.available ? "TRUE" : "FALSE",
      product.visibility,
      product.stockLimit,
      product.sortOrder,
      product.img,
      utcIso(product.updatedAt),
      "",
    ])),
  };
}

function issue(file: ParsedCatalogFile, row: number, message: string): CatalogIssue {
  return { file: file.filename, row, message };
}

function parseAction(file: ParsedCatalogFile, row: CsvRow, errors: CatalogIssue[]): "" | "delete" {
  if (!file.headers.includes("action")) return "";
  const action = lower(row.values.action);
  if (action === "" || action === "delete") return action;
  errors.push(issue(file, row.row, "action must be blank or delete"));
  return "";
}

function parsePositiveInteger(value: string): number | null {
  const text = normaliseText(value);
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function parseNonNegativeInteger(value: string): number | null {
  const text = normaliseText(value);
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}

function parseBoolean(value: string): boolean | null {
  const normalized = lower(value);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function parseDecimal(value: string, max: number, decimals: number): string | null {
  const text = normaliseText(value);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number <= max ? text : null;
}

function equalDecimal(left: unknown, right: unknown): boolean {
  const a = nullableText(left);
  const b = nullableText(right);
  if (a === null || b === null) return a === b;
  return Number(a) === Number(b);
}

function equalValue(field: string, left: unknown, right: unknown): boolean {
  if (PRODUCT_NUMERIC_FIELDS.has(field)) return equalDecimal(left, right);
  if (field === "available") return Boolean(left) === Boolean(right);
  if (field === "sortOrder" || field === "sectionId") return Number(left ?? 0) === Number(right ?? 0);
  return normaliseText(left) === normaliseText(right);
}

function validateUpdatedAt(file: ParsedCatalogFile, row: CsvRow, current: { updatedAt: Date | string }, errors: CatalogIssue[]): number | null | undefined {
  if (!file.headers.includes("updatedAt")) return undefined;
  const value = normaliseText(row.values.updatedAt);
  const parsed = /^\d{4}-\d{2}-\d{2}T/.test(value) ? asDate(value) : null;
  if (!parsed) {
    errors.push(issue(file, row.row, "updatedAt must be an ISO date"));
    return null;
  }
  return wholeSecond(parsed);
}

function hasConflict(
  file: ParsedCatalogFile,
  row: CsvRow,
  current: { updatedAt: Date | string },
  changed: boolean,
  errors: CatalogIssue[],
  conflicts: CatalogIssue[],
): boolean {
  const fileTime = validateUpdatedAt(file, row, current, errors);
  if (fileTime === null) return true;
  if (!changed || fileTime === undefined) return false;
  const dbTime = wholeSecond(current.updatedAt);
  if (dbTime !== null && dbTime > fileTime) {
    conflicts.push(issue(file, row.row, "changed in admin since export: re-export and redo this edit"));
    return true;
  }
  return false;
}

function cloneSection(section: CatalogSectionSnapshot): CatalogSectionSnapshot {
  return { ...section };
}
function cloneCategory(category: CatalogCategorySnapshot): CatalogCategorySnapshot {
  return { ...category };
}
function cloneProduct(product: CatalogProductSnapshot): CatalogProductSnapshot {
  return { ...product };
}

function pushDuplicateKeyErrors(file: ParsedCatalogFile, key: string, errors: CatalogIssue[]): void {
  const groups = new Map<string, CsvRow[]>();
  for (const row of file.rows) {
    const value = normaliseText(row.values[key]);
    if (!value) continue;
    const normalized = key === "slug" ? lower(value) : value;
    const group = groups.get(normalized) ?? [];
    group.push(row);
    groups.set(normalized, group);
  }
  for (const [value, rows] of Array.from(groups.entries())) {
    if (rows.length > 1) rows.forEach((row) => errors.push(issue(file, row.row, `duplicate ${key}: ${value}`)));
  }
}

function rowHasError(errors: CatalogIssue[], file: ParsedCatalogFile, row: number): boolean {
  return errors.some((error) => error.file === file.filename && error.row === row);
}

function present(file: ParsedCatalogFile, field: string): boolean {
  return file.headers.includes(field);
}

function sectionTarget(section: CatalogSectionSnapshot): string {
  return `section:${section.id}`;
}
function categoryTarget(category: CatalogCategorySnapshot): string {
  return `category:${category.slug}`;
}
function productTarget(product: CatalogProductSnapshot): string {
  return `product:${product.id}`;
}

function operation(
  operations: PlannedOperation[],
  action: CatalogAction,
  entity: CatalogFileType,
  target: string,
  file: string,
  row: number,
  fields: PlannedOperation["fields"],
): void {
  if (action === "update" && Object.keys(fields).length === 0) return;
  operations.push({ action, entity, target, file, row, fields });
}

function sectionNameById(sections: Map<number, CatalogSectionSnapshot>, id: number | null): string {
  if (id == null) return "";
  return sections.get(id)?.name ?? "";
}

function resolveSection(
  file: ParsedCatalogFile,
  row: CsvRow,
  currentSectionId: number | null,
  sections: Map<number, CatalogSectionSnapshot>,
  deletedSectionIds: Set<number>,
  initialSections: Map<number, CatalogSectionSnapshot>,
  errors: CatalogIssue[],
): number | null | undefined {
  if (!present(file, "section")) return undefined;
  const supplied = normaliseText(row.values.section);
  const initial = currentSectionId == null ? undefined : initialSections.get(currentSectionId);
  const currentAfter = currentSectionId == null ? undefined : sections.get(currentSectionId);
  const currentName = currentAfter?.name ?? initial?.name ?? "";

  if (supplied === "") {
    if (currentSectionId == null || !sections.has(currentSectionId)) return currentSectionId;
    return null;
  }
  if (currentName && lower(supplied) === lower(currentName) && !deletedSectionIds.has(currentSectionId ?? -1)) {
    return currentSectionId;
  }

  const deletedMatches = Array.from(deletedSectionIds)
    .map((id) => initialSections.get(id))
    .filter((section): section is CatalogSectionSnapshot => Boolean(section))
    .filter((section) => lower(section.name) === lower(supplied));
  if (deletedMatches.length > 0) {
    errors.push(issue(file, row.row, `section is being deleted: ${deletedMatches.map((section) => section.id).join(", ")}`));
    return undefined;
  }

  const matches = Array.from(sections.values()).filter((section) => lower(section.name) === lower(supplied));
  if (matches.length === 0) {
    errors.push(issue(file, row.row, "unknown section name: renamed? Update this column or leave categories.csv out"));
    return undefined;
  }
  if (matches.length > 1) {
    errors.push(issue(file, row.row, `ambiguous section name: ${matches.map((section) => section.id).join(", ")}`));
    return undefined;
  }
  return matches[0].id;
}

function productTuple(product: Pick<CatalogProductSnapshot, "name" | "cut" | "category">): string {
  return [product.name, product.cut, product.category].map(lower).join("\u0000");
}

function countVisibleAvailable(products: Iterable<CatalogProductSnapshot>, categories: Iterable<CatalogCategorySnapshot>): number {
  const visibilityByCategory = new Map(Array.from(categories).map((category) => [category.slug, category.visibility]));
  return Array.from(products).filter((product) => {
    const categoryVisibility = visibilityByCategory.get(product.category) ?? "always";
    return product.available && isVisibleInMode(effectiveVisibility(product.visibility, categoryVisibility), false);
  }).length;
}

function fieldsFromObject(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): PlannedOperation["fields"] {
  const result: PlannedOperation["fields"] = {};
  for (const field of fields) {
    if (!equalValue(field, before[field], after[field])) {
      result[field] = { oldValue: displayValue(before[field]), newValue: displayValue(after[field]) };
    }
  }
  return result;
}

function validationError(file: ParsedCatalogFile, row: CsvRow, errors: CatalogIssue[], message: string): void {
  errors.push(issue(file, row.row, message));
}

/**
 * Validates uploaded catalog files and returns a deterministic, read-only plan.
 * This function is intentionally pure: its only inputs are parsed CSV text and a snapshot.
 */
export function validateAndPlan(parsedFiles: ParsedCatalogFile[], snapshot: CatalogSnapshot): CatalogPlan {
  const errors: CatalogIssue[] = parsedFiles.flatMap((file) => file.errors);
  const conflicts: CatalogIssue[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];
  const operations: PlannedOperation[] = [];
  const rowStatus = new Map<string, "changed" | "unchanged" | "error" | "conflict">();
  const initialSections = new Map(snapshot.sections.map((section) => [section.id, cloneSection(section)]));
  const sections = new Map(snapshot.sections.map((section) => [section.id, cloneSection(section)]));
  const categories = new Map(snapshot.categories.map((category) => [category.slug, cloneCategory(category)]));
  const products = new Map(snapshot.products.map((product) => [product.id, cloneProduct(product)]));
  const deletedSections = new Set<number>();
  const deletedCategories = new Set<string>();
  const deletedProducts = new Set<number>();
  let nextSectionId = Math.max(0, ...snapshot.sections.map((section) => section.id)) + 1;
  let nextCategoryId = Math.max(0, ...snapshot.categories.map((category) => category.id)) + 1;
  let nextProductId = Math.max(0, ...snapshot.products.map((product) => product.id)) + 1;
  let nextSectionSort = Math.max(-1, ...snapshot.sections.map((section) => section.sortOrder)) + 1;
  let nextCategorySort = Math.max(-1, ...snapshot.categories.map((category) => category.sortOrder)) + 1;
  let nextProductSort = Math.max(-1, ...snapshot.products.map((product) => product.sortOrder)) + 1;

  const fileByType = new Map<CatalogFileType, ParsedCatalogFile>();
  for (const file of parsedFiles) {
    if (file.type && !file.errors.some((error) => /two files of the same type/.test(error.message))) fileByType.set(file.type, file);
  }
  for (const file of parsedFiles) {
    if (!file.type) continue;
    pushDuplicateKeyErrors(file, file.type === "categories" ? "slug" : "id", errors);
  }

  const sectionsFile = fileByType.get("sections");
  const requestedDeletedSectionNames = new Set(
    (sectionsFile?.rows ?? [])
      .filter((row) => lower(row.values.action) === "delete")
      .map((row) => parsePositiveInteger(normaliseText(row.values.id)))
      .filter((id): id is number => id !== null)
      .map((id) => initialSections.get(id))
      .filter((section): section is CatalogSectionSnapshot => Boolean(section))
      .map((section) => lower(section.name)),
  );
  if (sectionsFile && sectionsFile.errors.length === 0) {
    for (const row of sectionsFile.rows) {
      const statusKey = `${sectionsFile.filename}:${row.row}`;
      const action = parseAction(sectionsFile, row, errors);
      const rawId = normaliseText(row.values.id);
      const id = rawId === "" ? null : parsePositiveInteger(rawId);
      if (rawId !== "" && id === null) validationError(sectionsFile, row, errors, "id must be a positive integer");
      if (rowHasError(errors, sectionsFile, row.row)) { rowStatus.set(statusKey, "error"); continue; }
      if (action === "delete") {
        if (id === null || !sections.has(id)) {
          validationError(sectionsFile, row, errors, "section id does not exist");
          rowStatus.set(statusKey, "error");
          continue;
        }
        const existing = sections.get(id)!;
        sections.delete(id);
        deletedSections.add(id);
        operation(operations, "delete", "sections", sectionTarget(existing), sectionsFile.filename, row.row, {});
        rowStatus.set(statusKey, "changed");
        continue;
      }
      if (id === null) {
        if (!present(sectionsFile, "name") || normaliseText(row.values.name) === "") validationError(sectionsFile, row, errors, "name is required for a new section");
        const name = normaliseText(row.values.name);
        if (name.length > 64) validationError(sectionsFile, row, errors, "name must be at most 64 characters");
        const sortOrder = !present(sectionsFile, "sortOrder") || normaliseText(row.values.sortOrder) === ""
          ? nextSectionSort++
          : parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) validationError(sectionsFile, row, errors, "sortOrder must be an integer of 0 or more");
        if (rowHasError(errors, sectionsFile, row.row)) { rowStatus.set(statusKey, "error"); continue; }
        const section: CatalogSectionSnapshot = { id: nextSectionId++, name, sortOrder: sortOrder!, updatedAt: new Date(0) };
        if (requestedDeletedSectionNames.has(lower(name))) {
          validationError(sectionsFile, row, errors, `section name is both deleted and created: ${name}`);
          rowStatus.set(statusKey, "error");
          continue;
        }
        const duplicate = Array.from(sections.values()).find((candidate) => lower(candidate.name) === lower(name));
        if (duplicate) {
          validationError(sectionsFile, row, errors, `section name already exists: ${duplicate.id}`);
          rowStatus.set(statusKey, "error");
          continue;
        }
        sections.set(section.id, section);
        operation(operations, "create", "sections", `section:new:${lower(name)}`, sectionsFile.filename, row.row, fieldsFromObject({}, section as unknown as Record<string, unknown>, ["name", "sortOrder"]));
        rowStatus.set(statusKey, "changed");
        continue;
      }

      const existing = sections.get(id);
      if (!existing) { validationError(sectionsFile, row, errors, "section id does not exist"); rowStatus.set(statusKey, "error"); continue; }
      const candidate = cloneSection(existing);
      if (present(sectionsFile, "name")) {
        const name = normaliseText(row.values.name);
        if (name === "") validationError(sectionsFile, row, errors, "name is required");
        else if (name.length > 64) validationError(sectionsFile, row, errors, "name must be at most 64 characters");
        else candidate.name = name;
      }
      if (present(sectionsFile, "sortOrder")) {
        const sortOrder = parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) validationError(sectionsFile, row, errors, "sortOrder must be an integer of 0 or more");
        else candidate.sortOrder = sortOrder;
      }
      const fields = fieldsFromObject(existing as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["name", "sortOrder"]);
      if (rowHasError(errors, sectionsFile, row.row) || hasConflict(sectionsFile, row, existing, Object.keys(fields).length > 0, errors, conflicts)) {
        rowStatus.set(statusKey, rowHasError(errors, sectionsFile, row.row) ? "error" : "conflict");
        continue;
      }
      const duplicate = Object.keys(fields).includes("name") && Array.from(sections.values()).some((section) => section.id !== id && lower(section.name) === lower(candidate.name));
      if (duplicate) { validationError(sectionsFile, row, errors, "section name already exists"); rowStatus.set(statusKey, "error"); continue; }
      sections.set(id, candidate);
      operation(operations, "update", "sections", sectionTarget(existing), sectionsFile.filename, row.row, fields);
      rowStatus.set(statusKey, Object.keys(fields).length ? "changed" : "unchanged");
    }
  }

  const categoriesFile = fileByType.get("categories");
  if (categoriesFile && categoriesFile.errors.length === 0) {
    for (const row of categoriesFile.rows) {
      const statusKey = `${categoriesFile.filename}:${row.row}`;
      const action = parseAction(categoriesFile, row, errors);
      const slug = normaliseText(row.values.slug);
      if (!slug) validationError(categoriesFile, row, errors, "slug is required");
      if (rowHasError(errors, categoriesFile, row.row)) { rowStatus.set(statusKey, "error"); continue; }
      const existing = categories.get(slug);
      if (action === "delete") {
        if (!existing) { validationError(categoriesFile, row, errors, "category slug does not exist"); rowStatus.set(statusKey, "error"); continue; }
        categories.delete(slug);
        deletedCategories.add(slug);
        operation(operations, "delete", "categories", categoryTarget(existing), categoriesFile.filename, row.row, {});
        rowStatus.set(statusKey, "changed");
        continue;
      }
      if (!existing) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug === "all" || slug.length > 64) validationError(categoriesFile, row, errors, "slug must match ^[a-z0-9]+(-[a-z0-9]+)*$, be at most 64 characters, and not be all");
        if (!present(categoriesFile, "name") || normaliseText(row.values.name) === "") validationError(categoriesFile, row, errors, "name is required for a new category");
        const name = normaliseText(row.values.name);
        if (name.length > 64) validationError(categoriesFile, row, errors, "name must be at most 64 characters");
        const visibility = present(categoriesFile, "visibility") ? normaliseText(row.values.visibility) : "always";
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) validationError(categoriesFile, row, errors, "visibility must be regular_only, always, or power_drop_only");
        const sortOrder = !present(categoriesFile, "sortOrder") || normaliseText(row.values.sortOrder) === "" ? nextCategorySort++ : parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) validationError(categoriesFile, row, errors, "sortOrder must be an integer of 0 or more");
        const powerDropName = present(categoriesFile, "powerDropName") ? nullableText(row.values.powerDropName) : null;
        const emoji = present(categoriesFile, "emoji") ? nullableText(row.values.emoji) : null;
        if ((powerDropName?.length ?? 0) > 64) validationError(categoriesFile, row, errors, "powerDropName must be at most 64 characters");
        if ((emoji?.length ?? 0) > 16) validationError(categoriesFile, row, errors, "emoji must be at most 16 characters");
        const sectionId = resolveSection(categoriesFile, row, null, sections, deletedSections, initialSections, errors);
        if (rowHasError(errors, categoriesFile, row.row) || sectionId === undefined) { rowStatus.set(statusKey, "error"); continue; }
        const duplicateName = Array.from(categories.values()).find((category) => lower(category.name) === lower(name));
        if (duplicateName) { validationError(categoriesFile, row, errors, `category name already exists: ${duplicateName.slug}`); rowStatus.set(statusKey, "error"); continue; }
        const category: CatalogCategorySnapshot = {
          id: nextCategoryId++, slug, name, powerDropName, emoji, sectionId,
          visibility: visibility as VisibilityMode, sortOrder: sortOrder!, updatedAt: new Date(0),
        };
        categories.set(slug, category);
        const createFields = fieldsFromObject({}, category as unknown as Record<string, unknown>, ["slug", "name", "powerDropName", "emoji", "sectionId", "visibility", "sortOrder"]);
        if (createFields.sectionId) {
          delete createFields.sectionId;
          createFields.section = { oldValue: null, newValue: sectionNameById(sections, category.sectionId) || null };
        }
        operation(operations, "create", "categories", categoryTarget(category), categoriesFile.filename, row.row, createFields);
        rowStatus.set(statusKey, "changed");
        continue;
      }

      const candidate = cloneCategory(existing);
      if (present(categoriesFile, "name")) {
        const name = normaliseText(row.values.name);
        if (!name) validationError(categoriesFile, row, errors, "name is required");
        else if (name.length > 64) validationError(categoriesFile, row, errors, "name must be at most 64 characters");
        else candidate.name = name;
      }
      if (present(categoriesFile, "powerDropName")) {
        candidate.powerDropName = nullableText(row.values.powerDropName);
        if ((candidate.powerDropName?.length ?? 0) > 64) validationError(categoriesFile, row, errors, "powerDropName must be at most 64 characters");
      }
      if (present(categoriesFile, "emoji")) {
        candidate.emoji = nullableText(row.values.emoji);
        if ((candidate.emoji?.length ?? 0) > 16) validationError(categoriesFile, row, errors, "emoji must be at most 16 characters");
      }
      if (present(categoriesFile, "visibility")) {
        const visibility = normaliseText(row.values.visibility);
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) validationError(categoriesFile, row, errors, "visibility must be regular_only, always, or power_drop_only");
        else candidate.visibility = visibility as VisibilityMode;
      }
      if (present(categoriesFile, "sortOrder")) {
        const sortOrder = parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) validationError(categoriesFile, row, errors, "sortOrder must be an integer of 0 or more");
        else candidate.sortOrder = sortOrder;
      }
      const resolvedSection = resolveSection(categoriesFile, row, existing.sectionId, sections, deletedSections, initialSections, errors);
      if (resolvedSection !== undefined) candidate.sectionId = resolvedSection;
      const fields = fieldsFromObject(existing as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["name", "powerDropName", "emoji", "sectionId", "visibility", "sortOrder"]);
      if (fields.sectionId) {
        delete fields.sectionId;
        fields.section = {
          oldValue: sectionNameById(initialSections, existing.sectionId) || null,
          newValue: sectionNameById(sections, candidate.sectionId) || null,
        };
      }
      if (rowHasError(errors, categoriesFile, row.row) || hasConflict(categoriesFile, row, existing, Object.keys(fields).length > 0, errors, conflicts)) {
        rowStatus.set(statusKey, rowHasError(errors, categoriesFile, row.row) ? "error" : "conflict");
        continue;
      }
      const duplicateName = Object.keys(fields).includes("name") && Array.from(categories.values()).some((category) => category.slug !== slug && lower(category.name) === lower(candidate.name));
      if (duplicateName) { validationError(categoriesFile, row, errors, "category name already exists"); rowStatus.set(statusKey, "error"); continue; }
      categories.set(slug, candidate);
      operation(operations, "update", "categories", categoryTarget(existing), categoriesFile.filename, row.row, fields);
      if (fields.visibility) warnings.push(`category visibility change: ${slug} affects all ${Array.from(products.values()).filter((product) => product.category === slug).length} products in this category`);
      rowStatus.set(statusKey, Object.keys(fields).length ? "changed" : "unchanged");
    }
  }

  // Deleting a section unassigns every surviving category that points to it.
  for (const [slug, category] of Array.from(categories.entries())) {
    if (category.sectionId == null || !deletedSections.has(category.sectionId)) continue;
    const oldSection = sectionNameById(initialSections, category.sectionId);
    const updated = { ...category, sectionId: null };
    categories.set(slug, updated);
    operation(operations, "update", "categories", categoryTarget(category), sectionsFile?.filename ?? "sections.csv", 0, {
      section: { oldValue: oldSection || category.sectionId, newValue: null },
    });
  }

  const productsFile = fileByType.get("products");
  if (productsFile && productsFile.errors.length === 0) {
    const existingRows = productsFile.rows.filter((row) => normaliseText(row.values.id) !== "");
    const newRows = productsFile.rows.filter((row) => normaliseText(row.values.id) === "");
    for (const row of [...existingRows, ...newRows]) {
      const statusKey = `${productsFile.filename}:${row.row}`;
      const action = parseAction(productsFile, row, errors);
      const rawId = normaliseText(row.values.id);
      const id = rawId === "" ? null : parsePositiveInteger(rawId);
      if (rawId !== "" && id === null) validationError(productsFile, row, errors, "id must be a positive integer");
      if (rowHasError(errors, productsFile, row.row)) { rowStatus.set(statusKey, "error"); continue; }
      const existing = id === null ? undefined : products.get(id);
      if (action === "delete") {
        if (!existing) { validationError(productsFile, row, errors, "product id does not exist"); rowStatus.set(statusKey, "error"); continue; }
        if ((snapshot.unreadableOrderCount ?? 0) > 0) { validationError(productsFile, row, errors, `order data unreadable (${snapshot.unreadableOrderCount} orders)`); rowStatus.set(statusKey, "error"); continue; }
        const ordered = snapshot.orderedProductIds instanceof Set ? snapshot.orderedProductIds : new Set(snapshot.orderedProductIds);
        if (ordered.has(existing.id)) {
          validationError(productsFile, row, errors, "This product has orders, so it can't be deleted. Set available to FALSE (it stays visible as SOLD OUT) instead.");
          rowStatus.set(statusKey, "error");
          continue;
        }
        products.delete(existing.id);
        deletedProducts.add(existing.id);
        operation(operations, "delete", "products", productTarget(existing), productsFile.filename, row.row, {});
        rowStatus.set(statusKey, "changed");
        continue;
      }
      if (!existing && id !== null) { validationError(productsFile, row, errors, "product id does not exist"); rowStatus.set(statusKey, "error"); continue; }
      if (!existing) {
        const required = ["name", "category", "price", "unit", "available", "visibility"];
        for (const field of required) if (!present(productsFile, field) || normaliseText(row.values[field]) === "") validationError(productsFile, row, errors, `${field} is required for a new product`);
        const name = normaliseText(row.values.name);
        const cut = present(productsFile, "cut") ? normaliseText(row.values.cut) : "";
        const category = normaliseText(row.values.category);
        const price = parseDecimal(row.values.price, 99_999_999.99, 2);
        const unit = normaliseText(row.values.unit);
        const available = parseBoolean(row.values.available);
        const visibility = normaliseText(row.values.visibility);
        const powerDropPrice = present(productsFile, "powerDropPrice") ? nullableText(row.values.powerDropPrice) : null;
        const retailPrice = present(productsFile, "retailPrice") ? nullableText(row.values.retailPrice) : null;
        const stockLimit = present(productsFile, "stockLimit") ? nullableText(row.values.stockLimit) : null;
        const badge = present(productsFile, "badge") ? nullableText(row.values.badge) : null;
        const description = present(productsFile, "description") ? nullableText(row.values.description) : null;
        const img = present(productsFile, "img") ? nullableText(row.values.img) : null;
        if (name.length > 255) validationError(productsFile, row, errors, "name must be at most 255 characters");
        if (cut.length > 255) validationError(productsFile, row, errors, "cut must be at most 255 characters");
        if (unit.length > 64) validationError(productsFile, row, errors, "unit must be at most 64 characters");
        if (!price) validationError(productsFile, row, errors, "price must be a valid decimal number up to 99999999.99");
        if (powerDropPrice !== null && !parseDecimal(powerDropPrice, 99_999_999.99, 2)) validationError(productsFile, row, errors, "powerDropPrice must be a valid decimal number up to 99999999.99");
        if (retailPrice !== null && !parseDecimal(retailPrice, 99_999_999.99, 2)) validationError(productsFile, row, errors, "retailPrice must be a valid decimal number up to 99999999.99");
        if (stockLimit !== null && !parseDecimal(stockLimit, 9_999_999.999, 3)) validationError(productsFile, row, errors, "stockLimit must be a valid decimal number up to 9999999.999");
        if (badge !== null && !BADGE_VALUES.has(badge)) validationError(productsFile, row, errors, "badge must be LIMITED, POPULAR, NEW, or SOLD OUT");
        if (available === null) validationError(productsFile, row, errors, "available must be TRUE or FALSE");
        if (!VISIBILITY_VALUES.has(visibility as VisibilityMode)) validationError(productsFile, row, errors, "visibility must be regular_only, always, or power_drop_only");
        if (!categories.has(category) || deletedCategories.has(category)) validationError(productsFile, row, errors, "category must be an existing, non-deleted category slug");
        const sortOrder = !present(productsFile, "sortOrder") || normaliseText(row.values.sortOrder) === "" ? nextProductSort++ : parseNonNegativeInteger(row.values.sortOrder);
        if (sortOrder === null) validationError(productsFile, row, errors, "sortOrder must be an integer of 0 or more");
        if (rowHasError(errors, productsFile, row.row)) { rowStatus.set(statusKey, "error"); continue; }
        const candidate: CatalogProductSnapshot = {
          id: nextProductId++, name, cut, category, description, price: price!, powerDropPrice, retailPrice, unit,
          badge: badge as CatalogProductSnapshot["badge"], available: available!, visibility: visibility as VisibilityMode,
          stockLimit, sortOrder: sortOrder!, img, updatedAt: new Date(0),
        };
        const duplicate = Array.from(products.values()).find((product) => productTuple(product) === productTuple(candidate));
        if (duplicate) { validationError(productsFile, row, errors, `product already exists: ${duplicate.id}`); rowStatus.set(statusKey, "error"); continue; }
        products.set(candidate.id, candidate);
        operation(operations, "create", "products", `product:new:${row.row}`, productsFile.filename, row.row, fieldsFromObject({}, candidate as unknown as Record<string, unknown>, ["name", "cut", "category", "description", "price", "powerDropPrice", "retailPrice", "unit", "badge", "available", "visibility", "stockLimit", "sortOrder", "img"]));
        rowStatus.set(statusKey, "changed");
        continue;
      }

      const candidate = cloneProduct(existing);
      for (const field of Array.from(PRODUCT_TEXT_FIELDS)) {
        if (!present(productsFile, field)) continue;
        const raw = normaliseText(row.values[field]);
        if (["description", "powerDropPrice", "retailPrice", "badge", "stockLimit", "img"].includes(field)) {
          (candidate as unknown as Record<string, unknown>)[field] = raw === "" ? null : raw;
        } else {
          (candidate as unknown as Record<string, unknown>)[field] = raw;
        }
      }
      for (const field of ["price", "powerDropPrice", "retailPrice", "stockLimit"]) {
        if (!present(productsFile, field)) continue;
        const raw = normaliseText(row.values[field]);
        (candidate as unknown as Record<string, unknown>)[field] = field === "price" || raw !== "" ? raw : null;
      }
      if (present(productsFile, "available")) {
        const available = parseBoolean(row.values.available);
        if (available === null) validationError(productsFile, row, errors, "available must be TRUE or FALSE");
        else candidate.available = available;
      }
      if (present(productsFile, "visibility")) candidate.visibility = normaliseText(row.values.visibility) as VisibilityMode;
      if (present(productsFile, "sortOrder")) {
        const rawSort = normaliseText(row.values.sortOrder);
        candidate.sortOrder = rawSort === "" ? 0 : (parseNonNegativeInteger(rawSort) ?? -1);
      }
      const changedFields = fieldsFromObject(existing as unknown as Record<string, unknown>, candidate as unknown as Record<string, unknown>, ["name", "cut", "category", "description", "price", "powerDropPrice", "retailPrice", "unit", "badge", "available", "visibility", "stockLimit", "sortOrder", "img"]);
      for (const field of Object.keys(changedFields)) {
        const value = (candidate as unknown as Record<string, unknown>)[field];
        if (field === "name" && (normaliseText(value) === "" || normaliseText(value).length > 255)) validationError(productsFile, row, errors, "name is required and must be at most 255 characters");
        if (field === "cut" && normaliseText(value).length > 255) validationError(productsFile, row, errors, "cut must be at most 255 characters");
        if (field === "unit" && (normaliseText(value) === "" || normaliseText(value).length > 64)) validationError(productsFile, row, errors, "unit is required and must be at most 64 characters");
        if (field === "category" && (!normaliseText(value) || !categories.has(normaliseText(value)) || deletedCategories.has(normaliseText(value)))) validationError(productsFile, row, errors, "category must be an existing, non-deleted category slug");
        if (field === "price" && !parseDecimal(String(value), 99_999_999.99, 2)) validationError(productsFile, row, errors, "price must be a valid decimal number up to 99999999.99");
        if (["powerDropPrice", "retailPrice"].includes(field) && value !== null && !parseDecimal(String(value), 99_999_999.99, 2)) validationError(productsFile, row, errors, `${field} must be a valid decimal number up to 99999999.99`);
        if (field === "stockLimit" && value !== null && !parseDecimal(String(value), 9_999_999.999, 3)) validationError(productsFile, row, errors, "stockLimit must be a valid decimal number up to 9999999.999");
        if (field === "badge" && value !== null && !BADGE_VALUES.has(String(value))) validationError(productsFile, row, errors, "badge must be LIMITED, POPULAR, NEW, or SOLD OUT");
        if (field === "visibility" && !VISIBILITY_VALUES.has(value as VisibilityMode)) validationError(productsFile, row, errors, "visibility must be regular_only, always, or power_drop_only");
        if (field === "sortOrder" && (!Number.isInteger(value) || Number(value) < 0)) validationError(productsFile, row, errors, "sortOrder must be an integer of 0 or more");
      }
      if (rowHasError(errors, productsFile, row.row) || hasConflict(productsFile, row, existing, Object.keys(changedFields).length > 0, errors, conflicts)) {
        rowStatus.set(statusKey, rowHasError(errors, productsFile, row.row) ? "error" : "conflict");
        continue;
      }
      const duplicate = (changedFields.name || changedFields.cut || changedFields.category) && Array.from(products.values()).some((product) => product.id !== existing.id && productTuple(product) === productTuple(candidate));
      if (duplicate) { validationError(productsFile, row, errors, "product name + cut + category already exists"); rowStatus.set(statusKey, "error"); continue; }
      products.set(existing.id, candidate);
      operation(operations, "update", "products", productTarget(existing), productsFile.filename, row.row, changedFields);
      if (changedFields.name) warnings.push(`product name change: ${existing.id} (${existing.name} → ${candidate.name}) — historic analytics look up category by product name`);
      for (const field of ["stockLimit", "img", "powerDropPrice", "retailPrice"]) if (changedFields[field] && changedFields[field].newValue === null) warnings.push(`cleared ${field}: product ${existing.id}`);
      rowStatus.set(statusKey, Object.keys(changedFields).length ? "changed" : "unchanged");
    }
  }

  for (const categorySlug of Array.from(deletedCategories)) {
    const used = Array.from(products.values()).some((product) => product.category === categorySlug);
    if (used) {
      const category = snapshot.categories.find((candidate) => candidate.slug === categorySlug);
      const deleteOperation = operations.find((candidate) => candidate.action === "delete" && candidate.entity === "categories" && candidate.target === `category:${categorySlug}`);
      if (deleteOperation) errors.push({ file: deleteOperation.file, row: deleteOperation.row, message: `category cannot be deleted while products use ${categorySlug}` });
      if (category) categories.set(categorySlug, cloneCategory(category));
    }
  }

  const changedUnavailable = operations
    .filter((entry) => entry.entity === "products" && entry.action === "update" && entry.fields.available?.oldValue === true && entry.fields.available?.newValue === false)
    .length;
  if (changedUnavailable > 20) warnings.push(`${changedUnavailable} products made unavailable`);

  const beforeVisible = countVisibleAvailable(snapshot.products, snapshot.categories);
  const afterVisible = countVisibleAvailable(products.values(), categories.values());
  if (afterVisible === 0) blockers.push("Storefront safety blocker: zero available products would be visible in Regular mode");

  const changes: CatalogChange[] = operations.flatMap((entry) => Object.entries(entry.fields).map(([field, value]) => ({
    item: entry.target,
    file: entry.file,
    row: entry.row,
    field,
    oldValue: value.oldValue,
    newValue: value.newValue,
  })));
  const createTargets = new Set(operations.filter((entry) => entry.action === "create").map((entry) => entry.target));
  const updateTargets = new Set(operations.filter((entry) => entry.action === "update").map((entry) => entry.target));
  const deleteTargets = new Set(operations.filter((entry) => entry.action === "delete").map((entry) => entry.target));
  const unchanged = Array.from(rowStatus.values()).filter((status) => status === "unchanged").length;
  const canonical = operations
    .filter((entry) => entry.action !== "update" || Object.keys(entry.fields).length > 0)
    .map((entry) => ({ action: entry.action, entity: entry.entity, target: entry.target, fields: Object.fromEntries(Object.entries(entry.fields).sort(([a], [b]) => a.localeCompare(b)).map(([field, value]) => [field, value.newValue])) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const planHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");

  return {
    creates: createTargets.size,
    updates: updateTargets.size,
    deletes: deleteTargets.size,
    unchanged,
    conflicts,
    errors,
    warnings,
    blockers,
    changes,
    safety: { visibleAvailableBefore: beforeVisible, visibleAvailableAfter: afterVisible },
    planHash,
  };
}
