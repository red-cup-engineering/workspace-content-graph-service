import { schemaChildren } from "@red-cup-engineering/json-schema-services-section/schema-children";
import { resolveSchemaReference } from "@red-cup-engineering/json-schema-services-section/resolve-schema-reference";
import { DRAFT_2020_12, known, supported } from "@red-cup-engineering/json-schema-services-section/schema-vocabulary";
import { executeArticulateUtterance } from "@red-cup-engineering/signcell/articulating";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const identify = (objectKind, value) => identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT }).token;
const escapePointer = (value) => value.replaceAll("~", "~0").replaceAll("/", "~1");

export function classifyJsonResource(resource, value, pathname) {
  const mediaType = resource.mediaType === undefined ? null : resource.mediaType;
  if (mediaType !== null && (typeof mediaType !== "string" || mediaType.trim() === "")) throw new TypeError(`${pathname}.mediaType must be non-empty text`);
  const mediaEssence = mediaType?.split(";", 1)[0].trim().toLowerCase();
  const basis = mediaType !== null ? "observed-media-type" : pathname.endsWith(".schema.json") ? "schema-filename" : value?.$schema === DRAFT_2020_12 ? "supported-dialect-declaration" : "json-carrier";
  const isSchema = mediaType !== null ? mediaEssence === "application/schema+json" : basis !== "json-carrier";
  if (isSchema && typeof value !== "boolean" && !record(value)) throw new TypeError(`${pathname} declares a schema but is neither an object nor a boolean`);
  return Object.freeze({ kind: isSchema ? "json-schema" : "json", classification: Object.freeze({ basis, mediaType }) });
}

function inspectSchema(resource) {
  const locations = new Map(), references = [], limitations = [];
  const pending = [["", resource.value, false]];
  while (pending.length > 0) {
    const [pointer, schema, embeddedResource] = pending.pop();
    if (typeof schema !== "boolean" && !record(schema)) {
      limitations.push({ pointer, reason: "invalid-subschema" });
      continue;
    }
    locations.set(pointer, schema);
    if (typeof schema === "boolean") continue;
    const changesBase = embeddedResource || (pointer !== "" && typeof schema.$id === "string");
    if (typeof schema.$schema === "string" && schema.$schema !== DRAFT_2020_12) limitations.push({ pointer: `${pointer}/$schema`, reason: "unsupported-dialect", value: schema.$schema });
    if (typeof schema.additionalProperties === "boolean") limitations.push({ pointer: `${pointer}/additionalProperties`, reason: "supplier-omits-boolean-schema-location", value: schema.additionalProperties });
    for (const keyword of Object.keys(schema).sort()) if (known.has(keyword) && !supported.has(keyword)) limitations.push({ pointer: `${pointer}/${escapePointer(keyword)}`, reason: "unsupported-keyword", value: keyword });
    if (typeof schema.$ref === "string") references.push({ pointer: `${pointer}/$ref`, reference: schema.$ref, embeddedResource: changesBase });
    try {
      for (const [childPointer, child] of schemaChildren(schema).reverse()) pending.push([`${pointer}/${childPointer}`, child, changesBase]);
    } catch (error) {
      limitations.push({ pointer, reason: "invalid-schema-children", message: error.message });
    }
  }
  return { locations, references, limitations };
}

function resolveObservedReference(source, reference, inspected, schemas, embeddedResource) {
  // The supplier implements exact identifiers and JSON Pointers. It does not
  // implement URI base resolution or dynamic scope; do not invent those here.
  if (embeddedResource) return { disposition: "unsupported-base-scope", targets: [] };
  const at = reference.indexOf("#"), identifier = at < 0 ? reference : reference.slice(0, at);
  let pointer;
  try { pointer = at < 0 ? "" : decodeURIComponent(reference.slice(at + 1)); }
  catch { return { disposition: "invalid-fragment", targets: [] }; }
  if (pointer !== "" && !pointer.startsWith("/")) return { disposition: "unsupported-anchor", targets: [] };
  const candidates = reference.startsWith("#")
    ? source.kind === "json-schema" ? [source] : []
    : schemas.filter((schema) => schema.value?.$id === identifier);
  if (candidates.length !== 1) return { disposition: candidates.length === 0 ? "unobserved" : "ambiguous", targets: [], candidatePaths: candidates.map(({ path }) => path).sort() };
  const target = candidates[0], index = inspected.get(target.path);
  if (!index.locations.has(pointer)) return { disposition: "unobserved-schema-location", targets: [] };
  let resolved;
  try { resolved = pointer === "" ? { found: true, schema: target.value } : resolveSchemaReference({ reference: reference.slice(at), base: target.value, schemas: [] }); }
  catch { return { disposition: "invalid-schema-reference", targets: [] }; }
  if (!resolved.found) return { disposition: "unobserved-schema-location", targets: [] };
  return { disposition: "resolved", targets: [{ path: target.path, carrierBytesNi: target.source.ni, carrierSemanticNi: target.identity.token, schemaPointer: pointer, schemaNi: identify("content.json-schema", resolved.schema) }] };
}

export function deriveSchemaLineage(resources) {
  const schemas = resources.filter(({ kind }) => kind === "json-schema");
  const inspected = new Map(schemas.map((resource) => [resource.path, inspectSchema(resource)]));
  const readouts = [];
  for (const resource of resources) {
    const references = resource.kind === "json-schema" ? inspected.get(resource.path).references
      : resource.kind === "json" && record(resource.value) && typeof resource.value.$schema === "string" ? [{ pointer: "/$schema", reference: resource.value.$schema, embeddedResource: false }] : [];
    for (const { pointer, reference, embeddedResource } of references) {
      const source = { path: resource.path, carrierBytesNi: resource.source.ni, carrierSemanticNi: resource.identity.token, keywordLocation: pointer };
      const relation = resource.kind === "json-schema" ? "schema-reference" : "instance-declared-schema";
      const resolution = resolveObservedReference(resource, reference, inspected, schemas, embeddedResource);
      const claim = { relation, reference, resolution };
      const nativeReceipt = executeArticulateUtterance({ tokenMark: JSON.stringify(source), claimMark: JSON.stringify(claim), source });
      const body = { kind: "workspace.schema-lineage", version: 1, source, ...claim, nativeReceipt };
      readouts.push(Object.freeze({ ...body, id: identify(body.kind, body) }));
    }
  }
  return Object.freeze({
    implementation: "@red-cup-engineering/json-schema-services-section/schema-children+resolve-schema-reference",
    resolutionPolicy: "observed-exact-identifiers-and-json-pointers",
    validationPerformed: false,
    readouts: Object.freeze(readouts.sort((a, b) => a.source.path.localeCompare(b.source.path) || a.source.keywordLocation.localeCompare(b.source.keywordLocation))),
    limitations: Object.freeze(schemas.flatMap((resource) => inspected.get(resource.path).limitations.map((limitation) => Object.freeze({ path: resource.path, carrierBytesNi: resource.source.ni, ...limitation })))),
  });
}
