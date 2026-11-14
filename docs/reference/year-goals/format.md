# Reference: the year-goals note

A year-goals note holds one year's goals: one or more **main goals**, each drafted as a
Mandala Chart (a centre goal, up to 8 pillars that serve it, and up to 8 actions per
pillar), a short list of **secondary goals**, the **areas** each one touches, a sign-off
**status** and a dated **changes** section. Each year has one such note. It's plain
Markdown with the vault's frontmatter, so it reads as text in any Markdown preview, with no
mycelia or Obsidian plugins.

- **Template:** [`template.md`](template.md), a valid note with placeholder text. Copy it,
  or let the goal-setting session write the draft for you.
- **Example:** [`example-2027-goals.md`](example-2027-goals.md), a complete signed-off note:
  2 main goals (8 and 3 pillars, one pillar with 8 actions), 2 secondary goals and 1 change.
  It uses only the default areas from `control/areas.example.yaml`, so validating it in a
  vault without one of those areas gives a warning.

Code: `src/goals/` (`domain/` parses and validates; `application/` holds the use cases).
Commands: `npx mycelia goals …` (see [Commands](#commands)).

## Files

| File | What it is | Written by |
|---|---|---|
| `00-inbox/<year>-goals.md` | The draft for the year, `status: draft`. In the inbox root, so it's never ingested | `mycelia goals session` (through `save-draft`), or the operator |
| `01-vision/<year>-goals.md` | The year's **current goals**, `status: signed-off` | `mycelia goals sign-off` only |
| `40-archive/vision/<year>-goals-replaced-<date>.md` | A signed-off note replaced by a later sign-off on `<date>`, byte for byte as it was. Its `name:` keeps the original `<year>-goals`, an accepted exception for archived goals | `mycelia goals sign-off` |

All three are vault content and gitignored. The commands refuse to write a path that
`git check-ignore` doesn't report as ignored. Nothing here writes to `20-areas/`: the area
names are only read.

A year's **current goals** are its `01-vision/<year>-goals.md` with `status: signed-off`.
Until that exists, downstream agents see no goals for the year, whatever drafts exist.

## Frontmatter

| Key | Required | Value |
|---|---|---|
| `name` | yes (vault convention) | `<year>-goals`, the file name's stem |
| `description` | yes (vault convention) | One line |
| `type` | yes (vault convention) | `vision` |
| `year` | yes | A four-digit year, such as `2027` |
| `status` | yes | `draft` or `signed-off` |
| `signed_off` | set at sign-off | The sign-off date, `YYYY-MM-DD` |
| `created`, `updated` | yes (vault convention) | `YYYY-MM-DD` |

Only `year` and `status` are checked by the validator. The rest follow the vault's note
format (`CLAUDE.md`).

## Layout

Headings and lists. The headings below are recognised by their prefix (case doesn't
matter). Everything else is extra content (see [Extra content](#extra-content)).

```markdown
## Main goal: <centre goal>

### Pillar: <pillar>

Areas: [[<area>]], [[<area>]]

- <action>
- <action>

## Secondary goals

- <goal> Areas: [[<area>]]
- <goal>

## Changes

- YYYY-MM-DD: <what changed>
```

| Element | Written as | Rules |
|---|---|---|
| Main goal | `## Main goal: <centre goal>`, a level-2 heading | One or more, in note order. The text after the colon is the chart's centre goal |
| Pillar | `### Pillar: <name>`, a level-3 heading under a main goal | Up to 8 per main goal (the chart's 8). A partly filled chart is valid |
| Areas touched | `Areas: [[a]], [[b]]`, a line under a pillar's heading | Zero or more `[[wikilinks]]` to `20-areas/` notes. `[[a\|alias]]` and `[[a#heading]]` count as `a`. They mark where knowledge accumulates and put nothing into the area notes |
| Action | `- <action>`, a top-level list item under a pillar | Up to 8 per pillar. A pillar may have none yet |
| Secondary goal | `- <goal> Areas: [[a]]`, a top-level list item under `## Secondary goals` | Zero or more. One line each, with no chart. The `Areas:` part is optional |
| Change | `- YYYY-MM-DD: <text>`, a top-level list item under `## Changes` | Zero or more. Free text, for example a goal achieved early or abandoned. Read oldest first, whatever order they're written in |

A goal worth charting is a main goal. Anything lighter is a secondary goal. More than 3
main goals is allowed but strongly discouraged.

### Extra content

Content the format doesn't define stays in place, gets no error, and doesn't change what's
read. That includes a breakdown of a goal into sub-goals or quarterly goals, paragraphs,
nested list items, code blocks and other headings. The rules:

- A `#` heading, or a `##` heading other than the three above, ends the section it's in.
- Under a main goal, a heading of level 3 or deeper that isn't `### Pillar:` ends the pillar,
  so list items under it aren't actions. Under `## Secondary goals` or `## Changes`, any
  sub-heading ends what's read there.
- Nested (indented) list items are never actions, secondary goals or changes.
- List items under a main goal but before its first pillar aren't actions.

A mistyped prefix, such as `## Main gaol: …`, is read as extra content, so the goal drops
out silently. `mycelia goals validate` prints a summary of what it found, so check that the
counts are what you expect.

## Errors and warnings

The validator reports **errors**, which reject the note, only for content that makes it
unreadable as a year-goals note. Every rule about how you structure your goals is a
**warning**, which never rejects it. Each finding names where it is: `frontmatter: <key>`,
`body`, or `line <n>` with the goal and pillar it's under.

| Severity | When |
|---|---|
| error | The frontmatter is missing or unparseable |
| error | `year` is missing or isn't a four-digit year (for example `27`) |
| error | `status` is missing or isn't `draft` or `signed-off` |
| error | There's no goal at all: no main goal and no secondary goal |
| error | A main goal, pillar, action or secondary goal has empty text |
| error | A changes entry has no date, a date that isn't a valid `YYYY-MM-DD` date (for example `2027-13-01`), or no description |
| warning | More than 3 main goals: above the recommended 3. Consider turning some into pillars, sub-goals or secondary goals |
| warning | A main goal has more than 8 pillars, or a pillar more than 8 actions: above the chart's 8 |
| warning | A main goal has no pillars: consider making it a secondary goal |
| warning | A pillar or secondary goal names an area with no note in `20-areas/` |

## Commands

Run from the repository root, as `npx mycelia goals …`, `npm run mycelia -- goals …`, or
`mycelia goals …` after `npm link`.

| Command | Does | Exit codes |
|---|---|---|
| `goals validate <path>` | Checks one note: prints each error and warning with its location, then a summary of the goals found | 0 no errors (warnings allowed) · 1 errors · 2 usage error or unreadable file |
| `goals session <year> [--continue]` | Checks that Claude Code is installed and logged in, then starts the goal-setting conversation. The agent can't write anything except through `save-draft` for that year (read-only commands inside the repo are allowed), which it runs after each agreed step, so stopping early keeps what was agreed. Refuses if the year already has a draft in the inbox, unless `--continue` is given, which starts from that draft and rewrites it. When the conversation ends, it validates the draft and prints the sign-off command | 0 a valid draft was written · 1 no draft, or a draft with errors · 2 can't start: bad year, Claude Code missing or logged out, a draft exists without `--continue`, or an output path isn't gitignored. Nothing was changed |
| `goals save-draft <year> [<json>]` | Writes the draft `00-inbox/<year>-goals.md` from a structured draft, given as the one argument or on stdin (see below). Keeps the existing draft's `created` date | 0 saved · 1 refused, nothing changed: invalid JSON or shape, no goal at all, or the inbox file for the year isn't a draft · 2 usage error, or an output path isn't gitignored |
| `goals sign-off <year>` | Validates the year's inbox draft, prints any warnings, and on no errors makes it the year's current goals: sets `status: signed-off`, `signed_off` and `updated` to today, and moves it to `01-vision/`. If the year already has current goals, the earlier note moves unchanged to `40-archive/vision/`, its changes entries are carried over, and one dated entry records the update | 0 signed off · 1 refused, nothing changed: no draft, errors, not a draft, or a different year in its frontmatter · 2 usage error, or an output path isn't gitignored |

Sign-off writes in this order: the new note to a temporary file in `01-vision/`, a copy of
the earlier note to the archive, the temporary file renamed into place, then the inbox draft
removed. The earlier note is always either current or archived, and re-running sign-off
after a crash is safe.

### The structured draft

```json
{
  "mainGoals": [
    {
      "centre": "Run a marathon under 3:30",
      "pillars": [
        { "name": "Endurance", "areas": ["health"], "actions": ["Run four times a week"] }
      ]
    }
  ],
  "secondaryGoals": [
    { "text": "Read 24 books", "areas": ["personal-growth"] }
  ]
}
```

`pillars`, `areas`, `actions` and `secondaryGoals` may be left out or empty. Every text is
one line. Area names are slugs, written with or without `[[ ]]`.
