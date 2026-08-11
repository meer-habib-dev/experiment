import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir =
  "/Users/meernabib/ProgrammingProjects/expo/experiment/outputs/founder-prospects-2026-07-26-batch4";
const outputPath = `${outputDir}/founder_prospects_batch_4.xlsx`;
const previewPath = `${outputDir}/preview.png`;

const rows = [
  [
    "Clair Health",
    "Jenny Duan; Abhinav Agarwal",
    "https://www.wearclair.com/",
    "careers@wearclair.com",
    "$11.6M seed. Wearable + mobile app; shipping planned for Nov 2026.",
    "https://techcrunch.com/2026/06/17/two-stanford-grads-raise-11m-to-build-a-noninvasive-wearable-for-hormone-tracking/",
  ],
  [
    "Kin Health",
    "Arpan Parikh; Amit Parikh; Kyle Alwyn",
    "https://www.meetkin.com/",
    "",
    "$9M seed. Patient-facing iPhone app; Android, health-data imports and app growth are clear angles.",
    "https://techcrunch.com/2026/05/18/kin-health-raises-9m-to-build-an-ai-notetaker-for-patients/",
  ],
  [
    "Savi Security",
    "Patrick Coughlin; Ryan Coughlin",
    "https://www.savisecurity.com/",
    "support@savisecurity.com",
    "$7M seed. Newly launched consumer security app on iOS and Android.",
    "https://techcrunch.com/2026/07/07/savis-app-aims-to-protect-consumers-from-realistic-ai-scams-like-kidnappers-demanding-ransom/",
  ],
  [
    "Zest Maps",
    "Mario Gomez-Hall; Alex Moller",
    "https://www.zestmaps.com/",
    "hi@mariohall.com",
    "$1.8M pre-seed. Public iPhone launch; no Android support found.",
    "https://techcrunch.com/2026/06/10/zest-launches-a-restaurant-discovery-app-powered-by-where-people-actually-eat/",
  ],
  [
    "Series",
    "Nathaneo Johnson; Sean Hargrow",
    "https://series.so/",
    "",
    "$5.1M pre-seed. Social product currently runs through iMessage; Android/native expansion angle.",
    "https://techcrunch.com/2026/04/24/two-college-kids-raise-a-5-1-million-pre-seed-to-build-an-ai-social-network-in-imessage/",
  ],
  [
    "Skye / Signull Labs",
    "Nirav Savjani",
    "https://skyeapp.ai/",
    "",
    "$3.58M+ pre-seed. Private-test iPhone home-screen app with a small team.",
    "https://techcrunch.com/2026/04/27/investors-back-skye-signull-labs-ai-home-screen-app-for-iphone-ahead-of-launch/",
  ],
  [
    "miros",
    "Fabio Zuliani; Neil Chennoufi",
    "https://miros.work/",
    "",
    "CHF1M pre-seed. Connected workpods with booking, payment and access mobile apps.",
    "https://tech.eu/2026/03/30/miros-raises-eur11m-to-bring-on-demand-workpods-to-public-spaces/",
  ],
  [
    "Flashka",
    "Stefan Djokovic; David Djokovic; Simone De Marchi",
    "https://www.flashka.ai/",
    "stefandjokovic@flashka.ai",
    "€1M pre-seed and 1M users. Mobile study app scaling across Europe.",
    "https://tech.eu/2026/01/12/tallinn-ai-startup-flashka-raises-eur1m-pre-seed-to-rethink-how-students-learn",
  ],
  [
    "myFirst",
    "G-Jay Yong",
    "https://myfirst.tech/",
    "marketing@myfirst.tech",
    "$8M+ Series A. Singapore kids wearables plus the myFirst Circle family app.",
    "https://www.vertexventures.sg/news/myfirst-raises-over-us-8-million-in-funding-led-by-vertex-ventures-southeast-asia-india-to-scale-kid-safe-technology-ecosystem/",
  ],
  [
    "injewelme",
    "James Moon",
    "https://www.injewelme.com/",
    "help@injewelme.com",
    "$1.2M funding. Singapore camera-based health monitoring for phones and tablets.",
    "https://www.mobihealthnews.com/news/asia/temasek-backed-startup-bags-1m-develop-contactless-health-monitoring",
  ],
  [
    "ThrowMeNot",
    "Artem Rudyuk",
    "https://throwmenot.ae/",
    "support@throwmenot.ae",
    "$550K pre-seed. UAE surplus-food marketplace; no native app found.",
    "https://www.wamda.com/index.php/2026/02/uae-startup-throwmenot-secures-550k-pre-seed",
  ],
  [
    "Maison Safqa",
    "Lea Mehaweg; Estelle Nasr; Georgia Mehaweg",
    "https://www.maisonsafqa.com/",
    "",
    "$620K pre-seed. Saudi/UAE flash-sale commerce platform; mobile-shopping opportunity.",
    "https://www.wamda.com/2026/04/backed-sanabil-500-maison-safqa-secures-620000-pre-seed",
  ],
  [
    "Lola",
    "Othman Janahi",
    "https://lola.do/",
    "",
    "$3M seed. GCC custom-cake ordering and delivery platform.",
    "https://www.wamda.com/en/2026/04/lola-closes-3-million-seed-scale-gcc",
  ],
  [
    "Gabster",
    "Ibrahim Ali",
    "https://www.gabster.ai/",
    "ibrahim@easyntec.com",
    "$500K pre-seed. Saudi multi-channel SaaS with an Android app and 4,400+ customers.",
    "https://www.wamda.com/2026/05/gabster-secures-500k-pre-seed-build-unified-ai-business-management-platform",
  ],
  [
    "Respond.io",
    "Gerardo Salandra; Iaroslav Kudritskiy; Hassan Ahmed",
    "https://respond.io/",
    "",
    "$62.5M Series B. Malaysia web/mobile messaging platform expanding teams and global markets.",
    "https://techcrunch.com/2026/06/15/malaysias-respond-io-raises-62-5m-eyes-acquisitions-in-north-america-and-europe/",
  ],
];

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Prospects");
sheet.showGridLines = false;

sheet.getRange("A1:F1").values = [[
  "Company",
  "Founder(s)",
  "Website",
  "Email",
  "Note",
  "Source",
]];
sheet.getRange(`A2:F${rows.length + 1}`).values = rows;

const table = sheet.tables.add(
  `A1:F${rows.length + 1}`,
  true,
  "ProspectsBatch4",
);
table.style = "TableStyleLight2";
table.showFilterButton = true;
table.showBandedRows = true;

sheet.getRange("A1:F1").format = {
  fill: "#D9EAF7",
  font: { bold: true, color: "#17324D" },
  wrapText: true,
};
sheet.getRange(`A2:F${rows.length + 1}`).format = {
  font: { color: "#222222", size: 10 },
  verticalAlignment: "top",
  wrapText: true,
};
sheet.getRange(`A2:A${rows.length + 1}`).format.font = { bold: true };

sheet.getRange("A:A").format.columnWidth = 20;
sheet.getRange("B:B").format.columnWidth = 36;
sheet.getRange("C:C").format.columnWidth = 30;
sheet.getRange("D:D").format.columnWidth = 31;
sheet.getRange("E:E").format.columnWidth = 56;
sheet.getRange("F:F").format.columnWidth = 45;
sheet.getRange(`A2:F${rows.length + 1}`).format.rowHeight = 43;
sheet.freezePanes.freezeRows(1);

const check = await workbook.inspect({
  kind: "table",
  range: `Prospects!A1:F${rows.length + 1}`,
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 6,
  maxChars: 12000,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Prospects",
  range: `A1:F${rows.length + 1}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
