# Single custom configuration query — result

Owner closed official app and authorized step 2. `Get-Process OemDrv` found no process; helper rechecked immediately before sending. Exactly one captured SetFeature query (520 bytes, header 06 84 00 00 01 00 80 00, zero tail) and one GetFeature(report ID 6) succeeded. No retry or configuration setter was used. Zero-access shared handle was opened only for exact VID258A/PID010C/MI01/COL06 after unique-match enumeration; vendor usage FF00/1, feature520 and reportID6 capability checks passed.

Saved API buffer: [configuration-query-once.json](evidence/configuration-query-once.json). Offline validator confirmed query matches capture, valid response header/mode/marker/zero padding, brightness9, and all128 configuration bytes exactly equal the final restored configuration from captured frame19. No differences.

Limit: HidD_GetFeature exposes success but no actual transferred length. This is a fresh zero-initialized520-byte API buffer, not independently captured USB completion length. No new USB capture was started. This verifies this one query/application boundary, not every query, safety across firmware revisions, or persistence. Owner should confirm typing and lighting remain normal. No custom configuration writes authorized/performed; Electron remains simulator-only.

Implementation: `../scripts/query-configuration-once.ps1` (one-shot transport helper), `../app/tests/validate-live-query.mjs` (offline only). Independent static review caught serialization of read-only C# properties before any device execution; fixed to copy into ordered dictionary, compiled/tested serialization offline, then ran once. Regression:11 tests, lint, typecheck, Prettier passed.
