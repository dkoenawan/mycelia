// In-memory fakes of the application ports (D8 test layout).
import { ConfigUnsafe, type ConfigStore, type ConnectorConfig, type KeyPrompt } from "../../src/application/ports.ts";

export class MemoryConfig implements ConfigStore {
  readonly path = "control/notion.local.yaml";
  value: ConnectorConfig | null = null;
  safe = true;
  writes = 0;

  guard(): Promise<void> {
    return this.safe ? Promise.resolve() : Promise.reject(new ConfigUnsafe(`${this.path} isn't gitignored. Nothing was written.`));
  }

  read(): Promise<ConnectorConfig | null> {
    return Promise.resolve(this.value ? { ...this.value } : null);
  }

  async write(config: ConnectorConfig): Promise<void> {
    await this.guard();
    this.writes++;
    this.value = { ...config };
  }
}

export class StaticPrompt implements KeyPrompt {
  calls = 0;
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  read(): Promise<string> {
    this.calls++;
    return Promise.resolve(this.key);
  }
}

export function logSink(): { log: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (m) => { lines.push(m); }, lines };
}
