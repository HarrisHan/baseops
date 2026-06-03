import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredAssets = ["main.js", "manifest.json", "styles.css"];
const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

const failures = [];

if (packageJson.version !== manifest.version) {
  failures.push(`package.json version ${packageJson.version} does not match manifest.json version ${manifest.version}.`);
}

if (!versions[manifest.version]) {
  failures.push(`versions.json does not include ${manifest.version}.`);
}

for (const asset of requiredAssets) {
  if (!existsSync(asset)) {
    failures.push(`Missing release asset: ${asset}.`);
  }
}

if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version)) {
  failures.push(`Manifest version must be x.y.z, got ${manifest.version}.`);
}

if (!/^[a-z-]+$/.test(manifest.id) || manifest.id.includes("obsidian") || manifest.id.endsWith("plugin")) {
  failures.push(`Manifest id ${manifest.id} does not meet Obsidian naming requirements.`);
}

if (!manifest.author || typeof manifest.author !== "string") {
  failures.push("Manifest author is required.");
}

const bannedPatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\brequestUrl\b/,
  /\bchild_process\b/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\bvault\.delete\b/,
  /\bvault\.trash\b/,
  /\bvault\.rename\b/,
  /\badapter\.remove\b/,
  /\bunlink\b/
];

for (const file of listFiles(["main.ts", "src", "styles.css"])) {
  const content = readFileSync(file, "utf8");
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      failures.push(`Banned runtime pattern ${pattern} found in ${file}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`BaseOps ${manifest.version} release check passed.`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listFiles(paths) {
  const files = [];
  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }

    const stat = statSync(path);
    if (stat.isFile()) {
      files.push(path);
      continue;
    }

    for (const child of readdirSync(path)) {
      files.push(...listFiles([join(path, child)]));
    }
  }
  return files;
}
