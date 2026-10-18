// ESLint flat config for the TypeScript runners (DES-022, ADR-0007).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Node modules that do I/O; banned in a connector's domain/ (D8).
const IO_MODULES = ["fs", "fs/promises", "child_process", "net", "http", "https", "dns", "os", "process", "readline", "worker_threads"]
  .flatMap((m) => [m, `node:${m}`]);
// From integration/<name>/src/**, the repo's src/ is three or more levels up.
const REPO_SRC = "^(\\.\\./){3,}src/";

export default tseslint.config(
  { ignores: ["node_modules/", "graphify-out/", "handoff/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        // node:test's test()/describe() return promises the runner itself tracks.
        { allowForKnownSafeCalls: [{ from: "package", name: ["test", "it", "describe", "suite"], package: "node:test" }] },
      ],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    // Tests narrow with assert.* and then read the narrowed value defensively.
    files: ["test/**/*.ts", "integration/*/test/**/*.ts"],
    rules: { "@typescript-eslint/no-unnecessary-condition": "off" },
  },
  // Connector layer rule (D8, #21): dependencies point inward. domain/ is pure;
  // application/ sees only domain/; only adapters/ and cli.ts reach the repo's
  // src/. A connector file needs at least three "../" to leave its own src/.
  {
    files: ["integration/*/src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: IO_MODULES.map((name) => ({ name, message: "domain/ is pure: do I/O in an adapter behind a port." })),
        patterns: [
          { regex: "(^|/)(application|adapters)/|(^|/)cli\\.ts$", message: "domain/ may not import application/, adapters/ or cli.ts (D8)." },
          { regex: REPO_SRC, message: "Only adapters/ may import from the repo's src/ (D8)." },
        ],
      }],
    },
  },
  {
    files: ["integration/*/src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { regex: "(^|/)adapters/|(^|/)cli\\.ts$", message: "application/ may not import adapters/ or cli.ts; depend on a port in ports.ts (D8)." },
          { regex: REPO_SRC, message: "Only adapters/ may import from the repo's src/ (D8)." },
        ],
      }],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
