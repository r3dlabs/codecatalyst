import { describe, expect, it } from "vitest";
import { requirements, sources } from "./seed";
import { DISCLAIMER, diffSnapshots, evaluate, isReady, rank, sanitizePatch, snapshot, toItems } from "./rules";
import type { ContextPatch } from "./types";

const base: ContextPatch = {
  work_type: "new_erection",
  primary_use: "office",
  gfa_m2: 4800,
  storeys: 5,
  habitable_height_m: 22,
  gls_site: null,
  design_stage: "concept",
};
const ids = (ctx: ContextPatch) => evaluate(ctx, requirements).map((e) => e.requirement.id);

describe("thresholds", () => {
  it("GFA 4,999 does not trigger, 5,000 does", () => {
    expect(ids({ ...base, gfa_m2: 4999 })).not.toContain("cx-gateway-5000");
    expect(ids({ ...base, gfa_m2: 4999 })).not.toContain("es-5000");
    expect(ids({ ...base, gfa_m2: 5000 })).toContain("cx-gateway-5000");
    expect(ids({ ...base, gfa_m2: 5000 })).toContain("es-5000");
  });
  it("height 24 does not trigger, 24.1 does", () => {
    expect(ids({ ...base, habitable_height_m: 24 })).not.toContain("fire-24m");
    expect(ids({ ...base, habitable_height_m: 24.1 })).toContain("fire-24m");
  });
  it("minor A&A does not trigger the GFA rules", () => {
    expect(ids({ ...base, work_type: "minor_aa", gfa_m2: 9000 })).not.toContain("cx-gateway-5000");
  });
});

describe("unknown is not no", () => {
  it("unknown GLS shows the Green Mark item as conditional", () => {
    const e = evaluate(base, requirements).find((x) => x.requirement.id === "gls-greenmark")!;
    expect(e.label).toBe("may_apply_need_input");
    expect(e.missing).toEqual(["gls_site"]);
  });
  it("GLS no removes it, yes makes it apply", () => {
    expect(ids({ ...base, gls_site: "no" })).not.toContain("gls-greenmark");
    const e = evaluate({ ...base, gls_site: "yes" }, requirements).find((x) => x.requirement.id === "gls-greenmark")!;
    expect(e.label).toBe("applies_on_inputs");
  });
  it("unknown GFA keeps GFA rules as conditional, never dropped", () => {
    const e = evaluate({ ...base, gfa_m2: null }, requirements).find((x) => x.requirement.id === "cx-gateway-5000")!;
    expect(e.label).toBe("may_apply_need_input");
  });
  it("a known false input wins over an unknown one", () => {
    expect(ids({ ...base, work_type: "minor_aa", gfa_m2: null })).not.toContain("cx-gateway-5000");
  });
  it("gate needs the five fields answered or marked unknown", () => {
    expect(isReady({})).toBe(false);
    expect(isReady({ ...base, gfa_m2: undefined })).toBe(false);
    expect(isReady({ ...base, gfa_m2: null, habitable_height_m: null })).toBe(true);
  });
});

describe("demo scenario diff", () => {
  const snap = (c: ContextPatch) => snapshot(evaluate(c, requirements));
  it("adding two floors surfaces gateway, sustainability and fire", () => {
    const d = diffSnapshots(snap(base), snap({ ...base, storeys: 7, gfa_m2: 6400, habitable_height_m: 30 }), 1);
    expect(d.added.sort()).toEqual(["cx-gateway-5000", "es-5000", "fire-24m"]);
    expect(d.removed).toEqual([]);
  });
  it("GLS yes changes the Green Mark label", () => {
    const d = diffSnapshots(snap(base), snap({ ...base, gls_site: "yes" }), 1);
    expect(d.changed).toEqual(["gls-greenmark"]);
  });
  it("reports items that stop applying", () => {
    const big = { ...base, gfa_m2: 6400 };
    const d = diffSnapshots(snap(big), snap({ ...big, gfa_m2: 4000 }), 2);
    expect(d.removed.sort()).toEqual(["cx-gateway-5000", "es-5000"]);
  });
  it("no diff without a previous snapshot", () => {
    expect(diffSnapshots(null, snap(base), 0).added).toEqual([]);
  });
});

describe("ranking and output rules", () => {
  it("conditional items come first, then by redesign impact", () => {
    const r = rank(evaluate(base, requirements));
    expect(r[0].requirement.id).toBe("gls-greenmark");
    const rest = r.slice(1).map((e) => e.requirement.redesign_impact);
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
  });
  const items = toItems(evaluate({ ...base, gls_site: "yes", gfa_m2: 6400, habitable_height_m: 30 }, requirements), base, sources);
  it("every item carries a source link and checked date", () => {
    for (const i of items) {
      expect(i.source.url).toMatch(/^https:\/\//);
      expect(i.source.checked_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("unchecked records never show a figure", () => {
    const ctx = { ...base, gfa_m2: 6400, habitable_height_m: 30 };
    for (const i of toItems(evaluate(ctx, requirements), ctx, sources).filter((x) => !x.verified)) {
      expect(i.why).not.toMatch(/\d/);
      expect(i.source.exact_quote).toBeNull();
    }
  });
  it("why text states the checked threshold", () => {
    const ctx = { ...base, gfa_m2: 6400 };
    const i = toItems(evaluate(ctx, requirements), ctx, sources).find((x) => x.id === "cx-gateway-5000")!;
    expect(i.why).toContain("6,400 m² is at or above 5,000 m²");
  });
  it("no verdict language in any seed copy", () => {
    const verdict = /\b(complian\w*|complies|comply|pass(ed|es)?|fail(s|ed|ure)?|approved?)\b/i;
    const text = JSON.stringify([requirements, sources.map((s) => ({ ...s, checked_by: "" }))]);
    expect(text.match(verdict)?.[0]).toBeUndefined();
    expect(DISCLAIMER).toContain("Not a compliance determination");
  });
});

describe("input validation", () => {
  it("rejects bad values and keeps null as unknown", () => {
    const { patch, errors } = sanitizePatch({ gfa_m2: -5, work_type: "demolition", gls_site: null, storeys: 7, nope: 1 });
    expect(patch).toEqual({ gls_site: null, storeys: 7 });
    expect(errors).toHaveLength(3);
  });
});

import { extractContext } from "./extract";
describe("free-text extraction", () => {
  it("reads the demo description", () => {
    expect(
      extractContext("New 5-storey office, about 4,800 m² GFA, 22 m habitable height, concept stage"),
    ).toEqual({
      work_type: "new_erection",
      primary_use: "office",
      gfa_m2: 4800,
      storeys: 5,
      habitable_height_m: 22,
      design_stage: "concept",
    });
  });
  it("leaves unmentioned fields unset", () => {
    expect(extractContext("office")).toEqual({ primary_use: "office" });
  });
});

import { PROJECTS } from "./projects";
import { affectedBy, thresholdWatch, validateTrigger } from "./rules";

describe("landed house in Kembangan", () => {
  const ctx = PROJECTS.find((p) => p.id === "tan-kembangan")!.sample;
  it("gets the landed planning card and the direct-submission check, not the office rules", () => {
    const got = ids(ctx);
    expect(got).toContain("planning-landed");
    expect(got).toContain("direct-submission");
    expect(got).not.toContain("planning-dc");
    expect(got).not.toContain("cx-gateway-5000");
    expect(got).not.toContain("es-5000");
    expect(got).not.toContain("fire-24m");
    expect(got).not.toContain("gls-greenmark");
  });
  it("the shophouse stress test crosses the GFA thresholds", () => {
    const got = ids({ ...ctx, primary_use: "mixed", gfa_m2: 5200, storeys: 5, habitable_height_m: 18 });
    expect(got).toContain("cx-gateway-5000");
    expect(got).toContain("planning-dc");
    expect(got).not.toContain("planning-landed");
  });
  it("threshold watch reports where the design sits", () => {
    const w = thresholdWatch(ctx, requirements).filter((r) => r.field === "gfa_m2");
    expect(w.length).toBeGreaterThan(0);
    expect(w.every((r) => r.current === 420 && r.crossed === false)).toBe(true);
  });
  it("a change to height touches the height-based control only", () => {
    expect(affectedBy(["habitable_height_m"], requirements).map((r) => r.id)).toEqual(["fire-24m"]);
  });
});

describe("normalised trigger validation", () => {
  it("accepts well-formed rules", () => {
    expect(validateTrigger({ all: [{ field: "gfa_m2", op: ">=", value: 5000 }, { field: "work_type", op: "in", value: ["new_erection"] }] })).toBe(true);
  });
  it("rejects unknown fields, ops and values", () => {
    expect(validateTrigger({ field: "colour", op: "==", value: "red" })).toBe(false);
    expect(validateTrigger({ field: "gfa_m2", op: "~", value: 5 })).toBe(false);
    expect(validateTrigger({ field: "work_type", op: "in", value: ["demolition"] })).toBe(false);
    expect(validateTrigger({ field: "gfa_m2", op: ">=", value: "5000" })).toBe(false);
    expect(validateTrigger({ all: [] })).toBe(false);
  });
});
