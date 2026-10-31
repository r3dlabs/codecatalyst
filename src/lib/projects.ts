import type { ContextPatch } from "./types";

export interface ProjectMeta {
  id: string;
  name: string;
  place: string;
  blurb: string;
  /** Fictional starting model, applied on request. */
  sample: ContextPatch;
}

export const PROJECTS: ProjectMeta[] = [
  {
    id: "demo-office",
    name: "Demo office",
    place: "Singapore",
    blurb: "New-build office on a private site. All figures are fictional.",
    sample: {
      work_type: "new_erection",
      primary_use: "office",
      gfa_m2: 4800,
      storeys: 5,
      habitable_height_m: 22,
      gls_site: null,
      design_stage: "concept",
    },
  },
  {
    id: "tan-kembangan",
    name: "Tan Residence",
    place: "Kembangan, Singapore",
    blurb:
      "Fictional customer: a family rebuilding their landed house on a private plot in Kembangan. The brief is a 2-storey home with a roof terrace. All figures are made up.",
    sample: {
      work_type: "new_erection",
      primary_use: "landed",
      gfa_m2: 420,
      storeys: 2,
      habitable_height_m: 9,
      gls_site: "no",
      design_stage: "concept",
    },
  },
];

export const projectMeta = (id: string) => PROJECTS.find((p) => p.id === id);

/** Scripted design-tool events per project (simulated Revit/Rhino). */
export const SIM_SCRIPTS: Record<string, { title: string; detail: string; context: ContextPatch }[]> = {
  "demo-office": [
    {
      title: "Open the concept model",
      detail: "New 5-storey office, about 4,800 m² GFA, 22 m habitable height.",
      context: PROJECTS[0].sample,
    },
    {
      title: "Client adds two floors",
      detail: "7 storeys, 6,400 m² GFA, 30 m habitable height.",
      context: { storeys: 7, gfa_m2: 6400, habitable_height_m: 30 },
    },
    {
      title: "Site confirmed as a GLS site",
      detail: "Government Land Sales site: yes.",
      context: { gls_site: "yes" },
    },
  ],
  "tan-kembangan": [
    {
      title: "Open the concept model",
      detail: "New 2-storey landed house, about 420 m² GFA, 9 m habitable height, private plot.",
      context: PROJECTS[1].sample,
    },
    {
      title: "Client adds a third storey and attic",
      detail: "3 storeys, 560 m² GFA, 11.5 m habitable height.",
      context: { storeys: 3, gfa_m2: 560, habitable_height_m: 11.5 },
    },
    {
      title: "Move to Design Gateway",
      detail: "Design stage: preparing Design Gateway.",
      context: { design_stage: "design_gateway" },
    },
    {
      title: "Client now wants a mixed-use shophouse",
      detail: "Primary use switches to Mixed, GFA 5,200 m². A stress test of the thresholds.",
      context: { primary_use: "mixed", gfa_m2: 5200, storeys: 5, habitable_height_m: 18 },
    },
  ],
};
