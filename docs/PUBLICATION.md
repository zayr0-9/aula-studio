# Public repository contents

The initial public snapshot contains application source/native helpers, dependency lockfile, tests, investigation scripts, historical reports and50evidence JSON files, including the latest physically confirmed per-key capture and matching static getter.

Excluded locally, not deleted:

- Raw PCAP/USB recordings and observation/output logs: may contain keystrokes.
- Proprietary vendor installers, program archives/extracted assets, capture installers.
- Dependencies, build outputs, caches and machine session/editor data.
- Installed Transitions.dev skill collection; applied application CSS is retained with notice.
- Uncurated root static request dumps and six machine-identifying research documents/data files (see root ignore list). Public protocol/capability findings and redacted metadata remain available.

Some historical links point to intentionally excluded artifacts or this Windows machine's tools. Their absence is not a reason to fetch/run vendor executables or weaken device guards. Read CURRENT-HANDOFF.md and MACOS-DISCOVERY-HANDOFF.md first. The OpenRGB source-reference archive retains upstream notices and is accompanied by the verbatim GPL license. No new license for original project code was selected automatically.

Validation before initial publication:81Node tests passed, TypeScript check passed, ESLint passed, git staged whitespace check passed, all50public evidence JSON files parsed with Node JSON.parse. PowerShell ConvertFrom-Json cannot parse one historical evidence object with case-distinct root/Root keys; this is a PowerShell conversion limitation, not invalid JSON. No physical tests were rerun for publication. Credential-format scan found no high-confidence token/private-key patterns in the selected files; this is not a complete security audit.
