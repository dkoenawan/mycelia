# Research: canonical "areas of life" taxonomies and area-bootstrap mechanisms

Supports `docs/adr/0005-default-areas-taxonomy-and-bootstrap.md`. Tracked in
[issue #9](https://github.com/dkoenawan/mycelia/issues/9): `20-areas/` is empty on a
fresh clone, with no default taxonomy and no bootstrap mechanism.

## Question

Two related questions:

1. Is there a canonical default "areas of life" taxonomy mycelia should ship as a
   generic framework-level starting template for `20-areas/`?
2. What mechanism should generate that starting set into an operator's actual vault,
   in a way that is (a) consistent with mycelia's framework/configuration boundary —
   `20-areas/*` is gitignored except `README.md`, so no real vault content is ever
   committed — and (b) customizable, since the operator's own list is one instance
   among many an installer might want?

## Survey

Four sources were checked: Tiago Forte's PARA method (the method this vault already
implements), the Wheel of Life coaching model, GTD's Horizons of Focus, and default
templates shipped by popular PKM tooling (Notion "Life OS" templates, Obsidian
community PARA templates).

**PARA (Tiago Forte).** The defining distinction: a **Project** is "a series of tasks
linked to a goal, with a deadline"; an **Area** is "a sphere of activity with a
standard to be maintained over time" — no deadline, no done state. Forte does not
publish one canonical areas-of-life list — Areas are explicitly meant to mirror the
individual's actual roles and responsibilities, work and life blended in the same
category (e.g. "direct reports" sits alongside "health" as equally valid Areas).
Where Forte gives examples, they group into activities/places (home, travel),
people (parents, spouse), and standards of performance (health, finance, personal
growth).

**Wheel of Life.** Originated by Paul J. Meyer, 1960s. Near-universally implemented
with 6-8 categories, deliberately kept small to avoid overwhelming the exercise. The
most commonly cited 8: Career, Finances, Health, Family/Friends, Romance, Personal
Growth, Fun/Recreation, Physical Environment. Explicitly customizable per person —
coaches routinely substitute or add categories (Community, Spirituality).

**GTD Horizons of Focus (David Allen).** Areas of Focus sit at Horizon 2 (20,000 ft),
above Projects (Horizon 1, 10,000 ft) — defined as areas requiring maintenance to
keep running smoothly, explicitly *not completable*, the same Project/Area
distinction PARA draws independently. GTD's own trigger lists split Areas into
professional (staff development, marketing, facilities) and personal (health,
finances, home management, relationships, community), and state plainly that "many
Areas of Focus are common to all of us" while stressing the list stays individual.

**PKM tooling defaults.** Obsidian community PARA templates generally ship Areas
empty or example-only, consistent with Forte's own stance. Notion "Life OS"
templates — a distinct, widely-cloned genre — more often *do* ship a default
Areas/Life-Domains set: commonly Health, Career, Finance, Learning, Creative,
Relationships, Personal.

## Convergence

No source publishes one official default list — all four frameworks treat Areas as
inherently personal, and every one of them ships (or recommends) an *editable*
starting point rather than a fixed schema. But the category themes converge tightly:

| Category theme | PARA | Wheel of Life | GTD | Notion Life OS |
|---|---|---|---|---|
| Health | ✓ | ✓ | ✓ | ✓ |
| Finances | ✓ | ✓ | ✓ | ✓ |
| Career / Work | ✓ | ✓ | ✓ | ✓ |
| Relationships / Family | ✓ | ✓ | ✓ | ✓ |
| Personal Growth | ✓ | ✓ | — (implicit) | ✓ |
| Home / Environment | ✓ | ✓ | ✓ | — (folded into Personal) |
| Recreation / Hobbies | — | ✓ | ✓ (creative) | ✓ (Creative) |
| Community / Social | — | (sometimes) | ✓ | — |

The convergent generic set is 6-8 categories: **Health, Finances, Career/Work,
Relationships, Personal Growth, Home/Environment, Recreation**, optionally
**Community**. An individual's own list typically maps onto this convergent set
plus a few narrower facets that no source converges on as universal. That isn't a
taxonomy error — Forte and GTD both explicitly expect Areas to be personal above and
beyond any convergent default — but it is why the generic framework default stays at
the convergent core rather than absorbing any one person's facets.

## Mechanism precedent already in this repo

Two existing patterns are directly reusable rather than needing anything new:

- **`control/estate.example.yaml` → `control/estate.local.yaml`.** The framework
  commits a schema-by-example file; `scripts/install.sh`'s `seed_local()` copies it
  to a gitignored local file only if absent, never overwriting. This is exactly the
  "committed generic default, customizable local instance" shape the areas problem
  needs.
- **`20-areas/*` gitignore exception for `README.md` only.** No vault-content
  directory has ever committed an actual note as an exception before — every file
  under the PARA directories other than `README.md` is untracked, confirming there's
  no existing precedent for committing example vault notes directly. This rules out "commit N example `.md` files directly" as
  a mechanism consistent with the repo's existing boundary, and points toward the
  `*.example.yaml` → generator-script shape instead: the *data* (default area list)
  is committed as a small manifest, not as note files, and a script turns that
  manifest into real (gitignored, local) notes on request.

## Implication for the decision

The ADR should adopt the convergent 6-8 category set as the framework's committed
generic default (as a data manifest, not example note files), and reuse
`install.sh`'s seed-local pattern for a new `scripts/bootstrap-areas.sh` that turns
the local manifest (seeded from the generic default) into real
`20-areas/*.md` notes — giving both an out-of-the-box default for a fresh install
and a documented path for any installer, including the operator, to run their own
taxonomy through the same mechanism.
