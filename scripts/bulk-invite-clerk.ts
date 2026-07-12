#!/usr/bin/env bun
/**
 * Bulk-invite users to Clerk from a CSV file.
 *
 * CSV columns (header row required, any order): First Name, Last Name, Email
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_... bun scripts/bulk-invite-clerk.ts path/to/people.csv
 *   bun scripts/bulk-invite-clerk.ts path/to/people.csv --dry-run
 *
 * Requires CLERK_SECRET_KEY in the environment (see .env.example).
 */

import { createClerkClient } from "@clerk/backend";
import { readFile } from "node:fs/promises";

const DELAY_MS = 350; // stay comfortably under Clerk's rate limits

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--"));
  return { csvPath, dryRun };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.length > 0)) rows.push(row);
  }

  return rows;
}

interface Invitee {
  firstName: string;
  lastName: string;
  email: string;
  line: number;
}

function toInvitees(rows: string[][]): Invitee[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const firstIdx = header.findIndex((h) => h === "first name");
  const lastIdx = header.findIndex((h) => h === "last name");
  const emailIdx = header.findIndex((h) => h === "email");

  if (firstIdx === -1 || lastIdx === -1 || emailIdx === -1) {
    throw new Error(
      `CSV header must contain "First Name", "Last Name", and "Email" columns. Found: ${rows[0].join(", ")}`,
    );
  }

  const invitees: Invitee[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const email = (cols[emailIdx] ?? "").trim();
    if (!email) continue;
    invitees.push({
      firstName: (cols[firstIdx] ?? "").trim(),
      lastName: (cols[lastIdx] ?? "").trim(),
      email,
      line: i + 1,
    });
  }
  return invitees;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { csvPath, dryRun } = parseArgs(process.argv);

  if (!csvPath) {
    console.error("Usage: bun scripts/bulk-invite-clerk.ts <path-to-csv> [--dry-run]");
    process.exit(1);
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey && !dryRun) {
    console.error("Missing CLERK_SECRET_KEY environment variable.");
    process.exit(1);
  }

  const text = await readFile(csvPath, "utf-8");
  const invitees = toInvitees(parseCsv(text));

  if (invitees.length === 0) {
    console.log("No invitees found in CSV.");
    return;
  }

  console.log(`Found ${invitees.length} invitee(s) in ${csvPath}.${dryRun ? " (dry run, no invites will be sent)" : ""}`);

  const clerk = dryRun ? null : createClerkClient({ secretKey: secretKey! });

  const succeeded: string[] = [];
  const failed: { email: string; line: number; error: string }[] = [];

  for (const invitee of invitees) {
    const label = `line ${invitee.line}: ${invitee.email} (${invitee.firstName} ${invitee.lastName})`;

    if (dryRun) {
      console.log(`[dry-run] would invite ${label}`);
      succeeded.push(invitee.email);
      continue;
    }

    try {
      await clerk!.invitations.createInvitation({
        emailAddress: invitee.email,
        publicMetadata: {
          firstName: invitee.firstName,
          lastName: invitee.lastName,
        },
        notify: true,
        ignoreExisting: true,
      });
      console.log(`invited ${label}`);
      succeeded.push(invitee.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`failed ${label}: ${message}`);
      failed.push({ email: invitee.email, line: invitee.line, error: message });
    }

    await sleep(DELAY_MS);
  }

  console.log("\n--- Summary ---");
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`  line ${f.line} (${f.email}): ${f.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
