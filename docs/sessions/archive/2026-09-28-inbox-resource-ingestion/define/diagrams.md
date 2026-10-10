<!-- tier: full -->
# Diagrams: Resource lifecycle MVP — inbox → resources ingestion

> Part of [index](index.md) · Define

## Impact map

```mermaid
mindmap
  root((Inbox ingestion))
    OUT-01 every capture reaches a final state within 2 runs
      Operator
        Drops material in the capture folder and moves on
          REQ-003
          REQ-004
          REQ-008
          REQ-009
          REQ-028
          REQ-041
      Ingester
        Keeps working through failures and reports them
          REQ-025
          REQ-031
          REQ-032
          REQ-033
    OUT-02 resources linked both ways and placed well
      Operator
        Finds resources from the areas and projects they serve
          REQ-015
          REQ-016
          REQ-017
          REQ-018
          REQ-024
        Answers an ask when nothing fits
          REQ-019
          REQ-020
    OUT-03 decision items never touched
      Operator
        Keeps decisions and captures apart
          REQ-001
          REQ-002
          REQ-035
          REQ-036
    OUT-04 no manual filing
      Operator
        Stops filing and linking captures by hand
          REQ-012
          REQ-014
          REQ-021
          REQ-022
          REQ-027
          REQ-029
    OUT-05 one ask per held item
      Operator
        Sees each ask once, and resolves it by editing the item or deleting the ask
          REQ-005
          REQ-006
    OUT-06 no writes outside the allowed set
      Operator
        Lets the ingester read untrusted material unattended
          REQ-010
          REQ-011
    OUT-07 works from a fresh clone with nothing personal committed
      Framework installers
        Install and schedule the ingester from defaults
          REQ-034
          REQ-035
          REQ-037
          REQ-038
          REQ-039
          REQ-040
```

## Context diagram

```mermaid
flowchart LR
  subgraph SCOPE["Work in scope"]
    ING["Ingester: runner and agent"]
    CAP["00-inbox/capture/"]
    LED["Ledger, local"]
  end
  OP["Operator"] -->|"drops captures; answers asks"| CAP
  CAP -->|"eligible items, oldest first"| ING
  INST["Framework installers"] -->|"install, register, schedule"| ING
  SCHED["Scheduler, cron"] -->|"starts one run a day"| ING
  ING -->|"invokes"| CL["claude CLI"]
  ING -->|"read-only GET of thin items' URLs"| WEB["Public web"]
  ING -->|"creates resource notes"| RES["30-resources/"]
  ING -->|"reads targets; appends back-links"| AP["20-areas/ and 10-projects/"]
  ING -->|"moves ingested originals and resolved asks"| ARC["40-archive/"]
  ING -->|"raises asks; never touches decisions"| INBOX["00-inbox/ decisions and asks"]
  ING -->|"appends run summary"| DAILY["daily/"]
  ING -->|"records outcomes"| LED
  REG["control/estate registry"] -->|"documents the job"| INST
  OP -->|"reads asks and daily note"| INBOX
```

## Traceability

Split into one diagram per outcome, plus one for requirements that serve a need alone. Colour shows priority.

**OUT-01**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O01["OUT-01"]
  R003["REQ-003"]:::must --> O01
  R004["REQ-004"]:::must --> O01
  R007["REQ-007"]:::must --> O01
  R008["REQ-008"]:::must --> O01
  R009["REQ-009"]:::must --> O01
  R025["REQ-025"]:::must --> O01
  R028["REQ-028"]:::must --> O01
  R031["REQ-031"]:::must --> O01
  R032["REQ-032"]:::must --> O01
  R033["REQ-033"]:::should --> O01
  R041["REQ-041"]:::should --> O01
```

**OUT-02**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O02["OUT-02"]
  R015["REQ-015"]:::must --> O02
  R016["REQ-016"]:::must --> O02
  R017["REQ-017"]:::should --> O02
  R018["REQ-018"]:::must --> O02
  R019["REQ-019"]:::should --> O02
  R020["REQ-020"]:::must --> O02
  R024["REQ-024"]:::must --> O02
```

**OUT-03**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  O03["OUT-03"]
  R001["REQ-001"]:::must --> O03
  R002["REQ-002"]:::must --> O03
  R035["REQ-035"]:::must --> O03
  R036["REQ-036"]:::must --> O03
```

**OUT-04**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O04["OUT-04"]
  R012["REQ-012"]:::must --> O04
  R014["REQ-014"]:::must --> O04
  R021["REQ-021"]:::must --> O04
  R022["REQ-022"]:::must --> O04
  R024["REQ-024"]:::must --> O04
  R027["REQ-027"]:::should --> O04
  R029["REQ-029"]:::must --> O04
```

**OUT-05**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  O05["OUT-05"]
  R005["REQ-005"]:::must --> O05
  R006["REQ-006"]:::must --> O05
```

**OUT-06**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  O06["OUT-06"]
  R010["REQ-010"]:::must --> O06
  R011["REQ-011"]:::must --> O06
```

**OUT-07**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  O07["OUT-07"]
  R034["REQ-034"]:::must --> O07
  R035["REQ-035"]:::must --> O07
  R037["REQ-037"]:::must --> O07
  R038["REQ-038"]:::must --> O07
  R039["REQ-039"]:::must --> O07
  R040["REQ-040"]:::must --> O07
```

**Requirements that also or only serve a need**

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  classDef could fill:#F1F5F9,stroke:#475569
  N01["NEED-01"]
  N02["NEED-02"]
  N03["NEED-03"]
  R008["REQ-008"]:::must --> N01
  R013["REQ-013"]:::must --> N02
  R014["REQ-014"]:::must --> N02
  R042["REQ-042"]:::could --> N02
  R006["REQ-006"]:::must --> N03
  R007["REQ-007"]:::must --> N03
  R009["REQ-009"]:::must --> N03
  R020["REQ-020"]:::must --> N03
  R023["REQ-023"]:::should --> N03
  R026["REQ-026"]:::should --> N03
  R030["REQ-030"]:::could --> N03
```

## As-is and to-be

```mermaid
flowchart TD
  classDef changed fill:#FEF3C7,stroke:#92400E
  classDef new fill:#DCFCE7,stroke:#166534
  classDef removed fill:#FEE2E2,stroke:#991B1B
  subgraph ASIS["As-is"]
    A1["S1 operator captures a note into 00-inbox/"] --> A2["S2 operator decides where it belongs"] --> A3["S3 operator writes or moves it into 30-resources/"] --> A4["S4 operator links it to areas and projects by hand"]
    A5["S5 agents raise decisions in 00-inbox/, mixed with captures"]
  end
  subgraph TOBE["To-be"]
    B1["S1 operator drops material into 00-inbox/capture/"]:::changed --> B2["S2 ingester picks placement targets"]:::changed --> B3["S3 ingester writes one resource note and archives the original"]:::changed --> B4["S4 ingester links resource and targets both ways"]:::changed
    B2 --> B6["S6 no fit or fetch fails: one ask in 00-inbox/, item held"]:::new
    B4 --> B7["S7 run summary in the daily note"]:::new
    B5["S5 agents raise decisions in 00-inbox/, apart from captures"]:::changed
  end
```
