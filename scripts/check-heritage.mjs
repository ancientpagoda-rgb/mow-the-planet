import { repositoryHeritage, heritageRules } from "../heritage/repositories.js";

const expected = [
  "predictorjesus-site",
  "backup-hardening-landing",
  "borg-backup-kit",
  "virtual-plant",
  "world-at-a-glance",
  "universe-dashboard",
  "cosmic-clock",
  "brain-wiring-atlas",
  "planetary-signal",
  "reality-engine",
  "ancientpagoda-rgb.github.io",
  "reality-sandbox",
  "reality-forest-3d",
  "extinct",
  "reality-sandbox-extinct",
  "world-timeline-sim",
  "-",
  "world",
  "earth-in-universe",
  "universe",
  "marchwarden",
  "epic-evolution-sim",
  "cosmic-ecology-sandbox",
  "mow-the-planet",
  "earth-777",
  "lego-sim"
];

const allowedStatuses = new Set([
  "empty",
  "archive",
  "tooling",
  "library",
  "hub",
  "core-candidate",
  "current-core"
]);

const failures = [];
const names = repositoryHeritage.map((entry) => entry.repo);
const uniqueNames = new Set(names);

if (repositoryHeritage.length !== expected.length) {
  failures.push(`expected ${expected.length} repository entries, found ${repositoryHeritage.length}`);
}

if (uniqueNames.size !== names.length) {
  failures.push("repository heritage contains duplicate repo names");
}

for (const repo of expected) {
  if (!uniqueNames.has(repo)) failures.push(`missing repository: ${repo}`);
}

for (const repo of names) {
  if (!expected.includes(repo)) failures.push(`unexpected repository: ${repo}`);
}

for (const entry of repositoryHeritage) {
  if (!allowedStatuses.has(entry.status)) failures.push(`${entry.repo}: invalid status ${entry.status}`);
  if (!Array.isArray(entry.keep)) failures.push(`${entry.repo}: keep must be an array`);
  if (!entry.note || typeof entry.note !== "string") failures.push(`${entry.repo}: note is required`);
  if (entry.status === "empty" && entry.keep.length !== 0) failures.push(`${entry.repo}: empty repositories must not claim harvested capabilities`);
  if (entry.status !== "empty" && entry.keep.length === 0) failures.push(`${entry.repo}: non-empty repository needs at least one retained capability`);
}

for (const [rule, text] of Object.entries(heritageRules)) {
  if (!text || typeof text !== "string") failures.push(`heritage rule ${rule} is empty`);
}

if (failures.length) {
  console.error("Repository heritage audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const retained = repositoryHeritage.filter((entry) => entry.keep.length > 0);
const empty = repositoryHeritage.filter((entry) => entry.status === "empty");
const candidates = repositoryHeritage.filter((entry) => entry.status === "core-candidate");

console.log(`Heritage audit OK: ${repositoryHeritage.length} repositories accounted for.`);
console.log(`${retained.length} contain retained capabilities; ${empty.length} are empty/placeholders; ${candidates.length} are core integration candidates.`);
