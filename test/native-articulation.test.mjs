import assert from "node:assert/strict";
import test from "node:test";
import { catalogWorkspaceContentGraph } from "../src/workspace-content-graph.mjs";
import { ARTICULATING_APEX, ARTICULATING_LANGUAGE_IDENTIFIERS, executeArticulateUtterance } from "@red-cup-engineering/signcell/articulating";
import { predicate, presentPredicationSite } from "@red-cup-engineering/signcell/predication";
import { canonicalCarrier, semanticId } from "@red-cup-engineering/computer-content-address-engineering-services-section/semiotic-content-address";
import { EMPTY_WITNESS_ROOT, identifyJsonSemanticContent } from "@red-cup-engineering/computer-data-engineering-services-section/semiotic-expression-notation/semantic-content-identity";

const termSchema = {
  $id: "emsenn/schema/term", type: "object", required: ["id", "name", "definition"], additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 }, name: { type: "string", minLength: 1 }, definition: { type: "string", minLength: 1 } },
};
const schemaResource = { path: "term.schema.json", content: JSON.stringify(termSchema) };
const jsonResource = (value, path = "friend.json") => ({ path, content: JSON.stringify(value) });
const term = { id: "friend", name: "Friend", definition: "A person held in mutual affection." };
const catalog = (...resources) => catalogWorkspaceContentGraph({ resources: [schemaResource, ...resources] });
const first = (graph) => graph.glossaryUtteranceReadouts[0];
const identify = (objectKind, value) => identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT }).token;
const requestOf = (readout) => ({ tokenMark: readout.term.token, claimMark: readout.term.definition, source: readout.articulation.source });

function receive(graph, inputResource, readout = first(graph)) {
  const resource = graph.resources.find(({ path }) => path === inputResource.path);
  const source = readout.articulation.source;
  assert.deepEqual(source, {
    path: inputResource.path, carrierBytesNi: resource.source.ni, carrierSemanticNi: resource.semanticNi,
    span: { unit: "utf8-byte", start: 0, end: Buffer.byteLength(inputResource.content, "utf8") },
    selection: "whole-carrier", interpretation: "schema-admitted-local-glossary-readout",
  });
  assert.equal(resource.source.bytes, source.span.end);
  const request = requestOf(readout);
  const receipt = readout.articulation.nativeReceipt;
  assert.deepEqual(receipt, executeArticulateUtterance(request));
  assert.equal(receipt.apex, ARTICULATING_APEX);
  assert.equal(receipt.operation, "articulate-utterance");
  assert.deepEqual(receipt.identifiers, ARTICULATING_LANGUAGE_IDENTIFIERS);
  assert.equal(receipt.requestNi, semanticId(request));
  assert.equal(readout.articulation.requestNi, identify("workspace.glossary-articulation.request", request));
  const { id: receiptId, ...receiptBody } = receipt;
  assert.equal(receiptId, semanticId(receiptBody));
  const { id: readoutId, ...articulationBody } = readout.articulation;
  assert.equal(readoutId, identify("workspace.glossary-articulation.readout", articulationBody));
  assert.deepEqual(readout.articulation.cell, receipt.cell);
  assert.deepEqual(readout.predicationGenerators, presentPredicationSite(predicate(receipt.cell)));
  assert.equal(readout.predicationGeneratorsNi, identify("predication.site.generators", readout.predicationGenerators));
  const [carrier, [tokenSlot, claimSlot]] = receipt.cell.potentialAperiodicArticulationCell;
  assert.equal(tokenSlot.length, 1);
  assert.deepEqual(tokenSlot[0], carrier.token);
  assert.deepEqual(claimSlot, []);
  assert.equal(carrier.token.mark.value, readout.term.token.normalize("NFC"));
  assert.equal(carrier.claim.mark.value, readout.term.definition.normalize("NFC"));
  assert.equal(readout.predicationGenerators.cells.length, 1);
  const [cell] = readout.predicationGenerators.cells;
  assert.deepEqual(cell.subject, cell.object);
  assert.deepEqual(cell.for, []);
  assert.deepEqual(cell.against, []);
  assert.deepEqual(readout.predicationGenerators.specializations, []);
  assert.equal(readout.correspondence.disposition, "obstructed");
  assert.equal(readout.correspondence.positing, "no-positive-or-negative-evidence-source-is-present");
  assert.equal(readout.correspondence.settling, "no-settling-operation-is-performed");
  assert.equal(Object.hasOwn(readout, "apex"), false);
  assert.equal(Object.hasOwn(readout, "signedEvidence"), false);
  assert.equal(Object.hasOwn(receipt, "signature"), false);
}

test("native articulation retains an independently recomputable source-bound request and receipt", () => {
  const resource = jsonResource(term), graph = catalog(resource);
  receive(graph, resource);
  assert.deepEqual(catalog(resource), graph);
  assert.deepEqual(JSON.parse(JSON.stringify(graph)), graph);
});

test("whole-carrier Unicode byte ranges preserve original bytes while SignCell canonicalizes marks", () => {
  const resource = jsonResource({ id: "cafe", name: "Cafe\u0301 🧪", definition: "E\u0301tude \"quoted\" 🌱\r\nNext line." }, "terms/café.json");
  const graph = catalog(resource), readout = first(graph);
  receive(graph, resource);
  assert.ok(readout.articulation.source.span.end > resource.content.length);
  assert.equal(readout.term.token, "Cafe\u0301 🧪");
  assert.equal(readout.articulation.cell.potentialAperiodicArticulationCell[0].token.mark.value, "Café 🧪");
});

test("NFC-equivalent carriers share canonical cells but retain distinct exact-byte custody", () => {
  const a = jsonResource({ id: "cafe", name: "Cafe\u0301", definition: "E\u0301tude" });
  const b = jsonResource({ id: "cafe", name: "Café", definition: "Étude" });
  const ga = catalog(a), gb = catalog(b), ra = first(ga), rb = first(gb);
  receive(ga, a); receive(gb, b);
  assert.deepEqual(ra.articulation.cell, rb.articulation.cell);
  assert.deepEqual(ra.predicationGenerators, rb.predicationGenerators);
  assert.notEqual(ra.articulation.source.carrierBytesNi, rb.articulation.source.carrierBytesNi);
  assert.notEqual(ra.articulation.nativeReceipt.requestNi, rb.articulation.nativeReceipt.requestNi);
  assert.notEqual(ra.articulation.id, rb.articulation.id);
});

test("JSON whitespace changes byte custody without changing the admitted term or canonical cell", () => {
  const a = jsonResource(term), b = { path: a.path, content: JSON.stringify(term, null, 2) + "\n" };
  const ga = catalog(a), gb = catalog(b), ra = first(ga), rb = first(gb);
  receive(ga, a); receive(gb, b);
  assert.equal(ra.termNi, rb.termNi);
  assert.equal(ra.admission.carrierSemanticNi, rb.admission.carrierSemanticNi);
  assert.notEqual(ra.admission.carrierBytesNi, rb.admission.carrierBytesNi);
  assert.deepEqual(ra.articulation.cell, rb.articulation.cell);
  assert.notEqual(ra.articulation.nativeReceipt.id, rb.articulation.nativeReceipt.id);
});

test("source path is bound even when the term and carrier bytes are unchanged", () => {
  const a = jsonResource(term, "one.json"), b = jsonResource(term, "two.json");
  const ra = first(catalog(a)), rb = first(catalog(b));
  assert.equal(ra.termNi, rb.termNi);
  assert.equal(ra.admission.carrierBytesNi, rb.admission.carrierBytesNi);
  assert.equal(ra.admission.carrierSemanticNi, rb.admission.carrierSemanticNi);
  assert.notEqual(ra.articulation.nativeReceipt.requestNi, rb.articulation.nativeReceipt.requestNi);
  assert.notEqual(ra.articulation.id, rb.articulation.id);
});

test("YAML Markdown aliases each retain the complete CRLF Unicode carrier rather than fabricated token offsets", () => {
  const resource = { path: "terms/cafe.md", content: "---\r\ntype: term\r\ndefines: [Café, River]\r\n---\r\n# Shared 🌱\r\nA café beside water.\r\n" };
  const graph = catalog(resource);
  assert.equal(graph.glossaryUtteranceReadouts.length, 2);
  for (const readout of graph.glossaryUtteranceReadouts) receive(graph, resource, readout);
  const [a, b] = graph.glossaryUtteranceReadouts;
  assert.deepEqual(a.articulation.source, b.articulation.source);
  assert.notEqual(a.articulation.nativeReceipt.requestNi, b.articulation.nativeReceipt.requestNi);
});

test("TOML Markdown description fallback receives the actual generated codec path", () => {
  const resource = { path: "terms/river.md", content: '+++\ntype = "term"\ndefines = ["River"]\ndescription = "A flowing 🌊 body."\n+++\n' };
  const graph = catalog(resource);
  assert.equal(graph.glossaryUtteranceReadouts.length, 1);
  assert.equal(first(graph).term.definition, "A flowing 🌊 body.");
  receive(graph, resource);
});

test("missing schema and schema-invalid glossary instances refuse before articulation", () => {
  const missing = catalogWorkspaceContentGraph({ resources: [jsonResource(term)] });
  const invalid = catalog(jsonResource({ ...term, extra: true }));
  for (const graph of [missing, invalid]) {
    assert.equal(graph.glossaryUtteranceReadouts.length, 0);
    assert.equal(graph.glossaryRefusals.length, 1);
    assert.equal(graph.glossaryRefusals[0].validation.ok, false);
    assert.equal(Object.hasOwn(graph.glossaryRefusals[0], "articulation"), false);
    assert.equal(graph.relations.some(({ predicate }) => predicate === "urn:semiotic:has-node-articulation-readout"), false);
  }
});

test("overlapping glossary definitions remain unresolved without fabricated contradictory evidence", () => {
  const graph = catalog(jsonResource(term, "a.json"), jsonResource({ ...term, definition: "A different local definition." }, "b.json"));
  assert.equal(graph.glossaryOverlaps.length, 1);
  assert.equal(graph.glossaryOverlaps[0].disposition, "unresolved");
  for (const readout of graph.glossaryUtteranceReadouts) {
    assert.deepEqual(readout.predicationGenerators.cells[0].for, []);
    assert.deepEqual(readout.predicationGenerators.cells[0].against, []);
  }
});

test("the complete source-bound request admits exactly 65536 UTF-8 bytes and refuses one byte more", () => {
  const make = (n) => jsonResource({ id: "large", name: "Large", definition: "x".repeat(n) }, "large.json");
  const probe = first(catalog(make(60_000)));
  const n = 60_000 + 65_536 - Buffer.byteLength(JSON.stringify(requestOf(probe)), "utf8");
  const accepted = first(catalog(make(n)));
  assert.equal(Buffer.byteLength(JSON.stringify(requestOf(accepted)), "utf8"), 65_536);
  assert.throws(() => catalog(make(n + 1)), /glossary articulation input exceeds 65536 bytes/);
  assert.throws(() => catalog(jsonResource({ ...term, definition: "🧪".repeat(16_384) })), /glossary articulation input exceeds 65536 bytes/);
});

test("source paths escaping the observed workspace are rejected", () => {
  for (const path of ["../term.json", "/term.json", "a/../term.json", "bad\0.json"]) {
    assert.throws(() => catalog(jsonResource(term, path)), /escapes the workspace/);
  }
});

test("native generator carriers are already canonical plain JSON values", () => {
  const readout = first(catalog(jsonResource(term)));
  assert.deepEqual(canonicalCarrier(readout.predicationGenerators), readout.predicationGenerators);
  assert.equal(typeof identify("predication.site.generators", readout.predicationGenerators), "string");
});
