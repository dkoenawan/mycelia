<!-- tier: full -->
# Diagrams: Year goal setting: primary goal as a Mandala Chart, plus secondary goals

> Part of [index](index.md) · Define

## Impact map

```mermaid
mindmap
  root((Year goal setting))
    OUT-01 one signed-off 2027 goals note from one session
      Operator
        Sets the year goals in a guided conversation
          REQ-009
          REQ-010
          REQ-011
        Signs off the draft before it counts
          REQ-013
      Goal-setting agent
        Drafts a valid partly filled chart
          REQ-002
          REQ-010
    OUT-02 zero format changes needed by 37 and 38
      Downstream goal-pursuit agents
        Read signed-off goals from one parser
          REQ-006
          REQ-007
          REQ-012
        Trust that a note is well formed
          REQ-002
          REQ-003
          REQ-004
          REQ-005
          REQ-008
      Framework developers
        Build on a documented and tested format
          REQ-001
          REQ-018
    OUT-03 zero area files changed and zero goal notes in git
      Goal-setting agent
        Leaves area notes alone
          REQ-015
      Other operators
        Install the vision folder with nothing personal shipped
          REQ-016
```

## Context diagram

```mermaid
flowchart LR
  subgraph SCOPE["Work in scope: year goal setting"]
    S["Goal-setting session"]
    V["Year-goals format, parser and validator"]
    G["Sign-off"]
    F["01-vision/ folder, README only"]
  end
  OP["Operator"] -->|"answers prompts, signs off the draft"| S
  OP -->|"signs off"| G
  S -->|"asks the model via the agent provider"| CL["claude CLI"]
  S -->|"writes the draft note"| IN["00-inbox/ root"]
  G -->|"moves the signed-off note"| F
  S -.->|"reads area names only"| AR["20-areas/"]
  V -.->|"checks area links exist"| AR
  DS["Downstream agents 37 to 42"] -->|"read current goals"| V
  OT["Other operators"] -->|"install the format, template and folder"| F
  CI["task check:node"] -->|"runs parser and validator tests"| V
```

## Traceability

There are 18 requirements and several many-to-many Serves links, so this uses a `flowchart LR` coloured by priority. NEED-01, NEED-02, NEED-03 and NEED-04 appear where a REQ serves them alongside, or instead of, an outcome. Nothing is struck or deferred.

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534,color:#052E16
  classDef should fill:#FEF3C7,stroke:#92400E,color:#451A03
  O01["OUT-01"]
  O02["OUT-02"]
  O03["OUT-03"]
  N01["NEED-01"]
  N02["NEED-02"]
  N03["NEED-03"]
  N04["NEED-04"]
  R001["REQ-001"]:::must --> O02
  R001 --> N04
  R002["REQ-002"]:::must --> O01
  R002 --> O02
  R003["REQ-003"]:::must --> O02
  R004["REQ-004"]:::must --> N01
  R004 --> O02
  R005["REQ-005"]:::should --> O02
  R006["REQ-006"]:::must --> O02
  R006 --> N03
  R007["REQ-007"]:::must --> N03
  R007 --> O02
  R008["REQ-008"]:::should --> O02
  R008 --> N03
  R009["REQ-009"]:::must --> N01
  R009 --> O01
  R010["REQ-010"]:::must --> O01
  R010 --> N02
  R011["REQ-011"]:::should --> O01
  R012["REQ-012"]:::must --> N02
  R012 --> O02
  R013["REQ-013"]:::must --> O01
  R013 --> N02
  R014["REQ-014"]:::should --> N02
  R015["REQ-015"]:::must --> O03
  R015 --> N01
  R016["REQ-016"]:::must --> O03
  R016 --> N04
  R017["REQ-017"]:::must --> N01
  R017 --> N04
  R018["REQ-018"]:::must --> O02
```

## As-is and to-be

Not required. No existing process changes: today there is no goal-setting process in mycelia to compare against (see [framing.md](framing.md#symptom-and-cause)).
