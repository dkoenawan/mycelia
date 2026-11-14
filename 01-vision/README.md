---
name: vision-readme
description: What belongs in the vision folder and how year-goals notes get there
type: reference
created: 2026-11-14
updated: 2026-11-14
---

# 01-vision

The operator's direction: one signed-off year-goals note per year, named `<year>-goals.md`
(for example `2027-goals.md`). Each holds that year's main goals, each drafted as a Mandala
Chart, its secondary goals, and a dated changes section. The goal-pursuit agents read a
year's goals from here, and only from here.

**How notes get here: by sign-off only.** Don't write or move a note into this folder by hand.

1. `npx mycelia goals session <year>` starts an agent-guided conversation. Its draft lands
   in the root of `00-inbox/` as `<year>-goals.md` with `status: draft`. Review or edit it there.
2. `npx mycelia goals sign-off <year>` validates the draft, sets `status: signed-off` and
   the sign-off date, and places it here. A draft is never anyone's goals until it's signed off.
3. Signing off again for the same year makes the new draft current, carries the earlier
   note's changes over with one dated entry recording the update, and moves the earlier note,
   unchanged, to `40-archive/vision/`.

The format, a template and a complete example are in
[`docs/reference/year-goals/`](../docs/reference/year-goals/format.md).

**The content stays local.** Like every other vault folder, `01-vision/` ships with only this
README. Your goals are configuration, not framework, and are gitignored.
