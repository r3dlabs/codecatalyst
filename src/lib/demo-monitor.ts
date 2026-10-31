/**
 * DEMO DATA. Simulated telemetry and manual audit observations for the Tan Residence (Kembangan) sample.
 * Observations are flags for review. They are not a compliance status and they are not real readings.
 */
export type Channel = "telemetry" | "audit";
export type Criticality = "Critical" | "High" | "Medium" | "Low";

export interface MonitorEvent {
  id: string;
  day: number;
  channel: Channel;
  /** Requirement id from the seed register. */
  control: string;
  observation: string;
  priority: 1 | 2 | 3;
  criticality: Criticality;
  owner: string;
  /** Status the item has when it is logged. */
  status: "Open" | "Raised with QP" | "Closed";
  /** Marks an earlier event as closed by this one. */
  resolves?: string;
}

export const DEMO_START = "2026-11-02";

export const MONITOR_EVENTS: MonitorEvent[] = [
  { id: "e1", day: 1, channel: "audit", control: "planning-landed", observation: "Kick-off audit: boundary survey received and filed against the massing model.", priority: 3, criticality: "Low", owner: "Project architect", status: "Closed" },
  { id: "e2", day: 4, channel: "telemetry", control: "planning-landed", observation: "Model sync: rear setback offset differs from the concept massing by more than the tolerance the QP set.", priority: 1, criticality: "Critical", owner: "Project architect", status: "Open" },
  { id: "e3", day: 6, channel: "audit", control: "accessibility-2025", observation: "Site walk: level change noted at the main entrance threshold on the current layout.", priority: 2, criticality: "High", owner: "Design lead", status: "Raised with QP" },
  { id: "e4", day: 9, channel: "telemetry", control: "fire-staircase-3-10", observation: "Model sync: staircase core footprint reduced after the third storey was added.", priority: 1, criticality: "High", owner: "Structural engineer", status: "Open" },
  { id: "e5", day: 12, channel: "audit", control: "fire-access-4-2", observation: "Photo log of the frontage and driveway uploaded for the fire engine access review.", priority: 3, criticality: "Low", owner: "Site coordinator", status: "Closed" },
  { id: "e6", day: 15, channel: "telemetry", control: "fire-exit-2-2", observation: "Model sync: longest path from the attic to the stair re-measured after the layout change.", priority: 2, criticality: "Medium", owner: "Design lead", status: "Open" },
  { id: "e7", day: 18, channel: "audit", control: "buildability", observation: "Design review: precast and facade layout notes recorded for buildability scoring.", priority: 3, criticality: "Low", owner: "Project architect", status: "Raised with QP" },
  { id: "e8", day: 21, channel: "telemetry", control: "fire-compartment-3-2", observation: "Model sync: open void between ground floor and attic added in revision 4.", priority: 2, criticality: "High", owner: "Design lead", status: "Open" },
  { id: "e9", day: 24, channel: "audit", control: "planning-landed", observation: "Re-audit: revised rear setback drawings and survey evidence submitted to the QP.", priority: 2, criticality: "Medium", owner: "Project architect", status: "Closed", resolves: "e2" },
  { id: "e10", day: 27, channel: "audit", control: "accessibility-2025", observation: "Re-audit: ramp detail at the entrance added to the drawing set.", priority: 3, criticality: "Low", owner: "Design lead", status: "Closed", resolves: "e3" },
];
