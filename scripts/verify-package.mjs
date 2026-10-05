import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "keylens-package-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
}

try {
  const packOutput = run("npm", [
    "pack",
    "--json",
    "--pack-destination",
    temporaryRoot,
  ]);
  const [manifest] = JSON.parse(packOutput);
  if (!manifest) throw new Error("npm pack did not return package metadata");

  const packagedFiles = new Set(manifest.files.map((file) => file.path));
  const requiredFiles = [
    "CONTRIBUTING.md",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SECURITY.md",
    "SUPPORT.md",
    "keylens.config.schema.json",
    "skill/SKILL.md",
    "dist/index.js",
    "dist/index.js.map",
    "dist/index.d.ts",
    "dist/guidance.js",
    "dist/guidance.js.map",
    "dist/guidance.d.ts",
    "dist/cli/index.js",
    "dist/cli/index.js.map",
    "dist/cli/index.d.ts",
    "dist/mcp/server.js",
    "dist/mcp/server.js.map",
    "dist/mcp/server.d.ts",
  ];
  const missingFiles = requiredFiles.filter((file) => !packagedFiles.has(file));
  if (missingFiles.length > 0) {
    throw new Error(`Packed artifact is missing: ${missingFiles.join(", ")}`);
  }
  const forbiddenFiles = [...packagedFiles].filter((file) =>
    /^(src|tests|benchmarks|docs)\//.test(file),
  );
  if (forbiddenFiles.length > 0) {
    throw new Error(
      `Packed artifact includes development files: ${forbiddenFiles.join(", ")}`,
    );
  }
  if (manifest.size > 2 * 1024 * 1024) {
    throw new Error(
      `Packed artifact exceeds 2 MiB compressed: ${manifest.size} bytes`,
    );
  }
  if (manifest.unpackedSize > 10 * 1024 * 1024) {
    throw new Error(
      `Packed artifact exceeds 10 MiB unpacked: ${manifest.unpackedSize} bytes`,
    );
  }

  const tarball = join(temporaryRoot, manifest.filename);
  const consumer = join(temporaryRoot, "consumer");
  const consumerNodeModules = join(consumer, "node_modules");
  const installedPackage = join(consumerNodeModules, "@telerik", "keylens");
  await mkdir(consumer, { recursive: true });
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await mkdir(installedPackage, { recursive: true });
  run(
    "tar",
    ["-xzf", tarball, "-C", installedPackage, "--strip-components=1"],
    { cwd: consumer },
  );

  const rootPackage = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  );
  for (const dependency of Object.keys(rootPackage.dependencies)) {
    const source = join(root, "node_modules", dependency);
    const target = join(consumerNodeModules, dependency);
    await mkdir(dirname(target), { recursive: true });
    await symlink(source, target, "junction");
  }

  await writeFile(
    join(consumer, "consumer.mjs"),
    `
      import { AUDIT_REPORT_SCHEMA_VERSION, audit } from "@telerik/keylens";
      import { getRuleRemediation } from "@telerik/keylens/guidance";
      if (typeof audit !== "function" || !AUDIT_REPORT_SCHEMA_VERSION) {
        throw new Error("Root package exports are unavailable");
      }
      if (!getRuleRemediation("keyboard-trap")) {
        throw new Error("Guidance subpath is unavailable");
      }
      import.meta.resolve("@telerik/keylens/mcp");
    `,
  );
  run(process.execPath, ["consumer.mjs"], { cwd: consumer });

  await writeFile(
    join(consumer, "consumer.ts"),
    `
      import {
        audit,
        type AuditEvent,
        type AuditReport,
        type KeylensConfigInput,
      } from "@telerik/keylens";
      import { getWcagReference } from "@telerik/keylens/guidance";
      const config: KeylensConfigInput = { profile: "fast" };
      const callback = (event: AuditEvent): void => void event.type;
      const operation: Promise<AuditReport> = audit("https://example.com", {
        ...config,
        onEvent: callback,
      });
      void operation;
      void getWcagReference("2.4.3");
    `,
  );
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ["consumer.ts"],
    }),
  );
  run(
    process.execPath,
    [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    { cwd: consumer },
  );

  const binaries = [
    { name: "keylens", target: "./dist/cli/index.js" },
    { name: "keylens-mcp", target: "./dist/mcp/server.js" },
  ];
  for (const binary of binaries) {
    const executable = join(installedPackage, binary.target);
    const executableStats = await stat(executable);
    if ((executableStats.mode & 0o111) === 0) {
      throw new Error(`Packed ${binary.name} binary is not executable`);
    }
    const firstLine = (await readFile(executable, "utf8")).split("\n", 1)[0];
    if (firstLine !== "#!/usr/bin/env node") {
      throw new Error(
        `Packed ${binary.name} binary is missing its Node shebang`,
      );
    }
  }

  const cli = join(installedPackage, binaries[0].target);
  const version = run(cli, ["--version"], { cwd: consumer });
  if (!version) throw new Error("Packed CLI did not print a version");

  const packedManifestPath = join(installedPackage, "package.json");
  const packedManifest = JSON.parse(await readFile(packedManifestPath, "utf8"));
  if (packedManifest.license !== "Apache-2.0") {
    throw new Error("Packed package must declare the Apache-2.0 license");
  }
  for (const file of ["LICENSE", "NOTICE"]) {
    const expected = await readFile(join(root, file), "utf8");
    const actual = await readFile(join(installedPackage, file), "utf8");
    if (actual !== expected) {
      throw new Error(`Packed ${file} does not match the repository copy`);
    }
  }
  for (const binary of binaries) {
    if (packedManifest.bin?.[binary.name] !== binary.target) {
      throw new Error(
        `Packed package has an invalid ${binary.name} bin mapping`,
      );
    }
  }

  // Exercise npm's bin linking without resolving dependencies from a registry.
  await writeFile(
    packedManifestPath,
    JSON.stringify({
      ...packedManifest,
      dependencies: {},
      optionalDependencies: {},
      peerDependencies: {},
      scripts: {},
    }),
  );
  const binConsumer = join(temporaryRoot, "bin-consumer");
  await mkdir(binConsumer, { recursive: true });
  await writeFile(
    join(binConsumer, "package.json"),
    JSON.stringify({ private: true }),
  );
  run(
    "npm",
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      installedPackage,
    ],
    { cwd: binConsumer },
  );
  for (const binary of binaries) {
    const binShim = join(binConsumer, "node_modules/.bin", binary.name);
    const shimStats = await stat(binShim);
    if ((shimStats.mode & 0o111) === 0) {
      throw new Error(`${binary.name} npm shim is not executable`);
    }
    const shimTarget = await realpath(binShim);
    const expectedTarget = await realpath(
      join(binConsumer, "node_modules/@telerik/keylens", binary.target),
    );
    if (shimTarget !== expectedTarget) {
      throw new Error(`${binary.name} npm shim resolves to the wrong target`);
    }
  }

  const cliShim = join(binConsumer, "node_modules/.bin/keylens");
  const shimVersion = run(cliShim, ["--version"], { cwd: binConsumer });
  if (!shimVersion) throw new Error("Packed CLI shim did not print a version");

  if (!(await stat(tarball)).isFile()) {
    throw new Error("npm pack did not create a tarball");
  }

  console.log(
    `Verified ${manifest.filename}: ${manifest.files.length} files, ${manifest.size} packed bytes`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
