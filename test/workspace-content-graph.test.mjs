import assert from "node:assert/strict";
import test from "node:test";

import { catalogWorkspaceContentGraph } from "../src/workspace-content-graph.mjs";

const termSchema = Object.freeze({
  $id: "emsenn/schema/term",
  type: "object",
  required: Object.freeze(["id", "name", "definition"]),
  additionalProperties: false,
  properties: Object.freeze({
    id: Object.freeze({ type: "string", minLength: 1 }),
    name: Object.freeze({ type: "string", minLength: 1 }),
    definition: Object.freeze({ type: "string", minLength: 1 }),
  }),
});

test("a glossary term presents predication generators without fabricating evidence or settlement", () => {
  const graph = catalogWorkspaceContentGraph({
    resources: [
      { path: "term.schema.json", content: JSON.stringify(termSchema) },
      { path: "friend.json", content: JSON.stringify({ id: "friend", name: "Friend", definition: "A person held in mutual affection." }) },
    ],
  });

  assert.equal(graph.glossaryUtteranceReadouts.length, 1);
  assert.equal(graph.version, 3);
  const [readout] = graph.glossaryUtteranceReadouts;
  assert.equal(readout.predicationGenerators.kind, "predication.site");
  assert.equal(readout.predicationGenerators.cells.length, 1);
  assert.equal(readout.predicationGenerators.specializations.length, 0);
  assert.equal(readout.predicationGenerators.cells[0].subject.mark.value, "Friend");
  assert.equal(readout.predicationGenerators.cells[0].predicate.mark.value, "A person held in mutual affection.");
  assert.equal(readout.predicationGenerators.cells[0].object.mark.value, "Friend");
  assert.equal(readout.correspondence.positing, "no-positive-or-negative-evidence-source-is-present");
  assert.equal(readout.correspondence.settling, "no-settling-operation-is-performed");

  const presentation = graph.relations.find(({ predicate: edgePredicate }) => edgePredicate === "urn:semiotic:presents-predication-generators");
  assert.equal(presentation?.subject, readout.articulation.id);
  assert.equal(presentation?.predicate, "urn:semiotic:presents-predication-generators");
  assert.equal(presentation?.object, readout.predicationGeneratorsNi);
  assert.equal(presentation?.kind, "workspace.oriented-relation.carrier");
  assert.deepEqual(presentation?.witnessIdentifiers, [readout.articulation.id]);
  assert.equal(Object.hasOwn(presentation, "coordinates"), false);
  assert.equal(Object.hasOwn(presentation, "reading"), false);
  assert.equal(Object.hasOwn(presentation, "positive"), false);
  assert.equal(Object.hasOwn(presentation, "negative"), false);
});
