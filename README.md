# workspace-content-graph-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Read observed workspace resources into one content-addressed graph. The pure
`catalogWorkspaceContentGraph({resources})` export consumes exact text carriers;
acquisition, storage, scheduling and payment belong to its callers. The existing
CLI consumes one JSON request on stdin, with a 16 MiB streaming input limit.

```js
import { catalogWorkspaceContentGraph } from "@red-cup-engineering/workspace-content-graph-service";

const graph = catalogWorkspaceContentGraph({ resources: [
  { path: "reading.schema.json", content: JSON.stringify({
    $id: "urn:example:reading", type: "object",
    properties: { temperature: { type: "number" } },
  }) },
  { path: "reading.json", content: JSON.stringify({
    $schema: "urn:example:reading", temperature: 21,
  }) },
] });
```

Version 5 graphs retain package apexes, Markdown structure and schema-admitted
glossary articulation, and add `schemaLineage`. A schema is selected by an observed
`mediaType` of `application/schema+json`, a `.schema.json` filename, or the supported
JSON Schema 2020-12 dialect declaration. An explicit different media type takes
precedence over filename and content hints. An arbitrary `$id` or application
instance `$schema` does not itself classify a carrier as a schema. Duplicate
normalized source paths are rejected; conflicting schema identifiers remain
ambiguous. `package.json` means the exact filename, including nested packages.

Schema traversal and reference resolution use the original JSON Schema service's
`schemaChildren` and `resolveSchemaReference` exports. Data under `examples`,
`default`, `const`, and arbitrary annotations does not become a schema reference.
Each reference retains its JSON Pointer, original reference text, exact carrier
byte address, semantic address, observed resolution and native SignCell
articulation receipt. Resolved links emit both `specified-by` and
`describes-carrier` graph relations with the same source and target witnesses.

An instance's application-defined `$schema` is recorded as a declared association;
it is not an assertion that the instance validates. `schemaLineage.validationPerformed`
is false. Resolution is limited to observed exact identifiers and JSON Pointers
supported by the supplier. URI base changes, anchors, unobserved sources and
duplicate identifiers keep explicit unresolved dispositions. Unsupported supplier
vocabulary appears in `schemaLineage.limitations`. No network retrieval or schema
validation is implied by a link. Glossary admission continues to use the original
schema validator and native SignCell articulation.

Run `npm run verify` for syntax checks and named tests. In runtimes that prohibit
Node child processes, `node --test --test-isolation=none test/*.test.mjs` exercises
the same tests in the current process; verify that the named cases actually enroll.
