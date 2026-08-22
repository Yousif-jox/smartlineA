const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType, VerticalAlign, Table, TableRow, TableCell } = require("docx");

const B = (t) => new TextRun({ text: t, bold: true });
const T = (t) => new TextRun(t);

const bulletRef = "ans-bullets";

const qa = [
  {
    title: "Question 1 — Captain ↔ Vehicle relationship over a week",
    q: "In your relationship map you wrote Captain → Vehicle (1:N) and Vehicle → Captain (1:N) at the same time. Walk me through what that means over a full week of operations. Is that what you intended?",
    a: [
      ["The map as drawn is ambiguous, and you are right to call it out: a bidirectional pair of 1:N arrows reads as a many-to-many relationship — which is actually what a real week looks like, but my notation was wrong."],
      ["Over a full week: Captain A drives Vehicle V1 on Monday and Vehicle V2 on Wednesday (different trips). Vehicle V1 is driven by Captain A on Monday and by Captain B on Friday (different shifts). There is no permanent pairing — the captain/vehicle binding exists per trip, not per captain and not per vehicle."],
      ["What I intended is: Captain ↔ Vehicle is N:M, realized through Trip — each trip binds exactly one captain and one vehicle. The relationship map should say N:M via Trip, not two 1:N arrows."],
      ["What must hold regardless: double-booking is checked at both levels — a captain cannot be on two overlapping trips even with different vehicles (Task 10), and a vehicle cannot be in two overlapping trips even with different captains (FR-003). If I had meant a permanent pairing (captain owns a vehicle), it would be 1:1 and the week would repeat the same pair — but that contradicts shift scheduling."],
      ["Fix: correct the map to N:M through Trip and keep the per-trip binding."],
    ],
  },
  {
    title: "Question 2 — Pickup Location: shared point vs N:1 map",
    q: "Your Pickup Location definition says it exists \u201cso that multiple employees can share a point\u201d, but your map records Pickup Location → Employee as N:1. Which one is right, and what breaks in the clustering logic if you pick the wrong one?",
    a: [
      ["Both statements are true — the map is incomplete, not wrong. The real relationship between Employee and Pickup Location is M:N: a pickup location can serve many employees (that is the sharing the definition talks about), and an employee can have several pickup locations with one default (assumption A2). The map only captured one direction."],
      ["If you pick only the N:1 side (each employee owns many points, no sharing), the clustering input becomes ambiguous: which point feeds Task 11's grouping? The answer would have to be the employee's default point — and employees standing at the same physical point but with different defaults would be wrongly separated."],
      ["If you pick only the 1:N side (each point belongs to one employee), sharing is destroyed: two employees at the same physical gate would land in different clusters even though they are one pickup group — the clustering would produce nonsense for exactly the industrial-zone case the business cares about."],
      ["Resolution: model Employee ↔ PickupLocation as M:N with a default flag; clustering (Task 11) uses each employee's DEFAULT pickup location; shared points merge employees into one cluster."],
    ],
  },
  {
    title: "Question 3 — Branch \u201cmay operate its own Vehicles\u201d — undocumented assumption",
    q: "You wrote that a Branch \u201cmay operate its own set of Vehicles.\u201d Where did that come from? It is not in your A1–A8 assumption list. If a Vehicle actually belongs to the Company fleet and floats between Branches, what changes in your model?",
    a: [
      ["Honest answer: that line slipped in from my mental model of a Branch as the operational unit that dispatches trips. It is not in A1–A8, and you are right — an undocumented assumption is exactly the gap the assumption list exists to prevent."],
      ["If vehicles belong to a company fleet and float between branches, the changes are:"],
      [
        "Vehicle tenancy becomes company-scoped, not branch-scoped — this changes the multi-tenant design (Task 36): vehicle.company_id exists, vehicle.branch_id does not.",
        "The Branch–Vehicle link disappears from the ERD; which branch used a vehicle is derived from the Trip, not from the Vehicle.",
        "Capacity and availability checks (FR-003, Task 9) must consider the whole company pool — any branch can draw any available vehicle.",
        "Vehicle double-booking detection becomes company-wide — the mirror of the captain-overlap rule (Task 10 / Task 38).",
        "Open question V3 (\u201ccan branches share a vehicle?\u201d) is effectively answered \u201cyes\u201d by default, so the Day 3 schema must be built for it from the start.",
      ],
      ["Action: add this as assumption A9 (vehicles are a company-scoped pool) and flag its dependency on V3."],
    ],
  },
  {
    title: "Question 4 — Route vs Trip, and history stability",
    q: "Explain the difference between a Route and a Trip to a Smart Line operations manager who has never seen software. Then tell me: if a Route's stop order is changed on Tuesday, what happens to Monday's completed Trips?",
    a: [
      ["Route is the plan — the fixed line: which stops, in which order, for which branch. It exists regardless of any day; you can look at it on a map. Trip is one execution of that plan on one specific day, with one vehicle, one captain, and the actual employees."],
      ["Analogy: the Route is the bus line printed on the map; the Trip is the actual bus that ran Monday at 7 a.m. with those 40 people."],
      ["If the route's stop order changes on Tuesday, Monday's completed trips are completely unaffected — they are historical records of what actually happened Monday. The route change applies only to trips created after the change."],
      ["This works because each trip keeps a snapshot (or version reference) of the stops it executed. History never rewrites — the same principle as BR-8 for attendance."],
      ["Business consequence: Monday's attendance, distances, and charges stay truthful; an audit or a complaint about Monday is answered with Monday's data, never Tuesday's plan. Design note: store the executed stop list on the Trip (snapshot) rather than a live foreign key to Route — otherwise a route edit silently rewrites history."],
    ],
  },
  {
    title: "Question 5 — Why Attendance is its own entity",
    q: "Why does Attendance need to exist as its own entity at all? Why is it not just a status field on the employee's trip assignment? Give me a business consequence of your answer.",
    a: [
      ["Because attendance is a record of what happened, not a property of the plan. A status field on the assignment would conflate \u201cassigned\u201d (a plan) with \u201cattended\u201d (a fact), and it would still need event history and timestamps to support corrections."],
      ["The attendance state machine (Task 26) has five states with its own lifecycle, decoupled from the trip state (BR-8) — a lifecycle cannot live in a field. Cancellation semantics (only unrecorded employees become Cancelled; recorded states are preserved) require per-employee event records."],
      ["Business consequence: reporting. A manager's report \u201cwho actually boarded today\u201d must distinguish \u201cnot yet recorded\u201d (Unknown) from \u201cconfirmed no-show\u201d (Absent) from \u201cpresent but not boarded\u201d (Not Boarded). With a status field you cannot distinguish \u201cno data yet\u201d from \u201cconfirmed absence\u201d — employees who were never recorded would appear as absent, driving wrong payroll and attendance decisions and generating complaints."],
      ["The entity also gives the captain a single trusted writer and gives auditing a full event log (Task 13's idempotent event model)."],
    ],
  },
  {
    title: "Question 6 — Defending the Call Center cross-company read",
    q: "You gave the Call Center legitimate read access across all companies, which you yourself called an exception to tenant isolation. Defend that decision to a client whose competitor is also a Smart Line customer. What would you put in place instead?",
    a: [
      ["Start with the honest premise: a client's competitor on the same platform is precisely why this exception must be engineered defensively — not argued away."],
      ["The need is real: an agent answering a call does not know the caller's company in advance. Forcing company selection upfront, or one account per company, degrades service and still leaks the company when a caller dials the wrong line."],
      ["But the design would not be a free cross-tenant browse. What I would put in place instead — a shrink-to-minimum design:"],
      [
        "No tenant enumeration: agents cannot list or browse another company's data. Cross-company access only via verified lookup keys (e.g., phone number or national ID) that resolve to exactly the relevant records.",
        "Database-enforced row-level security (PostgreSQL RLS): the agent role gets a constrained policy, so even a buggy query cannot cross the tenant boundary.",
        "Field minimization: agents see only what the workflow needs (identity + complaint status) — never financial data.",
        "Full audit: every cross-tenant read is logged with who/when/why, and tenant admins can view the audit trail for their own company.",
        "A data-separation commitment: cross-tenant data is never used for analytics or shared across companies — and each client receives the audit visibility as proof.",
      ],
      ["So the answer to the client: the exception exists, but it is narrow (lookup-only), enforced at the database layer, minimized in fields, and fully auditable by them — the same safeguards I would want if the roles were reversed."],
    ],
  },
  {
    title: "Question 7 — Wallet shortfall at 6 a.m.",
    q: "Your Wallet is one per Company and can never go negative. A trip completes at 6 a.m. and the balance is insufficient. The employees are already at work. What does the system do, and who is told?",
    a: [
      ["The ride happened; employees are at work. The system must not fail the trip, must not freeze attendance, and must not silently swallow the money problem."],
      ["Design: charging on completion is an asynchronous, idempotent transaction (FR-013). If the balance is insufficient, the charge is rejected at the constraint level (A8 — balance never negative), but the outcome is a recorded, retryable charge failure — never a rolled-back trip."],
      ["Concretely: (1) the trip and attendance are finalized normally — operational data is never coupled to payment success; (2) a pending-charge record is created with the exact shortfall; (3) notifications go to the Company Manager (their wallet is short — top up) and to Smart Line finance/credit control (monitoring), with the precise amount and trip reference; (4) employees are NOT told — their ride is done, this is a company obligation, and notifying them only creates support noise; (5) when the manager tops up, the pending charge is retried idempotently — one charge, exactly once."],
      ["Auditable end to end. If insufficient balances become frequent, the operational answer is a credit limit or pre-funding policy — a business decision, not a schema change to allow negative balances, which we deliberately rejected (A8)."],
    ],
  },
  {
    title: "Question 8 — Minimum Vehicle attributes",
    q: "Your Vehicle entry defers most attributes to \u201copen question V2.\u201d If I told you today that you must ship Vehicle as-is, what is the minimum set of attributes the business genuinely needs, and why those?",
    a: [
      ["Minimum set: (1) id — identity; (2) capacity (seating) — the core assignment constraint (Task 9, FR-006); without it overbooking is undetectable; (3) company_id — the tenant boundary; without it multi-tenant isolation (Task 36) and the 404 rule (NFR-009) have nothing to enforce; (4) status (available/unavailable) — required by FR-003 (reject unavailable vehicles) and by the scope decision (O3: the full maintenance module is out of scope, but a minimal availability flag is in scope for data integrity); (5) license plate (registration) — physical identification: captains, enforcement, and complaints reference a vehicle by plate; (6) type/category (e.g., minibus vs bus) — drives capacity semantics and future fare logic (W1) without a schema change."],
      ["Why these six: each one maps to a tested requirement — FR-003 (availability), FR-006 (capacity), NFR-009 (tenancy) — nothing more, nothing less."],
      ["Everything deferred — maintenance history, fuel, insurance, GPS device id — maps to out-of-scope items (O3, O5) and can be added later without migration pain, because no requirement reads them today."],
    ],
  },
];

const children = [];

// Title
children.push(new Paragraph({
  heading: HeadingLevel.TITLE,
  children: [new TextRun("Smart Line — Day 2 Interview Prep")],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: "Answers to the 8 Review Questions (candidate: Youssef)", italics: true })],
}));

for (let i = 0; i < qa.length; i++) {
  const item = qa[i];
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300 },
    children: [new TextRun(item.title)],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: item.q, italics: true })],
    spacing: { after: 120 },
  }));
  children.push(new Paragraph({
    spacing: { before: 60, after: 120 },
    children: [B("Answer: ")],
  }));
  for (const part of item.a) {
    if (Array.isArray(part)) {
      for (const bullet of part) {
        children.push(new Paragraph({
          numbering: { reference: bulletRef, level: 0 },
          children: [new TextRun(bullet)],
        }));
      }
    } else {
      children.push(new Paragraph({ children: [new TextRun(part)], spacing: { after: 100 } }));
    }
  }
}

// Closing note
children.push(new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 300 },
  children: [new TextRun("Before the interview")],
}));
for (const line of [
  "Say these answers in your own words — the interviewer will probe any claim you cannot defend.",
  "Question 1 is about notation honesty: accept the ambiguity, explain the N:M-via-Trip intent, and state the double-booking constraints.",
  "Question 3 is about process: admit the undocumented assumption and name the concrete fix (A9).",
  "Question 6 is the hardest live question: lead with the client's concern, then present the shrink-to-minimum controls.",
]) {
  children.push(new Paragraph({
    numbering: { reference: bulletRef, level: 0 },
    children: [new TextRun(line)],
  }));
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 44, bold: true, color: "1F3864", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "1F3864", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
    ],
  },
  numbering: {
    config: [
      { reference: bulletRef, levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("day2-interview-answers.docx", buffer);
  console.log("written: day2-interview-answers.docx");
});
