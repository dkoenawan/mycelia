<!-- tier: full -->
# Diagrams: Notion inbox: capture from phone into the vault inbox

> Part of [index](index.md) · Define

## Impact map

```mermaid
mindmap
  root((Phone capture into the vault))
    OUT-01 captures reach a final state by the first run after capture
      Operator on the phone
        Captures into the source inbox instead of waiting for the machine
          REQ-010
          REQ-011
          REQ-012
          REQ-014
          REQ-035
      Operator as estate owner
        Schedules the pull and trusts it to recover
          REQ-024
          REQ-028
          REQ-029
          REQ-034
          REQ-043
          REQ-044
    OUT-02 no captures re-typed at the machine
      Operator on the phone
        Stops copying captures across by hand
          REQ-011
          REQ-014
    OUT-03 source status matches the vault outcome
      Operator on the phone
        Checks outcomes on the phone instead of in the vault
          REQ-015
          REQ-016
          REQ-017
          REQ-020
          REQ-031
    OUT-04 one-command setup that is safe to re-run
      Operator and other installers
        Run setup once instead of building a schema by hand
          REQ-001
          REQ-002
          REQ-003
          REQ-006
          REQ-007
          REQ-009
          REQ-036
          REQ-042
    OUT-05 key, vault and workspace protected
      Operator as estate owner
        Lets the pull run unattended on untrusted content
          REQ-004
          REQ-005
          REQ-008
          REQ-014
          REQ-022
          REQ-024
          REQ-025
          REQ-026
    OUT-06 opt-in and publishable
      Other installers
        Install without Notion and see no change
          REQ-027
          REQ-037
          REQ-038
          REQ-039
          REQ-040
          REQ-041
    OUT-07 no duplicates and exactly one ask per stuck capture
      Operator at the inbox
        Acts on one ask instead of hunting stuck rows
          REQ-003
          REQ-009
          REQ-013
          REQ-016
          REQ-018
          REQ-021
          REQ-030
          REQ-031
```

## Context diagram

```mermaid
flowchart LR
  subgraph SCOPE["Work in scope: phone-capture connector"]
    S["Setup command"]
    P["Pull run"]
  end
  OP["Operator on the phone"] -->|"add a row, read its status"| NA["Notion mobile app"]
  NA -->|"sync rows"| API["Notion API"]
  OM["Operator or installer at the machine"] -->|"run setup with key and parent page"| S
  S -->|"create source inbox and instructions row"| API
  S -->|"write key and inbox ID"| CFG["Connector config, local and gitignored"]
  SCH["Operator's scheduler"] -->|"start on the chosen cron"| P
  P -->|"read rows, write status and reason"| API
  P -->|"read key and inbox ID"| CFG
  P -->|"write capture items"| CAP["00-inbox/capture/"]
  P -->|"ingest its own items"| ING["ADR-0006 ingester"]
  ING -->|"run agent step"| AG["Agent provider"]
  ING -->|"resource notes, archive, asks"| V["Vault"]
  P -->|"summary, asks"| V
  REG["control/estate registry"] -.->|"documents the job"| P
```

## Traceability

There are many requirements and many-to-many Serves links, so this uses `flowchart LR`, coloured by priority, split per outcome. Requirements that serve a need alone, or a need as well as an outcome, are drawn in the last diagram.

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  classDef could fill:#F1F5F9,stroke:#475569
  O01["OUT-01"]
  R010["REQ-010"]:::must --> O01
  R011["REQ-011"]:::must --> O01
  R012["REQ-012"]:::should --> O01
  R014["REQ-014"]:::must --> O01
  R024["REQ-024"]:::should --> O01
  R028["REQ-028"]:::must --> O01
  R029["REQ-029"]:::must --> O01
  R034["REQ-034"]:::should --> O01
  R035["REQ-035"]:::must --> O01
  R043["REQ-043"]:::should --> O01
  R044["REQ-044"]:::should --> O01
```

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O02["OUT-02"]
  O03["OUT-03"]
  R011["REQ-011"]:::must --> O02
  R014["REQ-014"]:::must --> O02
  R015["REQ-015"]:::must --> O03
  R016["REQ-016"]:::must --> O03
  R017["REQ-017"]:::must --> O03
  R020["REQ-020"]:::should --> O03
  R031["REQ-031"]:::must --> O03
```

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O04["OUT-04"]
  R001["REQ-001"]:::must --> O04
  R002["REQ-002"]:::must --> O04
  R003["REQ-003"]:::must --> O04
  R006["REQ-006"]:::must --> O04
  R007["REQ-007"]:::must --> O04
  R009["REQ-009"]:::should --> O04
  R036["REQ-036"]:::should --> O04
  R042["REQ-042"]:::should --> O04
```

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O05["OUT-05"]
  O06["OUT-06"]
  R004["REQ-004"]:::must --> O05
  R005["REQ-005"]:::must --> O05
  R008["REQ-008"]:::should --> O05
  R014["REQ-014"]:::must --> O05
  R022["REQ-022"]:::must --> O05
  R024["REQ-024"]:::should --> O05
  R025["REQ-025"]:::must --> O05
  R026["REQ-026"]:::must --> O05
  R027["REQ-027"]:::must --> O06
  R037["REQ-037"]:::must --> O06
  R038["REQ-038"]:::must --> O06
  R039["REQ-039"]:::should --> O06
  R040["REQ-040"]:::must --> O06
  R041["REQ-041"]:::must --> O06
```

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  O07["OUT-07"]
  R003["REQ-003"]:::must --> O07
  R009["REQ-009"]:::should --> O07
  R013["REQ-013"]:::must --> O07
  R016["REQ-016"]:::must --> O07
  R018["REQ-018"]:::must --> O07
  R021["REQ-021"]:::must --> O07
  R030["REQ-030"]:::must --> O07
  R031["REQ-031"]:::must --> O07
```

```mermaid
flowchart LR
  classDef must fill:#DCFCE7,stroke:#166534
  classDef should fill:#FEF3C7,stroke:#92400E
  classDef could fill:#F1F5F9,stroke:#475569
  N01["NEED-01"]
  N02["NEED-02"]
  N03["NEED-03"]
  N06["NEED-06"]
  R023["REQ-023"]:::could --> N01
  R012["REQ-012"]:::should --> N02
  R032["REQ-032"]:::must --> N02
  R006["REQ-006"]:::must --> N03
  R017["REQ-017"]:::must --> N06
  R019["REQ-019"]:::should --> N06
  R028["REQ-028"]:::must --> N06
  R029["REQ-029"]:::must --> N06
  R032 --> N06
  R033["REQ-033"]:::must --> N06
```

## As-is and to-be

The same step IDs in both. The manual transfer at the machine is removed, capture moves to the phone, and the status write-back is new.

```mermaid
flowchart TD
  classDef changed fill:#FEF3C7,stroke:#92400E
  classDef new fill:#DCFCE7,stroke:#166534
  classDef removed fill:#FEE2E2,stroke:#991B1B
  subgraph ASIS["As-is"]
    A1["S1 operator finds something worth keeping, away from the machine"] --> A2["S2 operator keeps it somewhere else or tries to remember it"]
    A2 --> A3["S3 operator opens an editor on the vault machine"]:::removed
    A3 --> A4["S4 operator writes a file into the capture folder"]
    A4 --> A5["S5 daily ingester run makes a linked resource note"]
  end
  subgraph TOBE["To-be"]
    B1["S1 operator finds something worth keeping, away from the machine"] --> B2["S2 operator adds a row to the source inbox on the phone"]:::changed
    B2 --> B4["S4 scheduled pull run writes the row into the capture folder"]:::changed
    B4 --> B5["S5 same pull run ingests it into a linked resource note"]:::changed
    B5 --> B6["S6 pull run sets the row to Ingested, or Failed with a reason"]:::new
  end
```
