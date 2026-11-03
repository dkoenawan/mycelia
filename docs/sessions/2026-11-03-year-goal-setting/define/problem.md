<!-- tier: full -->
# Problem: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Part of [index](index.md) · Define

### Context

**Situation:** mycelia organises the operator's material by PARA and grows that structure with agents. Its Vision and Mission say the agent supports one person in reaching their goals, and that yearly goals, set as a Mandala Chart with a primary goal plus secondary goals, steer where the effort goes [observed: README project anchor].

**Complication:** nothing in the framework records what those goals are [observed: no goal format, runner or ADR in the repo, 2026-11-03]. Areas were briefly meant to hold goals (#28), but the operator ruled on 2026-11-03 that areas hold only accumulated knowledge and closed #28 [observed: log.md, Key decisions]. That leaves goals with no home. Meanwhile six follow-on features (#37 to #42) all need the year's goals as their input [observed: issue list relayed by the operator, 2026-11-03].

### Need and stakeholders

- **NEED-01:** When a new year is about to start, the operator wants to set their main goals in a guided conversation with the agent: usually one, rarely more than 3, each drafted as a Mandala Chart (a centre goal, pillars, actions per pillar). They also want to add any secondary goals, without the format confining how they break a goal down. That way mycelia knows what they're working towards without them writing the structure by hand.
- **NEED-02:** When the agent has drafted the year's goals, the operator wants the draft to stay a draft until they sign it off. That way no agent steers by goals they haven't agreed to.
- **NEED-03:** When a downstream goal-pursuit agent (#37 to #42) links, focuses, prioritises, guides or reviews, it needs one dependable, machine-readable statement of the year's signed-off goals and their later changes. That way it can steer without asking the operator.
- **NEED-04:** When someone else installs mycelia, they want the goal format, a template and the folder it lives in to come with the framework, while their own goals never enter the framework repository. That way they can use goal setting without forking it or leaking personal material.

### Evidence

- Mycelia knows where things live but not what the operator is trying to achieve this year. Without stated goals, the agent can only grow the vault evenly [observed: #36, Problem].
- The anchor names yearly goal setting in Scope, the Mandala Chart in Mission, and "Even growth" as a non-goal [observed: README project anchor].
- No note format, runner, script, control file or ADR in the repo mentions goals [observed: repo search, 2026-11-03].
- Areas hold accumulated knowledge, not the operator's state or goals [observed: operator ruling 2026-11-03, log.md; #28 closed as not planned].
- #37, #38, #39, #40, #41 and #42 consume the year's goals [observed: the operator's handoff, 2026-11-03].
- A partly filled chart is valid, and 8 pillars × 8 actions is a maximum, not a requirement [observed: operator answer, 2026-11-03].
- "We can have more than one goal, but highly not recommend more than 3. A yearly goal can be broken to sub-goals or quarterly goals. Let's not confine us too much here." [observed: operator, Define gate, 2026-11-03].
- A goal may be achieved early or abandoned, and signing off again should update the year's goals. The lifecycle is to be kept open for now [observed: operator, Define gate, 2026-11-03].
- Changes made during the year must be recorded in the note itself for the retro and year review to read [observed: operator answer, 2026-11-03].
- Most years the operator won't fill all 64 actions at the first sitting [assumed].
- #38 picks quarterly focus mainly from the main goals' pillars, so secondary goals need less structure [assumed; to be confirmed when #38 is defined].

### Impact and why now

- **If nothing changes:** the agent keeps growing the vault evenly, which is the anchor's own non-goal [observed: README Non-goals]. #37 to #42 can't start, because each needs year goals as input [observed: issue list, 2026-11-03]. Each of them would otherwise invent its own idea of "the goals" [assumed].
- **Why now:** it's November, so goals for 2027 need to be set before the year starts [observed: today is 2026-11-03]. #36 is the entry point of the goal-pursuit work, with nothing upstream of it [observed: #36, Depends on]. And closing #28 just removed the only other place goals were meant to live [observed: log.md].

### Success outcomes

| Outcome | Signal | Target | Checked when | For need |
|---|---|---|---|---|
| OUT-01 | Signed-off year-goals notes for 2027 in `01-vision/` that pass the validator and came from one goal-setting session plus sign-off, with no hand edits to fix validation errors | exactly 1 (from 0) | when the operator first sets 2027's goals, no later than 2027-01-31 | NEED-01, NEED-02 |
| OUT-02 | Changes to the year-goals format or the parser's output that #37's and #38's Define and Design phases need in order to read the goals | 0 | at #38's Design milestone | NEED-03 |
| OUT-03 | Files under `20-areas/` that the goal-setting session changed, plus year-goals note files tracked by git | 0 and 0 | at OUT-01's check, from the session's writes and `git ls-files 01-vision/ 00-inbox/` | NEED-01, NEED-04 |

### Appetite and no-gos

- **Appetite:** one week of focused work. The operator confirmed it at the Define gate, 2026-11-03.
- **No-gos:** see [Non-goals](index.md#non-goals).
