import { articulate, mark, utterance } from "@lenticule-science/articulating";
import { predicate, presentPredicationSite } from "@lenticule-science/articulating/predicating";
import { readMarkdownDocument } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-document";
import { createSchema, validateInstance } from "@red-cup-engineering/json-schema-services-section";
import {
  EMPTY_WITNESS_ROOT,
  IDENTITY_SETTLEMENT_PROFILE,
  identifyBytesSemanticContent,
  identifyJsonSemanticContent,
} from "@red-cup-engineering/semantic-content-identify-service";

const DEPENDENCY_FIELDS = Object.freeze(["dependencies", "optionalDependencies", "peerDependencies"]);

function text(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function path(value) {
  const normalized = text(value, "resource.path").replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../") || normalized.includes("\0")) {
    throw new TypeError(`resource.path escapes the workspace: ${value}`);
  }
  return normalized;
}

function identify(objectKind, value) {
  return identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT });
}

function artifact(pathname, content) {
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({ path: pathname, bytes: bytes.length, ni: identifyBytesSemanticContent({ objectKind: "workspace-content-graph.file", bytes, witnessRoot: EMPTY_WITNESS_ROOT }).token });
}

function rootEntrypoints(manifest) {
  const root = typeof manifest.exports === "string" ? manifest.exports : manifest.exports?.["."];
  const candidates = [];
  if (typeof root === "string") candidates.push(root);
  else if (root !== null && typeof root === "object" && !Array.isArray(root)) {
    for (const key of ["import", "default", "node", "require"]) if (typeof root[key] === "string") candidates.push(root[key]);
  }
  if (candidates.length === 0 && typeof manifest.main === "string") candidates.push(manifest.main);
  return [...new Set(candidates)];
}

function contract(manifest) {
  const declared = manifest.semiotic;
  if (declared === null || typeof declared !== "object" || Array.isArray(declared)) {
    return Object.freeze({ disposition: "undeclared", operation: null, precondition: null, postcondition: null });
  }
  return Object.freeze({
    disposition: "declared",
    operation: text(declared.operation, `${manifest.name}.semiotic.operation`),
    precondition: text(declared.precondition, `${manifest.name}.semiotic.precondition`),
    postcondition: text(declared.postcondition, `${manifest.name}.semiotic.postcondition`),
  });
}

function owningPackage(packages, pathname) {
  return packages
    .filter(({ directory }) => directory === "" || pathname.startsWith(`${directory}/`))
    .sort((left, right) => right.directory.length - left.directory.length)[0] ?? null;
}

function schemaReferences(value, found = []) {
  if (Array.isArray(value)) for (const item of value) schemaReferences(item, found);
  else if (value !== null && typeof value === "object") for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && typeof item === "string") found.push(item);
    else schemaReferences(item, found);
  }
  return found;
}

function stringList(value) {
  if (typeof value === "string" && value.trim() !== "") return Object.freeze([value.trim()]);
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.filter((item) => typeof item === "string" && item.trim() !== "").map((item) => item.trim()))]);
}

function glossaryTermReadouts(resource) {
  if (resource.kind === "json" && resource.value !== null && typeof resource.value === "object" && !Array.isArray(resource.value)) {
    const { id, name, definition } = resource.value;
    if (typeof id !== "string" || id.trim() === "" || typeof name !== "string" || name.trim() === "" || typeof definition !== "string" || definition.trim() === "") return Object.freeze([]);
    return Object.freeze([Object.freeze({ id: id.trim(), name: name.trim(), token: name.trim(), definition: definition.trim(), carrierKind: "json", instance: resource.value })]);
  }
  if (resource.kind !== "markdown" || resource.document.frontmatter.type !== "term") return Object.freeze([]);
  const tokens = stringList(resource.document.frontmatter.defines);
  const body = resource.document.body.trim();
  const description = resource.document.frontmatter.description;
  const definition = body !== "" ? body : typeof description === "string" ? description.trim() : "";
  if (tokens.length === 0 || definition === "") return Object.freeze([]);
  const declaredName = resource.document.frontmatter.name;
  return Object.freeze(tokens.map((token) => {
    const id = token.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
    const name = typeof declaredName === "string" && declaredName.trim() !== "" ? declaredName.trim() : token;
    return Object.freeze({ id, name, token, definition, carrierKind: "markdown", instance: Object.freeze({ id, name, definition }) });
  }));
}

function articulateGlossaryTerm(resource, readout, termSchemaNi, schemaValidation) {
  const termBody = Object.freeze({
    type: "GlossaryTerm",
    version: 1,
    id: readout.id,
    name: readout.name,
    token: readout.token,
    definition: readout.definition,
  });
  const termNi = identify("glossary.term", termBody).token;
  // This is a local mathematical readout, not a language-cone service receipt
  // or a Lean/Solidity correspondence proof. Use the actual primitive once.
  const request = Object.freeze({ tokenMark: readout.token, claimMark: readout.definition });
  if (Buffer.byteLength(JSON.stringify(request), "utf8") > 65_536) {
    throw new RangeError("glossary articulation input exceeds 65536 bytes");
  }
  const requestNi = identify("workspace.glossary-articulation.request", request).token;
  const nativeCell = articulate(utterance(mark(request.tokenMark), mark(request.claimMark)));
  const articulationBody = Object.freeze({
    kind: "workspace.glossary-articulation.readout",
    version: 1,
    implementation: "@lenticule-science/articulating#articulate",
    requestNi,
    cell: structuredClone(nativeCell),
  });
  const articulation = Object.freeze({ ...articulationBody, id: identify(articulationBody.kind, articulationBody).token });
  const predicationGenerators = presentPredicationSite(predicate(nativeCell));
  const predicationGeneratorsNi = identify("predication.site.generators", predicationGenerators).token;
  const admissionBody = Object.freeze({
    kind: "glossary.term.admission",
    version: 1,
    carrierKind: readout.carrierKind,
    carrierSemanticNi: resource.identity.token,
    carrierBytesNi: resource.source.ni,
    schemaNi: termSchemaNi,
    schemaValidation,
    termNi,
  });
  const admissionNi = identify("glossary.term.admission", admissionBody).token;
  const readoutBody = Object.freeze({
    kind: "workspace.glossary-utterance-readout",
    version: 2,
    implementation: articulation.implementation,
    termNi,
    forward: Object.freeze([
      Object.freeze({ morphism: "admit-carrier", domain: resource.source.ni, codomain: admissionNi }),
      Object.freeze({ morphism: "read-typed-term", domain: admissionNi, codomain: termNi }),
      Object.freeze({ morphism: "execute-node-articulation", domain: termNi, codomain: articulation.id }),
      Object.freeze({ morphism: "present-predication-generators", domain: articulation.id, codomain: predicationGeneratorsNi }),
    ]),
    backward: Object.freeze([
      Object.freeze({ demand: "carrier-bytes-preserved", witness: resource.source.ni }),
      Object.freeze({ demand: "term-schema-admitted", witness: termSchemaNi }),
      Object.freeze({ demand: "token-and-claim-present", witness: articulation.requestNi }),
      Object.freeze({ demand: "local-articulation-retained", witness: articulation.id }),
    ]),
    articulationReadoutNi: articulation.id,
    predicationGeneratorsNi,
    correspondence: Object.freeze({
      disposition: "obstructed",
      nodeLeanArticulation: "node-potential-cell-transports-the-exact-token-with-an-empty-claim-slot",
      curryHowardLambek: "no-glossary-prose-to-typed-term-derivation-or-cone-map-is-implemented",
      orientation: "articulate-then-predicate-produces-only-the-reflexive-predication-generator",
      positing: "no-positive-or-negative-evidence-source-is-present",
      settling: "no-settling-operation-is-performed",
      refutation: "no-proof-relevant-counterchallenge-to-negative-slot-morphism-is-implemented",
    }),
  });
  const readoutNi = identify("workspace.glossary-utterance-readout", readoutBody).token;
  return Object.freeze({
    id: readoutNi,
    ...readoutBody,
    term: termBody,
    admission: Object.freeze({ id: admissionNi, ...admissionBody }),
    articulation,
    predicationGenerators,
  });
}

/**
 * Read package apexes, JSON Schemas, and Markdown as one addressed actor/content
 * territory. Acquisition remains outside this pure boundary: callers supply
 * the exact resources they observed, and every edge retains its witness.
 */
export function catalogWorkspaceContentGraph({ resources } = {}) {
  if (!Array.isArray(resources) || resources.length === 0) throw new TypeError("resources must be a non-empty observed workspace set");
  const admitted = resources.map((resource, index) => {
    if (resource === null || typeof resource !== "object" || Array.isArray(resource)) throw new TypeError(`resources[${index}] must be an object`);
    const pathname = path(resource.path), content = text(resource.content, `resources[${index}].content`), source = artifact(pathname, content);
    if (pathname.endsWith("package.json")) {
      let value;
      try { value = JSON.parse(content); } catch (error) { throw new TypeError(`${pathname} is not JSON: ${error.message}`); }
      text(value.name, `${pathname}.name`); text(value.version, `${pathname}.version`);
      const identity = identify("npm.package-manifest", value);
      return Object.freeze({ kind: "package-manifest", path: pathname, source, value, identity });
    }
    if (pathname.endsWith(".json")) {
      let value;
      try { value = JSON.parse(content); } catch { return Object.freeze({ kind: "json", path: pathname, source, value: content, identity: identify("content.json-text", { path: pathname, content }) }); }
      const isSchema = typeof value?.$schema === "string" || typeof value?.$id === "string" || pathname.endsWith(".schema.json");
      const identity = identify(isSchema ? "content.json-schema" : "content.json", value);
      return Object.freeze({ kind: isSchema ? "json-schema" : "json", path: pathname, source, value, identity });
    }
    if (/\.(?:md|mdown|markdown)$/iu.test(pathname)) {
      const document = readMarkdownDocument(content);
      const value = Object.freeze({ path: pathname, content });
      return Object.freeze({ kind: "markdown", path: pathname, source, value, document, identity: identify("content.markdown-document", document) });
    }
    const value = Object.freeze({ path: pathname, content });
    return Object.freeze({ kind: "text", path: pathname, source, value, identity: identify("content.text", value) });
  });

  const packages = admitted.filter(({ kind }) => kind === "package-manifest").map((resource) => {
    const manifest = resource.value, directory = resource.path.slice(0, -"package.json".length).replace(/\/$/u, "");
    const entrypoints = rootEntrypoints(manifest), declaredContract = contract(manifest);
    const body = Object.freeze({
      type: "PackageActorApex",
      version: 1,
      actor: `urn:npm:${manifest.name}`,
      name: manifest.name,
      release: manifest.version,
      directory,
      manifestNi: resource.identity.token,
      apex: Object.freeze({ disposition: entrypoints.length === 1 ? "single" : entrypoints.length === 0 ? "missing" : "ambiguous", entrypoints }),
      contract: declaredContract,
    });
    return Object.freeze({ ...body, id: identify("npm.package-actor-apex", body).token });
  });

  const termSchema = admitted.find((resource) => resource.kind === "json-schema" && resource.value.$id === "emsenn/schema/term") ?? null;
  const termSchemaNi = termSchema?.identity.token ?? null;
  const admittedTermSchema = termSchema === null ? null : createSchema(termSchema.value, undefined, { allowUnknownAnnotations: true }).schema;
  const glossaryOutcomes = admitted.flatMap((resource) => glossaryTermReadouts(resource).map((readout) => {
    const validation = admittedTermSchema === null
      ? Object.freeze({ ok: false, errors: Object.freeze([Object.freeze({ pointer: "", keyword: "$schema", message: "emsenn/schema/term is absent from the observed resource set" })]) })
      : validateInstance(readout.instance, admittedTermSchema);
    if (validation.ok) return articulateGlossaryTerm(resource, readout, termSchemaNi, validation);
    const body = Object.freeze({
      kind: "glossary.term.refusal",
      version: 1,
      carrierSemanticNi: resource.identity.token,
      carrierBytesNi: resource.source.ni,
      token: readout.token,
      schemaNi: termSchemaNi,
      validation,
    });
    return Object.freeze({ ...body, id: identify("glossary.term.refusal", body).token });
  }));
  const glossaryUtteranceReadouts = glossaryOutcomes.filter(({ kind }) => kind === "workspace.glossary-utterance-readout");
  const glossaryRefusals = glossaryOutcomes.filter(({ kind }) => kind === "glossary.term.refusal");

  const relations = [];
  const relate = (subject, predicate, object, witnessIdentifiers = []) => {
    const carrier = Object.freeze({
      kind: "workspace.oriented-relation.carrier",
      version: 1,
      subject: text(subject, "relation.subject"),
      predicate: text(predicate, "relation.predicate"),
      object: text(object, "relation.object"),
      witnessIdentifiers: Object.freeze(witnessIdentifiers.map((identifier, index) => text(identifier, `relation.witnessIdentifiers[${index}]`))),
    });
    const edge = identifyJsonSemanticContent({
      objectKind: "workspace.oriented-relation",
      value: carrier,
      witnessRoot: EMPTY_WITNESS_ROOT,
    });
    if (edge.envelope.settlementProfile !== IDENTITY_SETTLEMENT_PROFILE) {
      throw new TypeError("relation identity did not use the canonical identity settlement profile");
    }
    relations.push(Object.freeze({
      id: edge.token,
      ...carrier,
    }));
  };
  for (const pkg of packages) {
    relate(pkg.id, "urn:semiotic:realizes-actor", pkg.actor, [pkg.manifestNi]);
    relate(pkg.actor, "urn:semiotic:has-apex", pkg.id, [pkg.manifestNi]);
    relate(pkg.actor, "urn:semiotic:has-single-apex", pkg.apex.disposition === "single" ? "true" : "false", [pkg.manifestNi]);
    relate(pkg.actor, "urn:semiotic:declares-hoare-contract", pkg.contract.disposition === "declared" ? "true" : "false", [pkg.manifestNi]);
    if (pkg.contract.disposition === "declared") {
      relate(pkg.actor, "urn:semiotic:performs", pkg.contract.operation, [pkg.manifestNi]);
      relate(pkg.actor, "urn:hoare:requires", pkg.contract.precondition, [pkg.manifestNi]);
      relate(pkg.actor, "urn:hoare:ensures", pkg.contract.postcondition, [pkg.manifestNi]);
    }
    for (const field of DEPENDENCY_FIELDS) for (const provider of Object.keys(admitted.find(({ identity }) => identity.token === pkg.manifestNi).value[field] ?? {}).sort()) {
      relate(pkg.actor, `urn:npm:${field}`, `urn:npm:${provider}`, [pkg.manifestNi]);
    }
  }
  for (const resource of admitted.filter(({ kind }) => kind !== "package-manifest")) {
    const owner = owningPackage(packages, resource.path);
    if (owner !== null) relate(owner.actor, "urn:semiotic:contains", resource.identity.token, [resource.source.ni]);
    if (resource.kind === "json-schema") {
      if (typeof resource.value.$id === "string") relate(resource.identity.token, "urn:json-schema:declares-id", resource.value.$id, [resource.source.ni]);
      for (const reference of [...new Set(schemaReferences(resource.value))].sort()) relate(resource.identity.token, "urn:json-schema:references", reference, [resource.source.ni]);
    }
    if (resource.kind === "markdown") for (const heading of resource.document.structure.headings) {
      relate(resource.identity.token, `urn:markdown:heading:${heading.level}`, heading.title, [resource.source.ni]);
    }
  }
  for (const readout of glossaryUtteranceReadouts) {
    relate(readout.admission.carrierSemanticNi, "urn:semiotic:admits", readout.termNi, [readout.admission.carrierBytesNi]);
    relate(readout.termNi, "urn:semiotic:specified-by", readout.admission.schemaNi, [readout.admission.carrierBytesNi]);
    relate(readout.termNi, "urn:glossary:defines", readout.term.token, [readout.admission.carrierBytesNi]);
    relate(readout.term.token, "urn:glossary:means", readout.term.definition, [readout.articulation.id]);
    relate(readout.termNi, "urn:semiotic:has-node-articulation-readout", readout.articulation.id, [readout.articulation.requestNi]);
    relate(readout.articulation.id, "urn:semiotic:presents-predication-generators", readout.predicationGeneratorsNi, [readout.articulation.id]);
    relate(readout.id, "urn:semiotic:uses-implementation", readout.implementation, [readout.articulation.id]);
  }
  const glossaryOverlaps = [...Map.groupBy(glossaryUtteranceReadouts, (readout) => readout.term.token).entries()]
    .filter(([, readouts]) => new Set(readouts.map((readout) => readout.term.definition)).size > 1)
    .map(([token, readouts]) => Object.freeze({
      kind: "glossary.overlap-obstruction",
      token,
      disposition: "unresolved",
      definitions: Object.freeze(readouts.map((readout) => Object.freeze({ termNi: readout.termNi, definition: readout.term.definition, readoutNi: readout.id }))),
    }));
  relations.sort((left, right) => left.subject.localeCompare(right.subject) || left.predicate.localeCompare(right.predicate) || left.object.localeCompare(right.object));
  const body = Object.freeze({
    type: "WorkspaceContentGraph",
    version: 4,
    denominator: Object.freeze({ observedResources: admitted.length, packageActors: packages.length, glossaryUtteranceReadouts: glossaryUtteranceReadouts.length, glossaryRefusals: glossaryRefusals.length, glossaryOverlaps: glossaryOverlaps.length }),
    packages: Object.freeze(packages),
    resources: Object.freeze(admitted.map(({ value: _value, identity, ...resource }) => Object.freeze({ ...resource, semanticNi: identity.token }))),
    glossaryUtteranceReadouts: Object.freeze(glossaryUtteranceReadouts),
    glossaryRefusals: Object.freeze(glossaryRefusals),
    glossaryOverlaps: Object.freeze(glossaryOverlaps),
    relations: Object.freeze(relations),
  });
  return Object.freeze({ ...body, id: identify("typed-resource-catalog.workspace-content-graph", body).token });
}
