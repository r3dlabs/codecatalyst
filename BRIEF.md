# Build Brief: Code-Aware Design Companion (Singapore)

Name: **CodeCatalyst**.

## 1. Challenge

> Develop a context-aware AI companion that surfaces relevant codes and project requirements during design, before issues lead to redesign.

Judging considerations from the problem statement:

1. Establish the project context before selecting requirements.
2. Surface timely guidance without overwhelming the designer, and link it to authoritative sources.
3. Distinguish guidance from a definitive compliance determination.

A web app is acceptable. Revit/Rhino integration is an optional extension and is out of scope here.

## 2. Product in one line

A designer describes the project, and CodeCatalyst shows the few Singapore requirements that matter at the current design stage. Each comes with why it applies, what to check, and a link to the official source. When the design changes, it shows what changed.

**The demo moment:** the designer adds two floors, and the project crosses two thresholds. New requirements appear with "why now" explanations, before anything has been drawn in detail. That is the challenge's "before issues lead to redesign" made visible.

## 3. Product rules (do not break these)

- **Rules select; AI explains.** Deterministic rules choose the requirements. The LLM never decides what applies.
- **No source, no output.** Every requirement and AI statement cites a stored source record with a link.
- **Never give a verdict.** Do not use "compliant", "pass", "fail", "approved" or a compliance score anywhere, including in AI output. Show this line on every results view: "Design guidance only. Not a compliance determination. Confirm with your Qualified Person and the relevant agency."
- **Unknown is not "no".** If a rule needs a missing input, show the item as conditional and ask for that input. Never silently drop it.
- **No invented numbers.** Any figure shown must exist in a seed record marked as checked. See section 8.

## 4. Core flow

### Step A: Project context

A one-screen form, also fillable from a free-text description. If AI extraction is used, the user must confirm the extracted fields before results appear.

| Field | Values |
|---|---|
| Work type | New erection / Major A&A / Minor A&A |
| Primary use | Office, Retail, Residential (flats), Landed house, Hotel, Healthcare, Education, Industrial, Mixed |
| GFA (m²) | Number |
| Storeys and habitable height (m) | Numbers |
| Government Land Sales site | Yes / No / Unknown |
| Design stage | Concept / Preparing Design Gateway / Preparing Construction Gateway |

Show a live summary such as "New office, 6,400 m², 30 m habitable height". Show unanswered fields with what each would unlock.

### Step B: Focused requirements

- Show at most **5 items** for the current stage, ranked. Put the rest behind "Show all (n)".
- Rank: conditional or newly triggered items first, then the highest redesign impact (massing and core before detail).
- Each card shows:
  - title and domain tag (Fire, Accessibility, Sustainability, Planning, Submission, Buildability)
  - label: **Applies based on your inputs**, **May apply: need input**, or **Check with QP or agency**
  - **Why this appears**, e.g. "GFA 6,400 m² is at or above 5,000 m²"
  - **Design prompt:** one question the designer can act on now
  - **Source:** document, clause, edition, date checked, and link

### Step C: Change detection (the differentiator)

Editing any field re-runs the rules and shows a diff: "2 new, 1 no longer triggered", with the threshold crossed. Cards animate in with a "New" badge.

### Step D: Ask the companion

A Q&A panel on the current results. It answers only from the selected source records and cites them. If the records do not cover the question, it says so and names the agency or document to check. If asked "is my design compliant?", it declines to give a determination and redirects to what to check.

### Step E: Exportable checklist

A copyable or printable list of items, sources and open questions for a QP coordination meeting. Build this only if time remains.

## 5. What to take from VeriFlow

A separate concept, VeriFlow (continuous compliance from telemetry), was considered. **Do not build its telemetry, drift engine, attestation certificates, GHG workbook or multi-tenant parts.** They address buildings in operation, while this challenge is about design. Its "compliance status" output would also contradict the rule against verdicts.

Do reuse these three ideas:

| VeriFlow idea | Use here |
|---|---|
| Canonical controls schema | The `requirements` table in section 7 |
| Drift detection | Project-change diff (Step C), triggered by design changes rather than sensors |
| Tracking code updates | `edition` and `checked_at` on sources. Stretch: show which requirements a new edition affects |

Pitch line if useful: "A canonical requirements repository, applied upstream at design time." Operational telemetry can be a one-line future roadmap item.

## 6. Stack

- Next.js (App Router, TypeScript), Tailwind, deployed on Vercel.
- Supabase Postgres. `.env.local` already has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` and `DIRECT_URL`. Never expose the service role key to the browser.
- Claude via the Anthropic SDK, server-side only, model `claude-sonnet-5-5`, with `ANTHROPIC_API_KEY`. **This key is not in `.env.local` yet and the team has not confirmed the AI provider.** Keep AI behind one module.
- The app must work with no AI key. Use the stored `design_prompt`, and show Q&A as unavailable. The main demo must not depend on a live LLM call.
- No user login for the demo. Keep project state in a single Supabase table, because the simulator and the UI must share it (section 13.2). Do not build multi-tenancy.
- The rules engine is a pure TypeScript function, `evaluate(project, requirements)`, with unit tests.

## 7. Data model

```text
sources
  id, title, issuer (BCA|SCDF|URA), edition, url, clause_ref, clause_url,
  format (html|pdf|xlsx|csv|api), checked_at, checked_by, exact_quote, note

requirements
  id, title, domain, summary, design_prompt, redesign_impact (1-3),
  stages[], trigger (JSON), label_default, source_id, verification_status (checked|unchecked)
```

Example trigger format. Rules that reference a missing field return "May apply":

```json
{ "all": [
  { "field": "gfa_m2", "op": ">=", "value": 5000 },
  { "field": "work_type", "op": "in", "value": ["new_erection", "major_aa"] }
] }
```

## 8. Seed content

Target about 15 to 25 requirements. Quality matters more than volume.

**Accuracy gate:** only records with `verification_status = checked` may display a number. A human or the builder must open the official source and confirm the wording first. Unchecked records may appear only as "Check clause X" with no figure.

Sources were read on 2026-10-31. Items marked **Confirmed** were read on the official page. **Verify** means the value came from an automated summary or is ambiguous, so check it before showing it.

### Demo-critical triggers

| Trigger | Requirement | Status | Source |
|---|---|---|---|
| New project, GFA ≥ 5,000 m² | CORENET X Gateway submission mandatory from 1 Oct 2026; IFC+SG format mandatory | Confirmed | [URA Development Application](https://www.ura.gov.sg/guidelines/development-control/planning-permission/dasub/), [URA circular DC26-08](https://www.ura.gov.sg/guidelines/circulars/dc26-08/) |
| New building, GFA ≥ 5,000 m²; additions adding ≥ 5,000 m²; major retrofit of a building ≥ 5,000 m² | Environmental sustainability requirements apply | Verify which threshold goes with which date: the page lists 5,000 and 2,000 m², and the layout is ambiguous. Our reading: 5,000 m² from 1 Dec 2021 | [BCA regulatory requirements](https://www1.bca.gov.sg/sustainability/legislation-on-environmental-sustainability-for-buildings/new-buildings-and-existing-buildings-undergoing-major-additions-and-alterations/) |
| Habitable height > 24 m | Additional fire provisions, e.g. rising mains, sprinklers (Purpose Group II exception), fire lift or fire command centre, pressurised exit staircases | Verify: full list and wording, read via summary only | [Fire Code Clause 1.4](https://www.scdf.gov.sg/fire-safety-services-listing/fire-code-2023/table-of-content/chapter-1-general/clause-1.4-definitions) |
| GLS site | Higher Green Mark standard: Platinum Super Low Energy with Maintainability Badge | Verify: confirm against the current GLS page, including tender-date conditions and its "Version 7, Sep 2026" reference | [BCA GLS page](https://www1.bca.gov.sg/sustainability/legislation-on-environmental-sustainability-for-buildings/new-buildings-and-existing-buildings-undergoing-major-additions-and-alterations/government-land-sales/) |
| New building or A&A | Code on Accessibility 2025 applies; plans submitted from 1 Nov 2025 | Scope confirmed. The date came from a search summary, so verify it | [BCA Accessibility Code](https://www1.bca.gov.sg/safety-and-standards/accessibility/code-on-accessibility-in-the-built-environment/) |
| Single-unit landed house, or single-storey structure | Direct Submission Process instead of the three gateways | Confirmed in the 2023 circular. Check it is still current in DC26-08 Annex A | [URA circular DC23-07](https://www.ura.gov.sg/guidelines/circulars/dc23-07/) |

### Clause-level prompts (Fire Code 2023)

Base URL: `https://www.scdf.gov.sg/fire-safety-services-listing/fire-code-2023/table-of-content/`

| Topic | Clause | Path after base URL | Early design prompt |
|---|---|---|---|
| Exit requirements, travel distance, exit widths | 2.2 | `chapter-2-means-of-escape/clause-2.2-determinations-of-exit-requirements` | Does the core position keep travel distances workable at the floor plate's far corners? |
| Means of escape | 2.3 | `chapter-2-means-of-escape/clause-2.3-means-of-escape-requirements` | How many exit staircases does this floor plate need, and where do they discharge? |
| Exit staircases | 3.10 | `chapter-3-structural-fire-precautions/clause-3.10-exit-staircases` | Has the core allowed enough space for protected staircases? |
| Compartmentation | 3.2 | `chapter-3-structural-fire-precautions/clause-3.2-provision-of-compartment-walls-and-compartment-floors` | Do large open atria or floor plates conflict with compartment limits? |
| Fire engine access | 4.2 | `chapter-4-site-planning-external-firefighting-provision/clause-4.2-provision-for-external-access-to-building-for-firefighting-and-accessibility-of-site-to-firefighting-appliances` | Does the site plan keep the required appliance access along the facade? |
| Lifts | 6.6 | `chapter-6-firefighting-systems/clause-6.6-lifts` | If a fire lift is needed, does the core layout allow for it? |

Clauses 2.2, 2.3 and 3.2 were opened or returned by search. URLs for 3.10, 4.2 and 6.6 come from the table of contents and were not opened, so check each one.

**Do not seed these numeric values until checked against the source:** travel distance, exit width and staircase width figures. We only saw them through automated summaries. Check them in Clause 2.2 and Table 2.2A.

Purpose Groups: the Fire Code's table of contents has Purpose Group sections around Clauses 9.1 to 9.9, but we did not read their descriptions. Check them before mapping `primary_use` to a Purpose Group. A wrong mapping would be a credibility failure.

### Other official sources

| Document | Link |
|---|---|
| Fire Code 2023 (latest PDF, 40 MB, page updated 7 Jul 2026) | [SCDF PDF](https://www.scdf.gov.sg/docs/default-source/firecode-whole-document-with-annotations/firecode_full_latest_07jul2026.pdf) |
| Fire Code amendments | [SCDF Acts, Codes & Regulations](https://www.scdf.gov.sg/fire-safety-services-listing/downloads/acts-codes-and-regulations) |
| Accessibility Code 2025 PDF (9.7 MB) | <https://go.gov.sg/bca-coa2025> |
| Code for Environmental Sustainability, 4th Ed, Sep 2021 | [BCA PDF](https://isomer-user-content.by.gov.sg/338/e10c055b-7b54-4405-852b-fa3f661af697/es-code_reg-2008_edition-4-0.pdf) |
| Green Mark 2021 | [BCA page](https://www1.bca.gov.sg/sustainability/greenmark/green-mark-2021/) |
| Code of Practice on Buildability 2022 (Addenda 1 to 3 exist; thresholds not checked) | [BCA PDF](https://isomer-user-content.by.gov.sg/338/7aecf16a-f0bf-4eca-8735-dd9c81b4510a/cop-on-buildability-20220f6b47e85361460a975ce6e3b54156ac.pdf) |
| Approved Document v7.07 | [BCA PDF](https://isomer-user-content.by.gov.sg/338/9b829cff-5743-47b1-8fbf-b4c8f426d6df/approved-document-v7-07.pdf) |
| BCA code index | [Building Control Act page](https://www1.bca.gov.sg/safety-and-standards/building-control-act/) |
| URA residential handbooks (flats and condominiums shown) | [URA handbook](https://www.ura.gov.sg/guidelines/development-control/development-control-handbooks/residential/flats-condominiums/) |
| URA non-residential handbooks | [URA index](https://www.ura.gov.sg/Corporate/Guidelines/Development-Control/Non-Residential) |

Trap: the "Accessibility Code 2025" link on BCA's Building Control Act page points to a circular (filename `circular---code-on-accessibility...`), not the code. Use the short link above.

## 9. Demo script (about 3 minutes)

**Scenario:** a new-build office on a private site in Singapore. All figures are fictional.

1. **Context.** Type: "New 5-storey office, about 4,800 m² GFA, 22 m habitable height, concept stage." Confirm the extracted fields. The GLS field stays unknown and is flagged.
2. **Focus.** At most 5 cards appear, plus one "May apply" item asking about the GLS status. Point out the "why", the source link and the no-verdict line.
3. **The change.** The client asks for two more floors: 7 storeys, 6,400 m², 30 m. The diff shows what is new: CORENET X Gateway and IFC+SG (≥ 5,000 m²), environmental sustainability (≥ 5,000 m²), and additional fire provisions (> 24 m). Say: "This is the moment that usually surfaces too late. The core has not been fixed yet."
4. **Source.** Click through to the official SCDF or URA page live.
5. **Ask.** "What should I look at for the core now?" The answer cites records. Then ask "Is my design compliant?" and show it decline to give a determination.
6. **Close.** The GLS answer changes to Yes, and the Green Mark requirement appears.

## 10. Build priority

Stop at any tier and still have a working demo.

1. **Must have:** seed data with the demo triggers, `evaluate()` with tests, context form, focused cards, deployed URL.
2. **Should have:** change diff with "New" badges, stage filter, conditional items and their questions.
3. **Differentiators:** free-text context extraction, cited Q&A with refusal.
4. **Stretch:** checklist export, edition-change view.

## 11. Acceptance criteria

- [ ] The demo script runs end to end on the deployed URL, and in a run with no AI key steps 1 to 4 and 6 still work (typed form input replaces free text).
- [ ] No results appear until work type, use, GFA, height and stage are provided or explicitly marked unknown.
- [ ] Default view has at most 5 items, each with why, prompt, source link and checked date.
- [ ] Every source link used in the demo has been opened and resolves to the right official page.
- [ ] Every displayed number comes from a `checked` record.
- [ ] Searching the UI and AI output finds no verdict language outside the disclaimer. Test with "Is my design compliant?" and "Can I skip this?".
- [ ] A question outside the seeded records gets "not covered" plus where to check, not an invented answer.
- [ ] Unit tests cover threshold edges (4,999 / 5,000 m²; 24 / 24.1 m), unknown inputs and the diff.
- [ ] A simulator event updates the open UI within about 2 seconds, and the demo can be reset and rerun.
- [ ] No secret reaches the client bundle, and `.env*` stays uncommitted.

## 12. Open items

- **AI provider and key:** Anthropic is assumed, and the key still needs adding.
- **Source verification:** every "Verify" item in section 8 needs a person or the builder to open the source.
- **Time limit:** the hackathon deadline was not given, so use the tiers in section 10.
- **Applicability of CORENET X to ongoing projects:** projects started in CORENET 2 by 30 Sep 2026 may continue there. The demo uses a new project and avoids this.

## 13. Team workstreams

Three groups work in parallel. These two contracts let them proceed without waiting for each other.

| Group | Delivers | Consumed by |
|---|---|---|
| Source research | Source register and candidate requirements (13.1) | Builder's seed data |
| Simulated environment | Simulated design tool that calls the API (13.2) | Demo step 3 |
| App build | Rules engine, UI and API | Everyone |

### 13.1 Source research handoff

Research answers two questions for each source: is it worth ingesting for the demo, and how? Prioritise sources that change early design decisions: massing, core, site layout and submission route. A source's format does not make it a priority.

**Deliver one spreadsheet or CSV row per source:**

`title, issuer, edition, effective_date, official_url, format (html|pdf|xlsx|csv|api), access (open|login|paid), clause_links (yes|no), update_signal (where amendments are announced), relevance (high|medium|low), ingest_method (manual|parse|api|link_only), owner, notes`

**Deliver one row per candidate requirement, matching section 7:**

`title, domain, trigger_in_words, trigger_fields, threshold_value, stage, design_prompt, redesign_impact, source_title, clause_ref, clause_url, exact_quote, checked_by, checked_at`

Rules:

- `exact_quote` and `checked_by` are required before a row can become `checked`. A second person should check any row with a threshold.
- Report whether a source has a real public API only after confirming it on the provider's site. We have not confirmed any BCA, SCDF or URA code-content API, and everything read so far is web pages or PDFs. Do not design around one until it is found.
- Check the terms of use before storing full code text. Store short quotes plus links, not whole documents.
- Excel and CSV are worth ingesting only if they feed a design-stage rule. Do not add a format just to show multi-format ingestion.

**Ingestion pipeline for the demo:** source file or page -> AI-assisted draft of candidate rows -> person checks against the source -> `checked` row -> seed data. AI drafts never reach users without that check. Ingesting one source live is a stretch goal.

### 13.2 Simulated environment

**Decision: simulate a design tool, not a building in operation.** The simulator stands in for a Revit or Rhino plugin and sends model changes such as GFA, storeys and height. It should not send meter, energy or sensor readings, because those belong to the operational monitoring ruled out in section 5.

This also gives the challenge's optional Revit/Rhino extension a credible story, but label it as simulated in the demo.

**API contract (v1).** Send `x-api-key` on write calls, using a shared demo key from `DEMO_API_KEY`.

`PUT /api/v1/projects/{id}/context` updates the project and returns its current state and diff. Fields left out stay unchanged. `null` means unknown. A repeated `event_id` is ignored.

```json
{
  "event_id": "sim-0003",
  "source": "simulated-revit",
  "context": {
    "work_type": "new_erection",
    "primary_use": "office",
    "gfa_m2": 6400,
    "storeys": 7,
    "habitable_height_m": 30,
    "gls_site": null,
    "design_stage": "concept"
  }
}
```

Response, also returned by `GET /api/v1/projects/{id}/requirements`:

```json
{
  "project_id": "demo-office",
  "revision": 3,
  "disclaimer": "Design guidance only. Not a compliance determination. Confirm with your Qualified Person and the relevant agency.",
  "missing_fields": ["gls_site"],
  "items": [
    {
      "id": "cx-gateway-5000",
      "title": "CORENET X Gateway submission",
      "domain": "Submission",
      "label": "applies_on_inputs",
      "why": "GFA 6,400 m² is at or above 5,000 m²",
      "design_prompt": "Is the team planning for IFC+SG BIM submission?",
      "source": { "title": "URA Development Application", "url": "https://www.ura.gov.sg/guidelines/development-control/planning-permission/dasub/", "checked_at": "2026-10-31" }
    }
  ],
  "diff": { "from_revision": 2, "added": ["cx-gateway-5000"], "removed": [], "changed": [] }
}
```

`label` is one of `applies_on_inputs`, `may_apply_need_input` or `check_with_qp`. No field may hold a verdict such as pass, fail or compliant.

**Simulator requirements:**

- Plays the demo scenario in section 9 as timed events, with a clear "next step" control so the presenter can set the pace.
- Has a `POST /api/v1/projects/{id}/reset` call, or equivalent, that returns the demo to its starting state.
- Until the API exists, runs against a mock that returns the JSON above.

**UI behaviour:** the app polls the project every 2 seconds, or uses Supabase Realtime, so an event from the simulator shows the diff on screen. The form in Step A remains a working fallback if the simulator fails on stage.
