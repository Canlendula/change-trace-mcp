# M6 runtime-report format evidence

> Evidence snapshot: 2026-07-26
> Purpose: support the M6 normalized runtime-evidence boundary

## Scope

M6 must ingest existing test and staging evidence without freezing one test
vendor's complete report object into the Change Trace public contract. This
record distinguishes upstream report capabilities from the stable normalized
fields Change Trace needs.

## Official format evidence

### Playwright

Playwright documents built-in JSON, JUnit, HTML, GitHub, and blob reporters.
The JSON reporter produces a comprehensive Playwright-specific object. The
blob reporter is intended for later merging and can carry report details and
attachments. The JUnit reporter produces an XML file and exposes
Playwright-specific configuration.

Playwright release notes also record changes to reporter semantics, including
classifying some outcomes as JUnit `error` where earlier versions used
`failure`. This is normal upstream evolution, but it makes a complete
Playwright report object unsuitable as the stable Change Trace core Schema.

The current public `JSONReport` interface contains configuration, nested
suites/specs/tests/results, errors, stats, stdout/stderr, steps, annotations,
and attachments whose bodies may be base64-serialized. M6-004 therefore pins a
small offline mapping profile and preserves only bounded outcome/timing
metadata plus path/URI artifact references.

Sources:

- [Playwright reporters](https://playwright.dev/docs/test-reporters)
- [Playwright reporter API](https://playwright.dev/docs/api/class-reporter)
- [Playwright sharding and blob reports](https://playwright.dev/docs/test-sharding)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [Playwright JSONReport interface](https://github.com/microsoft/playwright/blob/main/packages/playwright/types/testReporter.d.ts)
- [Playwright JSON reporter implementation](https://github.com/microsoft/playwright/blob/main/packages/playwright/src/reporters/json.ts)

### JUnit XML in CI

GitLab accepts JUnit XML test artifacts but documents that it parses a subset
of elements and attributes. It ignores other commonly emitted fields and
applies platform-specific file, aggregate-size, and duplicate-test rules.
This is evidence that “JUnit XML” is an interoperability family rather than a
single sufficiently precise product contract for Change Trace.

As of this evidence snapshot, GitLab documents a 30 MB individual-file limit,
a 100 MB per-job aggregate limit, first-result handling for duplicate test
names, and a defined subset of suite/case elements and attributes. These are
platform rules, not a universal JUnit specification.

Sources:

- [GitLab unit test reports](https://docs.gitlab.com/ci/testing/unit_test_reports/)
- [GitLab unit test report examples](https://docs.gitlab.com/ci/testing/unit_test_report_examples/)

### CI/CD run semantics

OpenTelemetry publishes CI/CD semantic conventions for pipeline run duration,
state, and result. These conventions are useful vocabulary evidence, but they
do not define the bounded test summaries, missing-access records, artifact
references, change links, and requirement-evidence links required by Change
Trace.

Source:

- [OpenTelemetry CI/CD metrics semantic conventions](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-metrics/)

## Product conclusion

M6 uses a versioned, strict normalized runtime manifest as its stable producer
boundary. JUnit, Playwright, API-smoke, browser-MCP, and CI-specific inputs are
mapped into that manifest by bounded converters. The core contract retains:

- producer identity and input format;
- source and environment identity;
- runtime evidence kind and outcome;
- start/completion timing when supplied;
- related change and requirement-evidence IDs;
- bounded summary text and artifact references;
- explicit unavailable or inaccessible records;
- truncation and redaction metadata after normalization.

The core does not store or interpret complete screenshots, traces, videos,
HTML reports, raw logs, or vendor-private object graphs. It records bounded
references to those artifacts. Converter compatibility is tested and claimed
per format/version; it does not redefine the normalized Schema.

## M6-004 proof profile

Decision 30 selects checked-in offline mapping fixtures for a JUnit-style
subset, a pinned Playwright JSON reporter shape, a project-owned API-smoke
shape, and staging environment metadata. The fixtures prove the normalized
manifest, MCP collection, relationship, bundle, and report path. They do not
claim a general XML parser, arbitrary Playwright-version compatibility, live
API behavior, or staging reachability.
