import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSelectedValue,
  nextPropertyValue,
  parseInputValue,
  planOperation,
  summarizeProperties
} from "../src/operations.ts";

describe("selection values", () => {
  it("accepts configured truthy selection values", () => {
    assert.equal(isSelectedValue(true), true);
    assert.equal(isSelectedValue("true"), true);
    assert.equal(isSelectedValue("yes"), true);
    assert.equal(isSelectedValue("1"), true);
    assert.equal(isSelectedValue(1), true);
  });

  it("rejects non-selected values", () => {
    assert.equal(isSelectedValue(false), false);
    assert.equal(isSelectedValue("no"), false);
    assert.equal(isSelectedValue(0), false);
    assert.equal(isSelectedValue(undefined), false);
  });
});

describe("input parsing", () => {
  it("keeps replace input as one string", () => {
    assert.equal(parseInputValue("todo, done", "replace", "status"), "todo, done");
  });

  it("splits add/remove values and normalizes tags", () => {
    assert.deepEqual(parseInputValue("#alpha, beta", "add", "tags"), ["alpha", "beta"]);
  });

  it("rejects empty values for value operations", () => {
    assert.throws(() => parseInputValue(" ", "remove", "tags"), /Enter a value/);
  });

  it("rejects list input with no usable values", () => {
    assert.throws(() => parseInputValue(" , ", "add", "tags"), /at least one value/);
  });
});

describe("operation planning", () => {
  it("plans replace changes and skips equal values", () => {
    const plan = planOperation(
      [
        { path: "a.md", propertyExists: true, value: "todo" },
        { path: "b.md", propertyExists: true, value: "done" }
      ],
      "status",
      "replace",
      "done"
    );

    assert.equal(plan.changedFiles.length, 1);
    assert.equal(plan.skippedFiles.length, 1);
    assert.equal(plan.changedFiles[0].path, "a.md");
    assert.equal(plan.changedFiles[0].newValue, "done");
  });

  it("adds unique list values without overwriting existing values", () => {
    assert.deepEqual(nextPropertyValue(["alpha"], true, "add", ["alpha", "beta"]), ["alpha", "beta"]);
  });

  it("removes values from list-like properties", () => {
    assert.deepEqual(nextPropertyValue(["alpha", "beta"], true, "remove", ["alpha"]), ["beta"]);
  });

  it("clears properties by planning an undefined value", () => {
    const plan = planOperation(
      [{ path: "a.md", propertyExists: true, value: "done" }],
      "status",
      "clear",
      ""
    );

    assert.equal(plan.changedFiles.length, 1);
    assert.equal(plan.changedFiles[0].newValue, undefined);
  });

  it("requires a property name", () => {
    assert.throws(() => planOperation([], " ", "clear", ""), /property name/);
  });
});

describe("property summaries", () => {
  it("summarizes property usage, selected coverage, missing count, and values", () => {
    const stats = summarizeProperties(
      [
        {
          path: "a.md",
          selected: true,
          frontmatter: { status: "todo", tags: ["project"], position: { start: 0 } }
        },
        {
          path: "b.md",
          selected: false,
          frontmatter: { status: "done", owner: "Alex" }
        },
        {
          path: "c.md",
          selected: true,
          frontmatter: { status: "todo", owner: "Alex" }
        }
      ],
      3
    );

    const status = stats.find((stat) => stat.name === "status");
    assert.equal(status?.fileCount, 3);
    assert.equal(status?.selectedCount, 2);
    assert.equal(status?.missingCount, 0);
    assert.deepEqual(status?.sampleValues[0], { value: "todo", count: 2 });

    const owner = stats.find((stat) => stat.name === "owner");
    assert.equal(owner?.fileCount, 2);
    assert.equal(owner?.missingCount, 1);

    assert.equal(stats.some((stat) => stat.name === "position"), false);
  });
});
