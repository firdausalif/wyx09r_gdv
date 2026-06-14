#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const MENTION = "@everyone";
const UPDATE_COMMAND = "npm update -g wyxrouter";
const CHANGELOG_PATH = path.resolve("CHANGELOG.md");
const OUTPUT_PATH = path.resolve("discord-payload.json");

const FEATURE_KEYWORDS = ["feat", "feature", "new", "added", "add"];
const FIX_KEYWORDS = ["fix", "hotfix", "bug", "patch"];

function readSection(version) {
  const md = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const lines = md.split(/\r?\n/);
  const headerPattern = new RegExp(`^#\\s*v${escapeRegex(version)}(?:\\s|$|\\()`);
  const startIdx = lines.findIndex((l) => headerPattern.test(l));
  if (startIdx === -1) return null;
  const remainder = lines.slice(startIdx + 1);
  const stopIdx = remainder.findIndex((l) => /^#\s*v\d/.test(l) || /^#\s*Unreleased/i.test(l));
  const body = stopIdx === -1 ? remainder : remainder.slice(0, stopIdx);
  return body.join("\n").trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyHeading(headingText) {
  const lower = headingText.toLowerCase();
  if (/hotfix|bug ?fix|patch only/.test(lower)) return "FIX";
  if (/feature|new|added|added|introduce|support|selector|selection|engine|format|integration/.test(lower)) return "NEW";
  if (/improvement|enhancement|polish|refactor|chore|cleanup/.test(lower)) return "IMPROVEMENT";
  if (/fix/.test(lower)) return "FIX";
  return null;
}

function classifyByContent(bullets) {
  const text = bullets.join(" ").toLowerCase();
  const hasFix = /\b(fix|fixed|fixes|resolve|resolved|hotfix|bug)\b/.test(text);
  const hasFeature = /\b(add|added|adds|new|now\s+(accepts|supports|opens|launches)|introduces?|now\s+(actually|properly|finally))\b/.test(text);
  if (hasFeature && !hasFix) return "NEW";
  if (hasFix && !hasFeature) return "FIX";
  if (hasFeature && hasFix) return "NEW";
  return "IMPROVEMENT";
}

function parseSection(body) {
  const sections = [];
  const lines = body.split("\n");
  let currentHeading = null;
  let currentBullets = [];

  const flush = () => {
    if (currentBullets.length === 0) return;
    sections.push({ heading: currentHeading || "", bullets: currentBullets.slice() });
    currentBullets = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) {
      flush();
      currentHeading = line.replace(/^##\s+/, "").trim();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      currentBullets.push(line.replace(/^[-*]\s+/, "").trim());
    }
  }
  flush();
  return sections;
}

function rewriteBullet(text) {
  let out = text;
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  out = out.replace(/\(#\d+[^)]*\)/g, "");
  out = out.replace(/[\.;]\s*$/, "");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > 220) out = out.slice(0, 217) + "…";
  return out;
}

function bucketize(sections) {
  const buckets = { NEW: [], FIX: [], IMPROVEMENT: [] };
  for (const sec of sections) {
    if (sec.bullets.length === 0) continue;
    const typed = classifyHeading(sec.heading) || classifyByContent(sec.bullets);
    for (const bullet of sec.bullets) {
      buckets[typed].push(rewriteBullet(bullet));
    }
  }
  return buckets;
}

function determineUpdateType(version, buckets) {
  const segments = String(version).split(/[-+]/)[0].split(".").map((n) => Number.parseInt(n, 10));
  const [maj = 0, min = 0, patch = 0] = segments;
  const hasNew = buckets.NEW.length > 0;
  const hasFix = buckets.FIX.length > 0;
  if (maj > 0 && min === 0 && patch === 0) return "MAJOR UPDATE";
  if (patch === 0 && min > 0) return "FEATURE UPDATE";
  if (hasNew && hasFix) return "FEATURE UPDATE";
  if (hasNew) return "FEATURE UPDATE";
  if (hasFix) return "HOTFIX UPDATE";
  return "PATCH UPDATE";
}

function buildContent(version, buckets) {
  const type = determineUpdateType(version, buckets);
  const lines = [MENTION, `## ${type} v${version}`];
  if (buckets.NEW.length) {
    lines.push("[NEW]");
    for (const b of buckets.NEW) lines.push(`- ${b}`);
    lines.push("");
  }
  if (buckets.FIX.length) {
    lines.push("[FIX]");
    for (const b of buckets.FIX) lines.push(`- ${b}`);
    lines.push("");
  }
  if (buckets.IMPROVEMENT.length) {
    lines.push("[IMPROVEMENT]");
    for (const b of buckets.IMPROVEMENT) lines.push(`- ${b}`);
    lines.push("");
  }
  lines.push(`run \`\`\`${UPDATE_COMMAND}\`\`\``);
  return lines.join("\n");
}

function main() {
  const version = (process.argv[2] || "").trim();
  if (!version) {
    console.error("Usage: discord-announce.mjs <version>");
    process.exit(2);
  }

  const body = readSection(version);
  if (!body) {
    console.error(`No CHANGELOG section found for v${version}; writing minimal payload.`);
    const fallback = {
      content: `${MENTION}\n## RELEASE v${version}\nSee CHANGELOG.md for details.\n\nrun \`\`\`${UPDATE_COMMAND}\`\`\``,
      allowed_mentions: { parse: ["everyone"] },
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2));
    console.log(fallback.content);
    return;
  }

  const sections = parseSection(body);
  const buckets = bucketize(sections);

  if (!buckets.NEW.length && !buckets.FIX.length && !buckets.IMPROVEMENT.length) {
    const fallback = {
      content: `${MENTION}\n## RELEASE v${version}\nSee CHANGELOG.md for details.\n\nrun \`\`\`${UPDATE_COMMAND}\`\`\``,
      allowed_mentions: { parse: ["everyone"] },
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2));
    console.log(fallback.content);
    return;
  }

  const content = buildContent(version, buckets);
  const payload = {
    content,
    allowed_mentions: { parse: ["everyone"] },
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(content);
}

main();
