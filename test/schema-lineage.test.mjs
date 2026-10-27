import test from "node:test";
import assert from "node:assert/strict";
import { executeArticulateUtterance } from "@red-cup-engineering/signcell/articulating";
import { catalogWorkspaceContentGraph } from "../src/workspace-content-graph.mjs";

const dialect = "https://json-schema.org/draft/2020-12/schema";
const json = (path, value, metadata = {}) => ({ path, content: JSON.stringify(value), ...metadata });
const catalog = (...resources) => catalogWorkspaceContentGraph({ resources });

test("instance $schema and opaque $id do not turn arbitrary JSON into schemas", () => {
  const graph = catalog(json("config.json", { $schema: "urn:example:config", $id: "row-42", data: 7 }), json("row.json", { $id: "urn:example:row", value: 3 }));
  assert.deepEqual(graph.resources.map(({ kind }) => kind), ["json", "json"]);
  assert.equal(graph.schemaLineage.readouts.length, 1);
  assert.equal(graph.schemaLineage.readouts[0].relation, "instance-declared-schema");
  assert.equal(graph.schemaLineage.readouts[0].resolution.disposition, "unobserved");
});

test("schema media type, filename and supported dialect establish explicit classification", () => {
  const graph = catalog(json("schema", true, { mediaType: "Application/Schema+JSON; charset=utf-8" }), json("false.schema.json", false), json("dialect.json", { $schema: dialect }), json("ordinary.schema.json", { $schema: dialect }, { mediaType: "application/json" }));
  assert.deepEqual(graph.resources.map(({ kind }) => kind), ["json-schema", "json-schema", "json-schema", "json"]);
  assert.deepEqual(graph.resources.map(({ classification }) => classification.basis), ["observed-media-type", "schema-filename", "supported-dialect-declaration", "observed-media-type"]);
  assert.throws(() => catalog(json("bad.schema.json", null)), /neither an object nor a boolean/);
  assert.throws(() => catalog(json("bad.json", {}, { mediaType: 42 })), /mediaType/);
});

test("only supplier-admitted schema positions produce reference claims", () => {
  const graph = catalog(json("source.schema.json", {
    $id: "urn:example:source",
    $defs: { "a/b~c": { $ref: "urn:example:target" } },
    properties: { content: { $ref: "urn:example:target" } },
    allOf: [{ $ref: "urn:example:target" }],
    default: { $ref: "urn:false:default" },
    examples: [{ $ref: "urn:false:example" }],
    const: { $ref: "urn:false:const" },
    arbitraryAnnotation: { $ref: "urn:false:annotation" },
  }), json("target.schema.json", { $id: "urn:example:target", type: "string" }));
  assert.deepEqual(graph.schemaLineage.readouts.map(({ source }) => source.keywordLocation), ["/$defs/a~1b~0c/$ref", "/allOf/0/$ref", "/properties/content/$ref"]);
  assert.ok(graph.schemaLineage.readouts.every(({ reference, resolution }) => reference === "urn:example:target" && resolution.disposition === "resolved"));
  assert.ok(graph.relations.every(({ object }) => !object.startsWith("urn:false:")));
});

test("schema association has both directions, exact source custody and native SignCell receipt", () => {
  const schema = json("model.schema.json", { $id: "urn:example:model", type: "object" });
  const instance = json("model.json", { $schema: "urn:example:model", amount: 7 });
  const graph = catalog(schema, instance), [readout] = graph.schemaLineage.readouts;
  const source = graph.resources.find(({ path }) => path === instance.path);
  const target = graph.resources.find(({ path }) => path === schema.path);
  assert.equal(readout.source.carrierBytesNi, source.source.ni);
  assert.equal(readout.source.keywordLocation, "/$schema");
  assert.equal(readout.resolution.targets[0].carrierBytesNi, target.source.ni);
  assert.equal(readout.resolution.targets[0].schemaNi, target.semanticNi);
  assert.deepEqual(readout.nativeReceipt, executeArticulateUtterance({ tokenMark: JSON.stringify(readout.source), claimMark: JSON.stringify({ relation: readout.relation, reference: readout.reference, resolution: readout.resolution }), source: readout.source }));
  const forward = graph.relations.find(({ predicate, subject, object }) => predicate === "urn:semiotic:specified-by" && subject === source.semanticNi && object === target.semanticNi);
  const backward = graph.relations.find(({ predicate, subject, object }) => predicate === "urn:semiotic:describes-carrier" && subject === target.semanticNi && object === source.semanticNi);
  assert.deepEqual(forward.witnessIdentifiers, [source.source.ni, target.source.ni, readout.id]);
  assert.deepEqual(backward.witnessIdentifiers, forward.witnessIdentifiers);
  assert.equal(graph.schemaLineage.validationPerformed, false);
  const spaced = catalog(schema, { ...instance, content: JSON.stringify(JSON.parse(instance.content), null, 2) });
  assert.equal(spaced.schemaLineage.readouts[0].source.carrierSemanticNi, readout.source.carrierSemanticNi);
  assert.notEqual(spaced.schemaLineage.readouts[0].id, readout.id);
  assert.deepEqual(catalog(schema, instance), graph);
});

test("duplicate schema identifiers remain ambiguous and do not emit resolved lineage", () => {
  const graph = catalog(json("one.schema.json", { $id: "urn:duplicate", type: "string" }), json("two.schema.json", { $id: "urn:duplicate", type: "number" }), json("input.json", { $schema: "urn:duplicate" }));
  const [readout] = graph.schemaLineage.readouts;
  assert.equal(readout.resolution.disposition, "ambiguous");
  assert.deepEqual(readout.resolution.candidatePaths, ["one.schema.json", "two.schema.json"]);
  assert.equal(graph.relations.some(({ predicate }) => predicate === "urn:semiotic:specified-by"), false);
});

test("JSON Pointers preserve escaping and percent encoding without following data annotations", () => {
  const graph = catalog(json("pointers.schema.json", {
    $defs: { "a/b~c": false, "%": { type: "string" } },
    allOf: [{ $ref: "#/$defs/a~1b~0c" }, { $ref: "#/%24defs/%25" }, { $ref: "#/examples/0" }, { $ref: "#/$defs/a~2b" }],
    examples: [{ type: "string" }],
  }));
  assert.deepEqual(graph.schemaLineage.readouts.map(({ resolution }) => resolution.disposition), ["resolved", "resolved", "unobserved-schema-location", "unobserved-schema-location"]);
  assert.equal(graph.schemaLineage.readouts[0].resolution.targets[0].schemaPointer, "/$defs/a~1b~0c");
  assert.equal(graph.schemaLineage.readouts[1].resolution.targets[0].schemaPointer, "/$defs/%");
});

test("unsupported vocabulary, anchors and nested base scope remain explicit", () => {
  const graph = catalog(json("bounded.schema.json", {
    $id: "urn:outer", $anchor: "outer",
    $defs: { inner: { $id: "urn:inner", $ref: "#/properties/x" } },
    properties: { anchored: { $ref: "#outer" } },
    patternProperties: { "^x": { $ref: "urn:outside-supported-vocabulary" } },
  }));
  assert.deepEqual(graph.schemaLineage.readouts.map(({ resolution }) => resolution.disposition), ["unsupported-base-scope", "unsupported-anchor"]);
  assert.ok(graph.schemaLineage.limitations.some(({ value }) => value === "patternProperties"));
  assert.ok(graph.schemaLineage.limitations.some(({ value }) => value === "$anchor"));
});

test("normalized duplicate paths refuse and package suffix lookalikes stay JSON", () => {
  assert.throws(() => catalog(json("./folder/value.json", {}), json("folder\\value.json", {})), /duplicate observed resource.path/);
  const graph = catalog(json("not-package.json", { value: 3 }));
  assert.equal(graph.resources[0].kind, "json");
  assert.equal(graph.packages.length, 0);
});

test("supplier's omitted boolean additionalProperties location is explicit", () => {
  const graph = catalog(json("boolean-location.schema.json", { additionalProperties: false, allOf: [{ $ref: "#/additionalProperties" }] }));
  assert.equal(graph.schemaLineage.readouts[0].resolution.disposition, "unobserved-schema-location");
  assert.ok(graph.schemaLineage.limitations.some(({ pointer, reason, value }) => pointer === "/additionalProperties" && reason === "supplier-omits-boolean-schema-location" && value === false));
});
