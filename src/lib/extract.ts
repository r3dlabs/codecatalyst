import type { ContextPatch } from "./types";

const num = (s: string) => Number(s.replace(/,/g, ""));

/**
 * Deterministic extraction of project fields from a free-text description.
 * The user always confirms the result before guidance appears. Anything not found stays unset.
 */
export function extractContext(text: string): ContextPatch {
  const t = text.toLowerCase();
  const out: ContextPatch = {};

  if (/\bminor\b/.test(t)) out.work_type = "minor_aa";
  else if (/\bmajor\b|\ba\s*&\s*a\b|\badditions?\b|\balterations?\b|\bretrofit/.test(t)) out.work_type = "major_aa";
  else if (/\bnew\b|\berect|\bgreenfield\b/.test(t)) out.work_type = "new_erection";

  if (/\blanded\b|\bbungalow\b|\bsemi-?detached\b|\bterrace\b/.test(t)) out.primary_use = "landed";
  else if (/\bmixed\b/.test(t)) out.primary_use = "mixed";
  else if (/\boffice/.test(t)) out.primary_use = "office";
  else if (/\bretail\b|\bmall\b|\bshop/.test(t)) out.primary_use = "retail";
  else if (/\bhotel/.test(t)) out.primary_use = "hotel";
  else if (/\bhospital|\bhealthcare\b|\bclinic/.test(t)) out.primary_use = "healthcare";
  else if (/\bschool|\beducation|\buniversity\b|\bcampus\b/.test(t)) out.primary_use = "education";
  else if (/\bindustrial\b|\bfactory\b|\bwarehouse\b/.test(t)) out.primary_use = "industrial";
  else if (/\bresidential\b|\bflats?\b|\bcondo|\bapartment/.test(t)) out.primary_use = "residential";

  const gfa =
    t.match(/([\d][\d,]*(?:\.\d+)?)\s*(?:m²|m2|sqm|sq\.?\s*m)/) ?? t.match(/gfa[^\d]{0,15}([\d][\d,]*(?:\.\d+)?)/);
  if (gfa) out.gfa_m2 = num(gfa[1]);

  const storeys = t.match(/(\d+)[\s-]*(?:storey|story|floor|level)s?\b/);
  if (storeys) out.storeys = Number(storeys[1]);

  const height =
    t.match(/(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b(?!\s*(?:²|2|sq))[^.,;\d]{0,20}?(?:habitable|height|high|tall)/) ??
    t.match(/height[^\d]{0,15}(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)\b(?!\s*(?:²|2|sq))/);
  if (height) out.habitable_height_m = Number(height[1]);

  if (/construction gateway/.test(t)) out.design_stage = "construction_gateway";
  else if (/design gateway|\bschematic\b|\bpreparing design/.test(t)) out.design_stage = "design_gateway";
  else if (/\bconcept/.test(t)) out.design_stage = "concept";

  if (/\bgls\b|government land sales?/.test(t)) {
    out.gls_site = /\b(not|non|no)\b[^.]{0,12}(gls|government land)|\bprivate (site|land)\b/.test(t) ? "no" : "yes";
  } else if (/\bprivate (site|land)\b/.test(t)) out.gls_site = "no";

  return out;
}
