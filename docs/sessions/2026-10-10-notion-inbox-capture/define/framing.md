# Framing: Notion inbox: capture from phone into the vault inbox

> Part of [index](index.md) · Define

## Problem checks

### Solution-first (XY)

- **Need behind the request:** when the operator is away from the Linux machine that holds the vault and has only their phone, they want to capture a thought or a link in seconds and have it reach the vault's capture flow without moving it there by hand later. They also want to see from the phone what happened to each capture. See NEED-01 and NEED-02 in [problem.md](problem.md).
- **Outcome:** the requested fix moved to Candidate solutions. The operator confirmed on 2026-10-10 that phone capture is the need and Notion is the chosen candidate. Notion is the only capture source built this session. The requirements stay source-neutral where that costs nothing: the glossary in [requirements.md](requirements.md) defines "capture source" and "source inbox", and only setup and the source inbox's shape name Notion.

**Candidate solutions:**
- **Chosen:** a Notion database as the phone-side inbox. A setup command creates it from a template given an API key. A scheduled pull brings each row into the vault, ingests it through the existing ingester, and writes the outcome back to the row's status (issue #21, as stated by the operator).
- Noted, not built: Obsidian mobile with a git sync of the vault; email-to-inbox; a chat bot that writes to the capture folder. These are recorded only so a later session for another source can start from here.

### Symptom and cause

- **Observed symptom:** to add a note to `00-inbox/` today, the operator has to open an editor on the Linux machine that holds the vault, which is impractical when they're away from it [observed: issue #21, operator's words].
- **Cause:** known and structural, not a defect. The only way into the capture flow is a file in `00-inbox/capture/` on that machine (ADR-0006), and the framework has no remote or mobile capture path yet. The README roadmap lists "a mobile surface for reading and capture" under Layer 3, not built [observed: `README.md` Roadmap, `00-inbox/capture/README.md`]. How many captures are lost or delayed today isn't measured [assumed].

## Anchor

- **State:** complete. Markers appear exactly once, in order (README.md lines 191 and 215). Vision, Mission, Scope and Non-goals are present and non-empty. No conflicting restatement was found: "Design commitments" ("Plain Markdown in git. No database, no proprietary store.") matches the non-goal and doesn't contradict it.
- **Verdict:** aligns. Confirmed by the operator on 2026-10-10.
- **Rests on:**
  - Scope line "Agent workflows that capture, file, connect and summarise vault content": phone capture feeding the ingester is a capture workflow.
  - Scope line "Framework only: generic defaults and schemas; every operator's notes and estate stay local configuration": the template is generic, and the key and IDs stay in local config (REQ-004, REQ-040, REQ-041).
  - Non-goal "A database or proprietary store; the vault stays plain Markdown in git": not crossed. The Notion database is a transit queue on the phone side. The vault stays the store of record, and every capture lands as plain Markdown.
  - Non-goal "Committing an operator's notes, estate or paths to the framework repository…": not crossed (REQ-027, REQ-041).

### Anchor update

- **Action:** none
- **Elements:** none
- **Agreed text:**

none

## Overlaps

There's no construct registry (`docs/registry/`). ADRs live in `docs/adr/`, and I searched them.

- **Overlap (reused, not duplicated): ADR-0006 inbox ingester (`task ingest-inbox`, `src/ingest/`).** It already turns a file in `00-inbox/capture/` into a linked resource note, with injection layers, per-item checks, rollback, asks, a ledger and a daily-note summary. The operator chose that the pull run also ingests its own items in the same run (Q4), but through this ingester and its security layers, not a copy of them (REQ-014, REQ-026). The connector adds transport, status write-back and setup.
- **Constraint: ADR-0006 `commits: false` exception, and CLAUDE.md "`commits: false` is a defect" and "committed ledger".** Everything a pull run writes is gitignored vault content or local state (captures, resources, asks, the daily note, its ledger). Setup writes only gitignored local config. So the job meets ADR-0006's condition for `commits: false` with a registry `note` (REQ-027, REQ-037).
- **Constraint: ADR-0006 capped batch, an exception to CLAUDE.md "one unit of work per run".** The pull run uses the same shape: oldest first, at most 10 items, each with its own check, rollback and ledger record (REQ-010, REQ-031).
- **Overlap: #16 (configurable batch policy: order, cap, cadence).** The operator wants the pull's schedule to be configurable (Q8). This session meets that through the scheduler entry alone. The connector assumes no interval between runs (REQ-035), and the registry entry records the chosen cron (REQ-037). Order and cap stay fixed (oldest first, 10), as ADR-0006 has them. Making them configurable stays #16, which should then cover both `ingest-inbox` and the pull run. No requirement is deferred to #16 here.
- **Tension, not conflict: ADR-0006 "no egress is the main containment".** That rule governs the ingester's agent, which still gets no network or Notion access. The connector's own deterministic code adds an outbound, credentialed channel to one service. That's new for the framework, so REQ-022, REQ-025 and REQ-026 bound it. Whether it needs its own ADR is a Design call.
- **Constraint: ADR-0002 and the CLAUDE.md framework/configuration boundary.** The API key, the source inbox ID and every capture stay local. Only the template, the code and the example registry entry are committed (REQ-040, REQ-041).
- **Aligns: ADR-0005 (areas taxonomy).** The optional area-or-project hint maps to an existing area or project slug, as the ingester's `[[link]]` hint does (REQ-023).
- **Aligns: ADR-0007 (TypeScript on Node runners).** The connector is a runner under `src/`, gated by `task check:node`. Nothing here contradicts it.
- **No conflict found** with ADR-0001 (Taskfile entrypoints: REQ-001), ADR-0003 (session write-back: not affected) or ADR-0004 (release smoke test: REQ-038).
