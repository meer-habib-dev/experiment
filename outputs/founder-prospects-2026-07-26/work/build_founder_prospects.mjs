import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir =
  "/Users/meernabib/ProgrammingProjects/expo/experiment/outputs/founder-prospects-2026-07-26";
const workbookPath = `${outputDir}/founder_mobile_prospects_batch_3.xlsx`;
const previewPath = `${outputDir}/founder_mobile_prospects_preview.png`;

const prospects = [
  [
    "Fort",
    "Miranda Nover; Paul Schneider; Zac Valles",
    "https://fort.cx/",
    "founders@fort.cx",
    "US · Highest-fit outreach. W26 team of 3 building a strength wearable plus a companion app experience. Pitch Expo/React Native ownership: onboarding, Bluetooth/sensor sync, workout history, charts, notifications, and store-readiness.",
    "https://www.ycombinator.com/companies/fort",
  ],
  [
    "Pocket",
    "Gabriel Dymowski; Akshay Narisetti",
    "https://heypocket.com/",
    "akshay@heypocket.com",
    "US · Funded hardware + software company with active iOS/Android apps and fast US/Europe growth. Pitch mobile reliability, recorder-to-app sync, offline handling, performance, and a focused app-quality sprint.",
    "https://www.ycombinator.com/companies/pocket",
  ],
  [
    "CareSwift",
    "Brian Weigand; Jonathan Zero",
    "https://www.careswift.com/",
    "founders@careswift.com",
    "US · Two-person YC team; product is used by ambulance crews in the field. Strong native-mobile case for fast voice capture, offline resilience, truck-side UX, secure uploads, and device integration.",
    "https://www.ycombinator.com/companies/careswift",
  ],
  [
    "YouShift",
    "Lucía Vives Martorell; Jota Chamorro; Adolfo Roquero Gimenez",
    "https://www.you-shift.com/",
    "info@you-shift.com",
    "US/Spain · Hospital workforce product already serves 1,000+ doctors and has mobile workflows. Pitch React Native/Expo support for shift swaps, preferences, push alerts, calendar sync, and app maintenance.",
    "https://www.ycombinator.com/companies/youshift",
  ],
  [
    "MochaCare",
    "Nicolas Walker; Pranav Uppiliappan",
    "https://www.mochacare.com/",
    "",
    "US · W26 team of 2 handling caregiver hiring, scheduling, and intake. A caregiver/manager app could cover shift confirmations, availability, document uploads, client notes, and urgent push alerts.",
    "https://www.ycombinator.com/companies/mochacare",
  ],
  [
    "Chasi",
    "Akash Pavan; Sarman Aulakh",
    "https://chasi.ai/",
    "",
    "US · W26 industrial startup already has an iOS field app alongside its AI revenue platform. Pitch improving mobile workflows for equipment photos, quotes, inventory lookups, service requests, and offline use.",
    "https://www.ycombinator.com/companies/chasi",
  ],
  [
    "Pave Robotics",
    "Josh Kelly; Mason Landon Smith",
    "https://pave-robotics.com/",
    "founders@pave-robotics.com",
    "US · Small robotics team operating road-repair machines in the field. A phone/tablet companion could support job setup, robot status, alerts, photos/GPS, maintenance logs, and operator handoff.",
    "https://www.ycombinator.com/companies/pave-robotics",
  ],
  [
    "Juxta",
    "John Ferrara",
    "https://juxta.com/",
    "info@juxta.com",
    "US · Positioning technology uses sensors already present in mobile devices and works with limited connectivity. Pitch a React Native SDK, reference app, offline demo, and integration support for customer apps.",
    "https://www.ycombinator.com/companies/juxta",
  ],
  [
    "Booko",
    "Will Hall; Arjun Saluja",
    "https://bookoapp.com/",
    "will@bookoapp.com; arjun@bookoapp.com",
    "US · W26 team of 2; recently raised about $4.3M and sells dynamic pricing to appointment businesses. A merchant app could deliver pricing alerts, approve/override actions, occupancy snapshots, and daily revenue summaries.",
    "https://www.ycombinator.com/companies/booko",
  ],
  [
    "AutoSitu",
    "Xuanshu (Asher) Lin; George Zhai",
    "https://autositu.com/",
    "founders@autositu.com",
    "US · W26 team of 2 with a web workspace for city and development plan review. Mobile/tablet extension: onsite drawings, issue checklists, annotated photos, location evidence, and reviewer approvals.",
    "https://www.ycombinator.com/companies/autositu",
  ],
  [
    "Balance",
    "Mathias Løvring; Gus Levinson; Emil Munk",
    "https://getbalance.ai/",
    "founders@getbalance.ai",
    "UK/Denmark · W26 accounting product already interacts through Slack, WhatsApp, email, and web. Pitch a founder/SMB companion for receipt capture, issue alerts, month-close approvals, and cash snapshots.",
    "https://www.ycombinator.com/companies/getbalance",
  ],
  [
    "Menza",
    "Qasim Munye; Mariam Ahmed",
    "https://menza.ai/",
    "founders@menza.ai",
    "UK · Three-person W26 team with strong growth and a real-time analytics product for consumer brands. Mobile executive companion: anomaly alerts, approve/dismiss actions, KPI briefs, and conversational analysis.",
    "https://www.ycombinator.com/companies/menza",
  ],
  [
    "Lance",
    "Caleb Chan; Gavin Brennen; Gatik Trivedi",
    "https://www.lance.live/",
    "",
    "US · Hotel operations platform used across 50+ properties; workflows include calls, sales, and operations. Mobile opportunity for staff alerts, housekeeping/work orders, approvals, guest escalation, and shift handoff.",
    "https://www.ycombinator.com/companies/lance",
  ],
  [
    "VOYGR",
    "Vlad Baskakov; Yarik Markov",
    "https://voygr.tech/",
    "founders@voygr.tech",
    "US · Small W26 team building place-intelligence APIs for apps and agents. Pitch a React Native SDK, sample app, caching/offline patterns, maps UI, and customer integration packages.",
    "https://www.ycombinator.com/companies/voygr",
  ],
  [
    "Prana",
    "Meer Patel; Vishvam Rawal; Sanjit Menon",
    "https://pranadoc.com/",
    "",
    "US · Four-person W26 team; live beta positioned as an AI doctor “in your pocket,” connected to records and wearables. Strong case for native onboarding, HealthKit/wearables, notifications, secure chat, and timeline UX.",
    "https://www.ycombinator.com/companies/prana-health",
  ],
  [
    "Pelica",
    "Lalit Kundu; Catherine Zhao",
    "https://www.pelica.com/",
    "lalit@pelica.com",
    "US · Five-person care-operations startup serving provider field reps and care teams. Mobile could package visit preparation, member outreach, task queues, field notes, and time-sensitive care-gap alerts.",
    "https://www.ycombinator.com/companies/pelica",
  ],
  [
    "Glass Health",
    "Dereck Paul; William Hart",
    "https://glass.health/",
    "founders@glass.health",
    "US · Clinical AI company with a mobile application and API. Pitch targeted mobile support: clinician dictation, fast patient-context retrieval, app performance, secure workflows, and API-powered features.",
    "https://www.ycombinator.com/companies/glass-health",
  ],
  [
    "Decoda Health",
    "Daniyal Afzal; Kevin Cheng",
    "https://decodahealth.com/",
    "founders@decodahealth.com",
    "US · Fast-growing EMR/practice platform used by 150+ clinics. Mobile opportunities include patient intake, provider schedules, before/after photos, treatment notes, payments, inventory, and follow-up alerts.",
    "https://www.ycombinator.com/companies/decoda-health",
  ],
];

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Founder Prospects");
sheet.showGridLines = false;

sheet.getRange("A1:F1").merge();
sheet.getRange("A1").values = [
  ["Founder & Startup Mobile Prospects — Curated Batch 3"],
];
sheet.getRange("A2:F2").merge();
sheet.getRange("A2").values = [
  [
    "Named companies only · US, Europe, and selected global markets · Verified 2026-07-26 · These are outreach prospects, not claimed open jobs.",
  ],
];

const headers = [
  "Company",
  "Founder(s)",
  "Website URL",
  "Email (verified only)",
  "Prospecting note",
  "Research source",
];
sheet.getRange("A4:F4").values = [headers];
sheet.getRange(`A5:F${prospects.length + 4}`).values = prospects;

const table = sheet.tables.add(
  `A4:F${prospects.length + 4}`,
  true,
  "FounderProspectsTable",
);
table.style = "TableStyleMedium2";
table.showFilterButton = true;
table.showBandedRows = true;

sheet.getRange("A1:F1").format = {
  fill: "#12263A",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  verticalAlignment: "center",
};
sheet.getRange("A1:F1").format.rowHeight = 34;

sheet.getRange("A2:F2").format = {
  fill: "#E8F0F7",
  font: { color: "#334E68", italic: true, size: 10 },
  verticalAlignment: "center",
  wrapText: true,
};
sheet.getRange("A2:F2").format.rowHeight = 30;

sheet.getRange("A4:F4").format = {
  fill: "#167D8D",
  font: { bold: true, color: "#FFFFFF", size: 10 },
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D3E0E8" },
};
sheet.getRange("A4:F4").format.rowHeight = 30;

const dataRange = sheet.getRange(`A5:F${prospects.length + 4}`);
dataRange.format = {
  font: { color: "#243B53", size: 10 },
  verticalAlignment: "top",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D9E2EC" },
};
dataRange.format.rowHeight = 72;

sheet.getRange(`A5:A${prospects.length + 4}`).format.font = {
  bold: true,
  color: "#102A43",
};
sheet.getRange(`C5:D${prospects.length + 4}`).format.font = {
  color: "#126E82",
};
sheet.getRange(`F5:F${prospects.length + 4}`).format.font = {
  color: "#526D82",
  size: 9,
};

sheet.getRange("A:A").format.columnWidth = 20;
sheet.getRange("B:B").format.columnWidth = 38;
sheet.getRange("C:C").format.columnWidth = 32;
sheet.getRange("D:D").format.columnWidth = 34;
sheet.getRange("E:E").format.columnWidth = 78;
sheet.getRange("F:F").format.columnWidth = 43;

sheet.freezePanes.freezeRows(4);

const check = await workbook.inspect({
  kind: "table",
  range: `Founder Prospects!A1:F${prospects.length + 4}`,
  include: "values,formulas",
  tableMaxRows: 30,
  tableMaxCols: 8,
  maxChars: 16000,
});
console.log("WORKBOOK_CHECK");
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("ERROR_SCAN");
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Founder Prospects",
  range: `A1:F${prospects.length + 4}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

console.log(`WORKBOOK_PATH=${workbookPath}`);
console.log(`PREVIEW_PATH=${previewPath}`);
