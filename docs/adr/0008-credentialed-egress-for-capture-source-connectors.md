---
id: "008"
title: Credentialed egress for capture-source connectors, with integration/ as their home
date: 2026-10-17
status: accepted
deciders: [operator]
---

## Context

ADR-0006 contains the inbox ingester by giving its agent no egress at all. The agent
has no network, shell, write or MCP tools. The only outbound requests are
deterministic, unauthenticated GETs for URLs that appear in a capture item.

Phone capture through Notion breaks two assumptions that held until now:

- **A stored credential.** The connector needs a Notion integration secret that
  persists between runs. It's the framework's first long-lived credential.
- **Authenticated, writing egress.** The connector creates a database during setup,
  queries it on every pull, and writes each processed row's status back. These are the
  framework's first non-GET requests and its first requests that carry a secret.

The content it pulls is still untrusted. Anyone who can add a row to the operator's
Notion database can put text in front of the ingester. That text sits one step away
from a credential that can write to the operator's workspace.

There was also no place for third-party connectors in the tree. `src/` holds the
framework's own workflow runners (ADR-0007), and a connector is a different thing: it
is optional, it is bound to one vendor, and it ships its own template and tests.

## Decision Drivers

- ADR-0006's containment must stay intact. The ingester's agent gets no new
  capability, and a prompt injection still can't send anything off the machine.
- The secret has to stay unreadable by any agent and out of git (ADR-0002), and it
  must never appear in logs, errors, the ledger or vault notes.
- An injected instruction in a pulled row must not be able to widen what the connector
  does in the workspace. "Set every row to Ingested" or "delete this page" must be
  impossible, not just discouraged.
- Future connectors (another capture source, say) should inherit the rule rather than
  re-argue it.
- No new runtime dependencies without need (ADR-0007).

## Considered Options

| Option | Pros | Cons | Why rejected |
|---|---|---|---|
| **Credentialed egress only in deterministic connector code, to one hard-coded API host (chosen)** | The agent's containment is unchanged. Every request is code we wrote and test. The host, headers and write surface are fixed in source | About 300 lines of client and converter to maintain | — chosen |
| Give an agent a Notion tool (MCP server or SDK tool) and let it pull and update rows | Least code | The agent would hold a writing credential while reading untrusted text, which is exactly the exfiltration and misuse channel ADR-0006 closes | Breaks ADR-0006 |
| Vendor SDK (`@notionhq/client`) plus a Markdown converter library | Less code | Two runtime dependency trees. Less direct control over the host, the redirects and where the key travels | ADR-0007's minimal-dependency rule; weaker control of the key |
| **Connectors under `integration/<name>/` with `src/`, `template/` and `test/` (chosen)** | Third-party code is visibly separate from the core runners. Each connector is self-contained and optional | A second code root, so the gates widen. Imports reach into `src/` by deep relative paths | — chosen |
| Connectors under `src/<name>/` | Fits the existing gate unchanged | Optional vendor code is mixed in with the framework's own runners | Blurs what is core |
| A generic `CaptureSource` interface with Notion as its first implementation | Ready for a second source | Speculative while only Notion exists | YAGNI. A second source can extract one |

## Decision Outcome

Chosen: **capture-source connectors keep credentialed egress in deterministic connector
code, and they live under `integration/<name>/`.** The Notion connector
(`integration/notion/`) is the first one. Every future connector follows the same rules.

**Egress**

- Requests go only to one API host, hard-coded in the connector's client
  (`https://api.notion.com` for Notion). Tests can inject a different base URL through
  the constructor. The CLI never does, and no config field or environment variable can.
- Only connector code makes these requests. No agent gets the credential, a tool that
  holds it, or a tool that reaches the capture source.
- Redirects are refused (`redirect: "error"`), so the key can't follow a redirect to
  another host. The client sets no proxy, and Node's built-in `fetch` ignores
  environment proxies by default.
- The API version is pinned in source (`Notion-Version: 2025-09-03`).
- Rate limits are respected. On a 429 the client waits for `Retry-After` (capped at
  60 seconds) and retries, at most 5 times. Then it treats the source as unavailable
  and stops the run, without recording a failure against any item.

**The credential**

- The key lives only in `control/*.local.*`. For Notion that's
  `control/notion.local.yaml`, written with mode 0600. `control/*.local.yaml` is
  gitignored, and `control/` is outside the ingester agent's read scope (ADR-0006).
- Setup refuses to write the file unless git ignores its path and the path is under
  `control/`.
- The key is read from a hidden prompt or from one line of stdin, never from argv or
  the environment, so it doesn't show up in shell history or a process listing.
- In a request, the key goes only in the `Authorization` header. Error messages never
  include it or any header.

**Writes to the capture source**

- Setup creates the database and its one instructions row, and nothing else.
- A pull run changes only the Status and Reason of rows it processes. The status update
  sends only those two properties. Reasons are truncated to the API's 2,000-character
  rich-text limit.
- The connector never deletes, archives or moves a row or page. Nothing in the source
  points back into the vault.

**Pulled content**

- Pulled content is untrusted. The connector never interprets it. It only converts
  supported block types to Markdown and writes the result as a capture item.
- Ingestion goes through the ADR-0006 ingester's own per-item pipeline, through its
  session seam (`src/ingest/session.ts`). That keeps its six injection layers, check,
  rollback, asks and lock. It's called, not copied.
- The source row's ID is kept only in the capture item's frontmatter, which the
  ingester's URL extraction ignores. The row's own page address is never written, so
  the ingester never fetches it.
- ADR-0006's no-egress containment of the ingester's agent is unchanged.

**Connector home**

- Each connector is `integration/<name>/{src,template,test}`, covered by
  `task check:node` (`tsconfig.json` includes, the `package.json` test globs and the
  ESLint test override).
- Imports go one way only, from `integration/` into `src/`. Nothing under `src/`
  imports a connector.
- ADR-0007's no-`.md` rule extends to `integration/`, so connector code never shows up
  as a vault note.
- Inside the Notion connector, the code follows a layered structure: `domain/` ←
  `application/` (use cases and ports) ← `adapters/` ← `cli.ts`. ESLint enforces it.
  Only adapters import from `src/`. Adopting that structure repo-wide is #22.
- Connectors are opt-in. With no connector config, the release smoke test,
  `task ingest-inbox` and `task doctor` behave as they did before.

### Live API findings

Before the connector relied on them, its assumptions about the Notion API were checked
against a throwaway test workspace. The spike is `integration/notion/test/live/spike.live.ts`.
The findings are also recorded in the header of
`integration/notion/src/adapters/notion/http-client.ts`, under the same labels.

| | Assumption | Finding |
|---|---|---|
| A1 | An internal integration can create a database only under a page shared with it | Confirmed. Creating under a shared page succeeds. Under a page not shared with the integration, the API answers 404 `object_not_found`. Setup therefore checks the parent page first and says to share it (page menu, *Connections*) |
| A2 | Internal integration keys don't expire on their own. They stop working only when regenerated or when the integration is removed | `users/me` with a working key returns 200 (a bot user). The regenerated-key case wasn't run live, so this rests on Notion's documentation. A rejected key surfaces as 401, and the connector reports it as "key rejected" |
| A3 | The API may not be able to create a native `status` property | Not borne out. The API creates a native Status property, and a row created with only a title reads Status `New`. Setup still falls back to a `select` (blank meaning New) if Notion ever refuses, before anything is created, and it records which form it used in the config |
| A4 | The data-source model (`Notion-Version` 2025-09-03) changes how databases are created and queried | Confirmed. The create response carries `data_sources[0].id`. Queries go through `/v1/data_sources/{id}/query`, and updating Status plus a 2,000-character Reason works. The config stores both the database ID and the data-source ID |
| A5 | Limits: about 3 requests per second with 429 and `Retry-After`, pages of 100, 2,000 characters per rich-text segment, `created_time` rounded to the minute | A 2,001-character segment is refused with 400, so the 2,000-character truncation holds. `created_time` is rounded to the minute, which is why rows from the same minute are ordered by ID. A 40-request burst drew no 429, so `Retry-After` handling is covered only by unit tests |

## Consequences

- **Now easier:** a phone capture reaches the vault with no manual step. The next
  connector has a home and a security rule to inherit, so it doesn't need a fresh
  architecture argument.
- **Now harder:** the framework now stores a credential. Keeping it safe depends on the
  `.gitignore` entry for `control/*.local.yaml`, on mode 0600 and on the ingester's read
  scope, and setup, the pull's can-start checks and `task doctor` all verify those. A
  second code root widens the gate configuration.
- **New constraints:**
  - A connector never hands its credential, or a tool holding it, to an agent.
  - A connector talks to exactly one hard-coded host, refuses redirects and puts the
    key only in the `Authorization` header.
  - A connector's writes to its source are limited to what its own setup created and
    the status fields of items it processed.
  - Pulled content always goes through the ADR-0006 ingester, never around it.
  - A scheduled connector job declares `commits: false` with a `note`, under ADR-0006's
    condition: every output is gitignored vault content or local state.

## Revisit Conditions

- A connector needs a second host. For example, file attachments served from a
  vendor's CDN, which #17 could bring. That needs an explicit per-host allow-list
  rather than an exception.
- A capture source offers only OAuth (public integrations) rather than a static key.
  Token refresh would put a second credential, and a refresh flow, into connector code.
- A second capture source is added. Extract a shared interface from the Notion
  connector then, and check this ADR still covers both.
- A key is found anywhere outside `control/*.local.*`, or a request reaches a host
  other than the hard-coded one.

Origin: #21
