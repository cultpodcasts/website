#!/usr/bin/env node
/**
 * Merge preview / local origins into Auth0 staging SPA allowlists.
 *
 * Requires .env.staging (see .env.staging.example):
 *   AUTH0_MGMT_DOMAIN, AUTH0_MGMT_TOKEN, AUTH0_CLIENT_ID
 *
 * Usage:
 *   npm run auth0:sync-staging-urls
 *   npm run auth0:sync-staging-urls -- --dry-run
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.staging');
const dryRun = process.argv.includes('--dry-run');

/** URLs we always want on the staging SPA (no trailing slash). */
const REQUIRED = [
  'https://*.website-83e.pages.dev',
  'https://website-83e.pages.dev',
  'https://local.cultpodcasts.com:8788',
  'https://local.cultpodcasts.com:4200'
];

function loadEnv(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} — copy .env.staging.example and add AUTH0_MGMT_TOKEN`);
  }
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function mergeUrls(existing, required) {
  const set = new Set((existing ?? []).map((u) => u.replace(/\/$/, '')));
  for (const u of required) {
    set.add(u.replace(/\/$/, ''));
  }
  return [...set];
}

function sameSet(a, b) {
  const as = new Set(a);
  const bs = new Set(b);
  if (as.size !== bs.size) return false;
  for (const x of as) if (!bs.has(x)) return false;
  return true;
}

async function main() {
  const env = loadEnv(envPath);
  const domain = env.AUTH0_MGMT_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = env.AUTH0_MGMT_TOKEN;
  const clientId = env.AUTH0_CLIENT_ID;

  if (!domain || !token || !clientId) {
    throw new Error(
      'AUTH0_MGMT_DOMAIN, AUTH0_MGMT_TOKEN, and AUTH0_CLIENT_ID are required in .env.staging'
    );
  }

  const base = `https://${domain}/api/v2`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const getRes = await fetch(`${base}/clients/${encodeURIComponent(clientId)}`, {
    headers
  });
  if (!getRes.ok) {
    const body = await getRes.text();
    throw new Error(`GET client failed ${getRes.status}: ${body}`);
  }
  const client = await getRes.json();

  const next = {
    callbacks: mergeUrls(client.callbacks, REQUIRED),
    allowed_logout_urls: mergeUrls(client.allowed_logout_urls, REQUIRED),
    web_origins: mergeUrls(client.web_origins, REQUIRED),
    allowed_origins: mergeUrls(client.allowed_origins, REQUIRED)
  };

  const changed =
    !sameSet(client.callbacks ?? [], next.callbacks) ||
    !sameSet(client.allowed_logout_urls ?? [], next.allowed_logout_urls) ||
    !sameSet(client.web_origins ?? [], next.web_origins) ||
    !sameSet(client.allowed_origins ?? [], next.allowed_origins);

  console.log('Client:', client.name || clientId);
  console.log('Domain:', domain);
  console.log('\nRequired URLs merged into callbacks / logout / web_origins / allowed_origins:');
  for (const u of REQUIRED) console.log(' ', u);

  if (!changed) {
    console.log('\nAlready up to date — no PATCH needed.');
    return;
  }

  console.log('\nNew callbacks (%d):', next.callbacks.length);
  for (const u of next.callbacks) console.log(' ', u);

  if (dryRun) {
    console.log('\n--dry-run: skipping PATCH');
    return;
  }

  const patchRes = await fetch(`${base}/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(next)
  });
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`PATCH client failed ${patchRes.status}: ${body}`);
  }

  console.log('\nUpdated Auth0 application allowlists.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
