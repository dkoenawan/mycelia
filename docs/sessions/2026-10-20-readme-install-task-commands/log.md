---
session: 2026-10-20-readme-install-task-commands
type: feature
issue: 10
phase: close
status: active
# milestone: the PHASE KEY of the last completed milestone, not a display
# label. Allowed values (feature workflow): none | define | design |
# implement | test | deploy | close. "none" until the first milestone
# (Define complete) is reached. The guard hook (D7) uses this key, plus
# each phase's `order` in workflows/<type>.json, to decide which
# artifacts are frozen. Display labels (e.g. "Define complete") live only
# in workflows/<type>.json's `milestone` field, for GitHub comments.
milestone: deploy
active_agent: main
next_step: "Close: compass-labs:close folds the session into as-built docs; operator merges the session PR"
---
# Session Log: Root README Install section: use task install / task bootstrap-areas (#10)

> Format: D2. Only the orchestrator writes this file. Entries are append-only.
> Artifacts: [`define/index.md`](define/index.md) · [`design/index.md`](design/index.md) · [`implement/tasks.md`](implement/tasks.md) · [`verification.md`](verification.md) · [`release.md`](release.md)

## Open items

- Work runs on branch `docs/issue-10-readme-install`; one PR carries the whole session, including Close.

## Key decisions

- **2026-10-24**: ✅ Deploy complete — release.md approved; fresh-clone smoke test 8/8; manifest complete; v0.4.2 after merge.
- **2026-10-24**: Tag v0.4.2 (ADR-0004 PATCH) after the squash-merge; the operator pushes the tag.
- **2026-10-24**: ✅ Test complete — VER-001…VER-011 all pass; traceability ok; fresh-clone install passes doctor 14/14 with 7 area notes.
- **2026-10-24**: ✅ Implement complete — DES-001 and DES-002 built as designed, no variations (628b85a, f9b6c8b).
- **2026-10-24**: ✅ Design complete — operator approved design/index.md (DES-001 README Install, DES-002 install.sh next steps).
- **2026-10-24**: D1 A: README steps as a numbered list, one command block per step; D2 A: install.sh gains a new step 3 `task deps:node`, later steps renumbered 4–7.
- **2026-10-24**: Design kind Plugin/tooling; scope confirmed: README `## Install` + install.sh printed next steps only, text only.
- **2026-10-24**: ✅ Define complete — operator approved REQ-001…REQ-011 (tier short, scope option B).
- **2026-10-20**: Requirements agreed — REQ-001…REQ-011 (9 Must, 2 Should, none deferred); README and install.sh give the same full order; fresh clone passes doctor with 7 area notes.

- **2026-10-20**: Follow-up #25: doctor treating Node and Claude Code as optional for installs that don't run the ingester.
- **2026-10-20**: Tier short; scope option B: README Install section plus install.sh's printed next steps gain `task deps:node` (no behaviour change); doctor optionality deferred to #25.

---

## Phase: Define

### 2026-10-20 — main — note: session opened
- Issue #10 (deferred from #9, design D13): the root README's Install section still shows manual `cp` commands instead of `task install` / `task bootstrap-areas`. The operator asked for the full flow end to end, one subagent per phase with orchestrator review, and a PR that includes Close.

### 2026-10-20 — main — handoff: orchestrator → compass-labs:define (frame + requirements)
- **Input:** Frame the problem and write requirements for #10. The README Install section (README.md ~L61–70) shows `git clone` + two manual `cp` of `control/*.example.yaml` + `$EDITOR`; `task install` (scripts/install.sh, idempotent, never overwrites) and `task bootstrap-areas` (scripts/bootstrap-areas.sh, needs python3+PyYAML) already exist, and `task doctor` verifies. Small docs-only change; operator expects a light tier.
- **Output:** needs_input → done (after one relay); define/index.md, framing.md, problem.md, requirements.md

### 2026-10-20 — compass-labs:define — attempt: Define drafted at the proposed short tier (REQ-001 to REQ-010)
- Tier proposed: short. XY: the issue's fix is the chosen candidate; the need is a complete, supported setup path (NEED-01) and a README matching the tooling (NEED-02). The README also misses go-task (ADR-0001), `task doctor`, and the tools doctor checks.
- Anchor complete, aligns, no update. No ADR conflicts; Notion tutorial/how-to already use the task path.
- Gap found from reading the scripts: `task doctor` (non-CI) requires claude, Node 22.18+ and Node deps, but `install.sh`'s next steps omit `task deps:node`.

### 2026-10-20 — main — note: orchestrator review of the draft
- Verified the gap against `scripts/doctor.sh` (claude, node ≥22.18, deps checks fail outside --ci) and `scripts/install.sh` (next steps go straight to doctor).
- Disagreed with the agent's recommended option A: a README listing `task deps:node` while install.sh doesn't would contradict OUT-02 (no mismatch with install.sh). Recommended B to the operator.
- Operator answered: tier short; option B. Orchestrator created follow-up #25 (doctor treating Node/Claude Code as optional) and relayed both answers, plus a request to tighten REQ-007 to the full shared order.

### 2026-10-20 — main — decision: follow-up #25 created
- Deferred from this session: whether `task doctor` should treat Node and Claude Code as optional for installs that don't run the ingester. Tracked in #25, listed in define/index.md Non-goals.

### 2026-10-20 — compass-labs:define — decision: Tier short and scope option B confirmed
- **Tier: short**, confirmed by the operator. Docs-only change to one README section plus one line of a script's printed text.
- **Scope: option B.** The root README's `## Install` section and the next steps `scripts/install.sh` prints; the printed next steps gain `task deps:node` before `task doctor` (REQ-011). No script behaviour changes.
- **Moved to a follow-up:** doctor optionality for Node and Claude Code, #25. Until then, the README lists both as prerequisites (REQ-002).
- **Anchor:** complete, aligns, no update (action: none).

### 2026-10-20 — compass-labs:define — decision: Requirements agreed (REQ-001 to REQ-011)
- 11 live requirements: 9 Must, 2 Should. None deferred.
- `task install` replaces the manual `cp` lines; prerequisites and platforms listed; edit steps, `task deps:node`, `task doctor`, the areas edit and `task bootstrap-areas` appear in order, then open in Obsidian; re-running `task install` is safe; a fresh clone set up from the README passes `task doctor` with 7 area notes (REQ-010); `install.sh`'s printed next steps add `task deps:node` (REQ-011).
- REQ-007 tightened per orchestrator review: README and install.sh's next steps give the same full order.
- OUT-01: fresh clone passes doctor and has its area notes. OUT-02: zero mismatches with Taskfile.yml and install.sh.

### 2026-10-24 — main — milestone: ✅ Define complete
- Operator approved the requirements, REQ-001 to REQ-011 (9 Must, 2 Should, none deferred), at the Define gate.
- a3 check: anchor-update action is `none`, so no README anchor write is needed.

---

## Phase: Design

### 2026-10-24 — main — handoff: orchestrator → compass-labs:design (design README Install + install.sh next steps)
- **Input:** Design for #10 from frozen define/ (REQ-001 to REQ-011, tier short, option B). Docs-only: README `## Install` section and `scripts/install.sh` printed next steps; no behaviour change. Operator expects a light design.
- **Output:** needs_input → done (after one relay: kind Plugin/tooling, scope confirmed, D1 A, D2 A); design/index.md

### 2026-10-24 — compass-labs:design — attempt: Design drafted for #10, awaiting kind/scope confirmation and D1/D2
- Proposed kind: Plugin/tooling (no in-depth path, compass-labs#51). Scope in: the README `## Install` section and the install.sh next-step lines only. Everything else is out.
- DES-001 (README Install section, REQ-001 to REQ-010) depends on DES-002 (install.sh next steps, REQ-011 and REQ-007). All 11 live REQs covered. Order: DES-002 → DES-001.
- D1 (README layout) and D2 (install.sh step shape) open, option A recommended for both. No traded-off principles. Rejected under YAGNI: go-task check in the Taskfile, direct-script equivalents, doctor optionality (#25), a mechanical README/install.sh order check, edits to other docs.
- Optional Mermaid render check didn't run (permission denied); the context view hasn't been parse-checked.

### 2026-10-24 — compass-labs:design — decision: Classification and scope confirmed
- **Kind: Plugin/tooling**, confirmed by the operator. No in-depth path yet (compass-labs#51), so the design is `design/index.md` only.
- **Scope, confirmed as drafted:** In: the root README `## Install` section, and the next-step `log` lines `scripts/install.sh` prints (text only). Out: Taskfile.yml, doctor.sh, bootstrap-areas.sh, scripts/lib (doctor's optional checks are #25); process/workflow; infrastructure/CI; frontend, backend, database; visual UI; tutorial, how-to and other README sections.

### 2026-10-24 — compass-labs:design — decision: D1 and D2 chosen (option A both)
- **D1, README layout: A.** Numbered list, one step per item, each command in its own short code block; lines up with install.sh's steps so REQ-007's order can be checked by eye. B (single commented bash block) rejected.
- **D2, install.sh step: A.** New step 3 "Run 'task deps:node' (or npm ci) …", later steps renumbered 4 to 7. B (fold into the doctor step) rejected.
- Neither is architecture-level; no ADR. No principle traded off.

### 2026-10-24 — compass-labs:design — attempt: Design ready for the gate
- DES-001 README Install section (REQ-001 to REQ-010); DES-002 install.sh next steps (REQ-011, REQ-007). Order: DES-002 → DES-001. All 11 live REQs covered.
- Mermaid parse check not run (mermaid-cli denied).

### 2026-10-24 — main — milestone: ✅ Design complete
- Operator approved design/index.md at the Design gate: DES-001 (README Install section, REQ-001 to REQ-010) and DES-002 (install.sh printed next steps, REQ-011, REQ-007). Order DES-002 → DES-001.
- a4: check-design.sh ok. Mermaid context view not parse-checked (mermaid-cli denied).

---

## Phase: Implement

### 2026-10-24 — main — handoff: orchestrator → compass-labs:implement (build DES-002, DES-001)
- **Input:** Build from frozen design/index.md: DES-002 (install.sh next-steps text) then DES-001 (README Install section). Write implement/tasks.md and implement/as-built.md; commit per task.
- **Output:** done; scripts/install.sh, README.md, implement/tasks.md, implement/as-built.md

### 2026-10-24 — compass-labs:implement — attempt: DES-002 built, install.sh prints task deps:node as step 3
- New step 3 in `scripts/install.sh`'s "Next steps:" lines; old steps 3 to 6 renumbered 4 to 7. Only those `log` lines changed; `bash -n` passes. Commit 628b85a.

### 2026-10-24 — compass-labs:implement — attempt: DES-001 built, README Install section rewritten
- Prerequisites paragraph, seven numbered steps in `install.sh`'s order, closing Obsidian line. Task names checked against `Taskfile.yml`; no cp/$EDITOR/script paths, absolute paths or real URLs. Commit f9b6c8b.

### 2026-10-24 — compass-labs:implement — note: Implement ready for the gate
- `implement/as-built.md`: DES-001 and DES-002 built as designed, no variations. README step numbers sit one off from install.sh's (README step 1 is clone + `task install`; install.sh step 7 is the README's closing paragraph); relative order is identical, as REQ-007 asks. Three checks handed to Test, including the REQ-010 fresh-clone run.

### 2026-10-24 — main — milestone: ✅ Implement complete
- Operator approved the as-built at the Implement gate: DES-002 (628b85a) and DES-001 (f9b6c8b) built as designed. No variations, so no variation decisions were needed.

---

## Phase: Test

### 2026-10-24 — main — handoff: orchestrator → compass-labs:test (verify REQ-001 to REQ-011)
- **Input:** Write verification.md with a VER-* row per REQ-001 to REQ-011, running the three checks handed over in implement/as-built.md, including the REQ-010 fresh-clone run in a scratch directory.
- **Output:** done; verification.md

### 2026-10-24 — compass-labs:test — attempt: Verification written, all REQ-001 to REQ-011 pass
- VER-001 to VER-011, all passing, at 6aa76a9. VER-001 to VER-009: inspection of the README Install section against `Taskfile.yml` and `install.sh`. VER-010 (REQ-011): fresh-clone `task install` seeds the same three files and prints `task deps:node` (step 3) before `task doctor` (step 4). VER-011 (REQ-010): fresh-clone end-to-end, `task doctor` 14/14 passed, `task bootstrap-areas` created 7 `20-areas/` notes. `check-traceability.sh` exits 0.

### 2026-10-24 — compass-labs:test — note: First doctor run failed because of a test-setup error, not the build
- In VER-011 the first `task doctor` run failed its `version:` check because the tester replaced `estate.local.yaml` with a file lacking `version:`. Following the README ("leave the jobs list empty", keep the rest of the file) passes. No code or README change needed.

### 2026-10-24 — main — milestone: ✅ Test complete
- Operator approved verification.md at the Test gate. check-traceability.sh: every REQ-* has a passing VER-* (exit 0).

---

## Phase: Deploy

### 2026-10-24 — main — handoff: orchestrator → compass-labs:deploy (write release.md)
- **Input:** Write release.md for #10: version/target (latest tag v0.4.1; ADR-0004), what changed, Completeness checked in a fresh clone of the pushed branch HEAD. No PR exists yet; the orchestrator opens it. Don't push, tag, merge or open a PR.
- **Output:** done (one question for the gate: tag v0.4.2?); release.md

### 2026-10-24 — compass-labs:deploy — attempt: release.md drafted for #10
- Smoke test on a fresh clone of pushed HEAD `f15eea6`: `task install && task doctor:ci` exited 0, doctor 8/8. Completeness checked against `git diff --name-status origin/main...HEAD` (11 entries, as it ships): only complete components, none left out. Proposed `v0.4.2` (ADR-0004 PATCH; schema axis unchanged at 1); tagging left to the operator. Target `main` through the session PR, squash-merged at Close.

### 2026-10-24 — compass-labs:deploy — note: hygiene scan result
- Only hits in the branch's added lines: two citations of the public GitHub owner handle (`<owner>/compass-labs#51`) in `design/index.md`, as archived releases already do. No absolute home paths, email addresses or gendered pronouns in `README.md` or `install.sh`.

### 2026-10-24 — main — note: release.md path-hygiene fix requested at the gate
- Orchestrator review found absolute scratchpad paths in release.md that leaked the local username (missed by the agent's own hygiene scan). Relayed a fix with the gate answers; release.md now has no `/tmp/` or `/home/` strings.

### 2026-10-24 — compass-labs:deploy — decision: tag v0.4.2 for #10
- Operator decided at the Deploy gate to cut `v0.4.2`: SemVer PATCH over `v0.4.1` under ADR-0004 (docs and printed-text fix; no behaviour, schema or surface change; schema axis stays at `version: 1`). The operator pushes the tag on the squash-merge commit after the session PR merges; `release.yml` on that tag is the confirmation of record.

### 2026-10-24 — main — milestone: ✅ Deploy complete
- Operator approved release.md at the Deploy gate. a2: Completeness says the manifest lists only complete components and leaves none out. Fresh-clone `task install && task doctor:ci` 8/8.

---

## Phase: Close
