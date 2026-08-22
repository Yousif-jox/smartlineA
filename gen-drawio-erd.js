// Complete ERD as draw.io — READABLE layout:
//  - entities positioned in 4 domain zones with generous spacing
//  - relationship diamonds placed ON the segment between the two
//    entities, pushed clear of every entity box (no overlap)
//  - domain labels, cardinality on both ends of every edge
const fs = require('fs');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;').replace(/\n/g, '&#10;');

const CW = 210, CH_BASE = 34, LINE = 17;

const entities = [
  // id, label, [attrs], x, y
  ['Company', 'Company', ['id (PK)', 'name', 'status (CHECK)', 'created_at'], 60, 120],
  ['Branch', 'Branch', ['id (PK)', 'company_id (FK)', 'name', 'address'], 480, 120],
  ['Employee', 'Employee', ['id (PK)', 'company_id (FK)', 'branch_id (FK, nullable)', 'name', 'phone (UNIQUE)', 'status (CHECK)', 'created_at'], 900, 120],
  ['PickupLoc', 'PickupLocation', ['id (PK)', 'company_id (FK)', 'name', 'lat', 'lng', 'address'], 1320, 120],
  ['EmpPickup', 'EmployeePickup', ['employee_id (PK,FK)', 'pickup_location_id (PK,FK)', 'is_default (CHECK)'], 1320, 460],
  ['Captain', 'Captain', ['id (PK)', 'company_id (FK)', 'name', 'phone (UNIQUE)', 'status (CHECK)'], 480, 460],
  ['Vehicle', 'Vehicle', ['id (PK)', 'company_id (FK)', 'capacity (CHECK>=0)', 'status (CHECK)', 'plate (UNIQUE)', 'type'], 900, 460],

  ['Route', 'Route', ['id (PK)', 'branch_id (FK)', 'name'], 60, 760],
  ['RouteStop', 'RouteStop', ['id (PK)', 'route_id (FK)', 'pickup_location_id (FK)', 'position (CHECK)', 'UNIQUE(route_id, position)'], 480, 760],
  ['Trip', 'Trip', ['id (PK)', 'company_id (FK)', 'route_id (FK)', 'vehicle_id (FK)', 'captain_id (FK)', 'trip_date', 'start_time', 'end_time', 'state (CHECK 7)', 'stops_snapshot (JSONB)', 'created_at'], 900, 760],
  ['TripEmployee', 'TripEmployee', ['trip_id (PK,FK)', 'employee_id (PK,FK)', 'assigned_at', 'removed_at'], 1320, 760],
  ['Attendance', 'Attendance', ['id (PK)', 'trip_id (FK)', 'employee_id (FK)', 'state (CHECK 5)', 'updated_at', 'UNIQUE(trip_id, employee_id)'], 900, 1060],
  ['AttEvent', 'AttendanceEvent', ['id (PK)', 'attendance_id (FK)', 'event_id (UNIQUE)', 'state (CHECK)', 'ts', 'recorded_by (FK)'], 1320, 1060],

  ['Wallet', 'Wallet', ['id (PK)', 'company_id (FK,UNIQUE)', 'balance (CHECK>=0)', 'updated_at'], 60, 1380],
  ['WalletTx', 'WalletTransaction', ['id (PK)', 'wallet_id (FK)', 'idempotency_key', 'amount', 'type (CHECK)', 'trip_id (FK)', 'status (CHECK)', 'created_at', 'UNIQUE(wallet_id, idempotency_key)'], 480, 1380],

  ['Complaint', 'Complaint', ['id (PK)', 'company_id (FK)', 'employee_id (FK)', 'category', 'priority (CHECK)', 'state (CHECK)', 'assigned_agent_id (FK)', 'resolution', 'created_at'], 1740, 120],
  ['Account', 'Account', ['id (PK)', 'company_id (FK, nullable)', 'role (CHECK)', 'name', 'credentials_hash'], 2100, 120],
  ['Notification', 'Notification', ['id (PK)', 'recipient_id (FK)', 'type', 'payload (JSONB)', 'status (CHECK)', 'event_id (UNIQUE)', 'created_at'], 2100, 460],
  ['AuditLog', 'AuditLog', ['id (PK)', 'company_id (FK)', 'actor_id (FK)', 'action', 'entity', 'entity_id', 'old_value (JSONB)', 'new_value (JSONB)', 'created_at'], 2100, 780],
];

const rels = [
  ['Company', '1', 'has', 'N', 'Branch'],
  ['Company', '1', 'employs', 'N', 'Employee'],
  ['Company', '1', 'owns', '1', 'Wallet'],
  ['Company', '1', 'hires', 'N', 'Captain'],
  ['Company', '1', 'fleet', 'N', 'Vehicle'],
  ['Company', '1', 'scopes', 'N', 'PickupLoc'],
  ['Employee', 'N', 'has (via)', 'M', 'PickupLoc'],
  ['Branch', '1', 'houses', 'N', 'Employee'],
  ['Branch', '1', 'owns', 'N', 'Route'],
  ['Route', '1', 'has', 'N', 'RouteStop'],
  ['RouteStop', 'N', 'refs', '1', 'PickupLoc'],
  ['Trip', 'N', 'executes', '1', 'Route'],
  ['Trip', 'N', 'uses', '1', 'Vehicle'],
  ['Trip', 'N', 'driven by', '1', 'Captain'],
  ['Employee', 'N', 'assigned (via)', 'M', 'Trip'],
  ['Trip', '1', 'has', 'N', 'Attendance'],
  ['Attendance', '1', 'has', 'N', 'AttEvent'],
  ['Wallet', '1', 'ledger', 'N', 'WalletTx'],
  ['Trip', '1', 'charges', 'N', 'WalletTx'],
  ['Employee', '1', 'submits', 'N', 'Complaint'],
  ['Account', '1', 'handles', 'N', 'Complaint'],
];

const domains = [
  ['Core Tenant Chain', 60, 60],
  ['Execution Chain', 60, 700],
  ['Financial Chain', 60, 1320],
  ['Support Chain', 1740, 60],
];

const H = (attrs) => CH_BASE + attrs.length * LINE;
const rect = (e) => {
  const h = H(e[2]);
  return { x: e[3], y: e[4], w: CW, h, cx: e[3] + CW / 2, cy: e[4] + h / 2 };
};
const ents = {};
for (const e of entities) ents[e[0]] = rect(e);

let cells = [];
cells.push('<mxCell id="0"/>');
cells.push('<mxCell id="1" parent="0"/>');
let nid = 2;
const nodeIds = {};

// domain labels
for (const [label, x, y] of domains) {
  cells.push(`<mxCell id="n${nid}" value="${esc(label)}" style="text;html=1;fontSize=14;fontStyle=1;fontColor=#1F3864;align=left;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="320" height="30" as="geometry"/></mxCell>`);
  nid++;
}

// entity boxes
for (const [id, label, attrs] of entities) {
  const r = ents[id];
  const value = esc(label + '\n──────────────\n' + attrs.join('\n'));
  cells.push(
    `<mxCell id="n${nid}" value="${value}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;verticalAlign=top;spacing=4;fontSize=10;fontStyle=1" vertex="1" parent="1">` +
    `<mxGeometry x="${r.x}" y="${r.y}" width="${CW}" height="${r.h}" as="geometry"/></mxCell>`
  );
  nodeIds[id] = `n${nid}`;
  nid++;
}

// relationship diamonds: on the segment between centers, pushed clear of all boxes
const D = { w: 84, h: 54 };
const intersectsAny = (cx, cy) => {
  for (const key in ents) {
    const r = ents[key];
    const pad = 20;
    if (cx + D.w / 2 + pad > r.x && cx - D.w / 2 - pad < r.x + r.w &&
        cy + D.h / 2 + pad > r.y && cy - D.h / 2 - pad < r.y + r.h) return true;
  }
  return false;
};

const relDiamonds = [];
for (const [a, la, dlab, lb, b] of rels) {
  const A = ents[a], B = ents[b];
  const mx = Math.round((A.cx + B.cx) / 2);
  const my = Math.round((A.cy + B.cy) / 2);
  // spiral search around the midpoint: expanding rings, then perpendicular
  // offsets — pick the FIRST candidate with zero intersections
  let best = null;
  outer:
  for (let r = 0; r <= 220; r += 22) {
    for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const px = Math.round(mx + ox);
      const py = Math.round(my + oy);
      if (!intersectsAny(px, py)) { best = { x: px, y: py }; break outer; }
    }
  }
  if (!best) best = { x: mx, y: my };
  const cx = best.x, cy = best.y;
  cells.push(
    `<mxCell id="n${nid}" value="${esc(dlab)}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontSize=11" vertex="1" parent="1">` +
    `<mxGeometry x="${Math.round(cx - D.w / 2)}" y="${Math.round(cy - D.h / 2)}" width="${D.w}" height="${D.h}" as="geometry"/></mxCell>`
  );
  relDiamonds.push({ a, b, la, lb, d: `n${nid}` });
  nid++;
}

// edges
for (const { a, b, la, lb, d } of relDiamonds) {
  cells.push(
    `<mxCell id="e${nid}" value="${esc(la)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;fontSize=10;fontStyle=1" edge="1" parent="1" source="${nodeIds[a]}" target="${d}"><mxGeometry relative="1" as="geometry"/></mxCell>`
  );
  nid++;
  cells.push(
    `<mxCell id="e${nid}" value="${esc(lb)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;fontSize=10;fontStyle=1" edge="1" parent="1" source="${d}" target="${nodeIds[b]}"><mxGeometry relative="1" as="geometry"/></mxCell>`
  );
  nid++;
}

const xml =
  `<mxfile host="app.diagrams.net" agent="smartline" version="24.0.0">\n` +
  `<diagram id="erd-day3-readable" name="ERD-Readable">\n` +
  `<mxGraphModel dx="1800" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2500" pageHeight="1600" math="0" shadow="0">\n` +
  `<root>\n` + cells.join('\n') + '\n</root>\n</mxGraphModel>\n</diagram>\n</mxfile>';

fs.writeFileSync('docs/database/erd.drawio', xml);
console.log('written entities:', entities.length, '| diamonds:', relDiamonds.length, '| cells:', cells.length);
