// Connector config (DES-004, D5): control/notion.local.yaml, mode 0600. The
// only file that ever holds the API key. Gitignored by control/*.local.yaml,
// and outside the ingester agent's read scope (ADR-0006).
import { execFile } from "node:child_process";
import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";
import { READ_EXCLUDED } from "../../../../../src/ingest/targets.ts";
import { ConfigUnsafe, type ConfigStore, type ConnectorConfig } from "../../application/ports.ts";

export const CONFIG_REL = "control/notion.local.yaml";
const execFileP = promisify(execFile);

/** Malformed config: the operator has to fix or remove it. */
export class ConfigInvalid extends Error {
  override name = "ConfigInvalid";
}

async function insideWorkTree(root: string): Promise<boolean> {
  try {
    const { stdout } = await execFileP("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** True if git would ignore `rel` (or there's no work tree, so nothing can be tracked). */
export async function isIgnored(root: string, rel: string): Promise<boolean> {
  if (!(await insideWorkTree(root))) return true;
  try {
    await execFileP("git", ["check-ignore", "-q", "--no-index", rel], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

function str(v: unknown, key: string, nullable = false): string | null {
  if (nullable && (v === null || v === undefined)) return null;
  if (typeof v !== "string" || v === "") throw new ConfigInvalid(`${CONFIG_REL}: "${key}" is missing or not a string`);
  return v;
}

export function parseConfig(text: string): ConnectorConfig {
  let v: unknown;
  try {
    v = parse(text);
  } catch (e) {
    throw new ConfigInvalid(`${CONFIG_REL} doesn't parse as YAML: ${e instanceof Error ? e.message.split("\n")[0] ?? "" : ""}`);
  }
  if (!v || typeof v !== "object") throw new ConfigInvalid(`${CONFIG_REL} is not a YAML mapping`);
  const o = v as Record<string, unknown>;
  if (o["version"] !== 1) throw new ConfigInvalid(`${CONFIG_REL}: unsupported version ${JSON.stringify(o["version"])}`);
  const form = o["status_property"];
  if (form !== "status" && form !== "select") throw new ConfigInvalid(`${CONFIG_REL}: "status_property" must be status or select`);
  return {
    version: 1,
    api_key: str(o["api_key"], "api_key") ?? "",
    database_id: str(o["database_id"], "database_id") ?? "",
    data_source_id: str(o["data_source_id"], "data_source_id") ?? "",
    instructions_page_id: str(o["instructions_page_id"], "instructions_page_id", true),
    status_property: form,
  };
}

export class YamlConfigStore implements ConfigStore {
  readonly path: string;
  private readonly root: string;

  constructor(root: string, rel: string = CONFIG_REL) {
    this.root = root;
    this.path = rel;
  }

  private get abs(): string {
    return path.join(this.root, this.path);
  }

  async guard(): Promise<void> {
    const top = this.path.split("/")[0] ?? "";
    if (!READ_EXCLUDED.includes(top)) {
      throw new ConfigUnsafe(`${this.path} is inside the ingester agent's read scope; the connector config must live under control/. Nothing was written.`);
    }
    if (!(await isIgnored(this.root, this.path))) {
      throw new ConfigUnsafe(`${this.path} isn't gitignored, so the API key could be committed. Restore the framework's .gitignore (control/*.local.yaml). Nothing was written.`);
    }
  }

  async read(): Promise<ConnectorConfig | null> {
    let text: string;
    try {
      text = await readFile(this.abs, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
    return parseConfig(text);
  }

  /** Temp file (itself matching control/*.local.yaml), then rename; mode 0600 throughout. */
  async write(config: ConnectorConfig): Promise<void> {
    await this.guard();
    await mkdir(path.dirname(this.abs), { recursive: true });
    const tmp = path.join(path.dirname(this.abs), `notion.tmp-${String(process.pid)}.local.yaml`);
    const header = "# Notion connector config (written by task notion:setup). Holds the API key: never commit or share it.\n";
    try {
      const fh = await open(tmp, "wx", 0o600);
      try {
        await fh.writeFile(header + stringify(config));
        await fh.sync();
      } finally {
        await fh.close();
      }
      await rename(tmp, this.abs);
      await chmod(this.abs, 0o600);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }
}
