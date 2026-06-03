import { builtinModules } from "node:module";
import esbuild from "esbuild";

const prod = process.argv.includes("production");
const test = process.argv.includes("test");

const common = {
  bundle: true,
  format: "cjs",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  target: "es2022",
  treeShaking: true
};

if (test) {
  await esbuild.build({
    ...common,
    entryPoints: ["tests/operations.test.ts"],
    external: [...builtinModules],
    format: "esm",
    outfile: "dist-tests/operations.test.mjs",
    platform: "node"
  });
} else {
  await esbuild.build({
    ...common,
    entryPoints: ["main.ts"],
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
    outfile: "main.js",
    platform: "browser"
  });
}
