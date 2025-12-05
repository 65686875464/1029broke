#!/usr/bin/env node
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function walk(dir, exts, cb) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '.git') continue;
      await walk(full, exts, cb);
    } else if (exts.includes(path.extname(ent.name).toLowerCase())) {
      await cb(full);
    }
  }
}

/**
 * Clone a git repo, perform simple text replacements, and optionally run npm install.
 *
 * opts: {
 *   repo: string (git url),
 *   dest: string (directory to create),
 *   replacements: object (key->value),
 *   install: boolean (default true)
 * }
 */
async function generateFromGit(opts) {
  if (!opts || !opts.repo || !opts.dest) throw new Error('repo and dest are required');
  const repo = opts.repo;
  const dest = path.resolve(opts.dest);
  const replacements = opts.replacements || {};
  const install = opts.install !== false;

  if (fs.existsSync(dest)) throw new Error('Destination already exists: ' + dest);

  console.log(`Cloning ${repo} → ${dest}`);
  execSync(`git clone --depth 1 ${repo} "${dest}"`, { stdio: 'inherit' });

  const exts = ['.json', '.md', '.tsx', '.ts', '.js', '.jsx', '.env', '.txt'];
  console.log('Applying replacements...');
  await walk(dest, exts, async (file) => {
    try {
      let txt = await fs.promises.readFile(file, 'utf8');
      let changed = false;
      for (const [k, v] of Object.entries(replacements)) {
        if (!k) continue;
        // mustache-style replacement first: {{KEY}} with optional spaces
        const mustacheKey = k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const mustache = new RegExp('{{\\s*' + mustacheKey + '\\s*}}', 'g');
        if (mustache.test(txt)) {
          txt = txt.replace(mustache, v);
          changed = true;
        }
        // then literal key replacement (exact match)
        const literal = new RegExp(k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g');
        if (literal.test(txt)) {
          txt = txt.replace(literal, v);
          changed = true;
        }
      }
      if (changed) await fs.promises.writeFile(file, txt, 'utf8');
    } catch (e) {
      // ignore binary / permission issues
    }
  });

  if (install) {
    const pkg = path.join(dest, 'package.json');
    if (fs.existsSync(pkg)) {
      console.log('Running npm install in', dest);
      const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install'], { cwd: dest, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('npm install failed');
    } else {
      console.log('No package.json found; skipping npm install');
    }
  }

  console.log('Template prepared at:', dest);
  return { dest };
}

if (require.main === module) {
  // Simple CLI
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    console.log('Usage: node tools/generate-from-git.js <git-repo> <dest-dir> [replacements.json] [--no-install]');
    process.exit(1);
  }
  const repo = argv[0];
  const dest = argv[1];
  const repFile = argv[2];
  const noInstall = argv.includes('--no-install');
  let replacements = {};
  if (repFile && !repFile.startsWith('--')) {
    try {
      replacements = JSON.parse(fs.readFileSync(repFile, 'utf8'));
    } catch (e) {
      console.error('Failed to read replacements JSON:', e.message);
      process.exit(2);
    }
  }

  generateFromGit({ repo, dest, replacements, install: !noInstall })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err && err.message ? err.message : err);
      process.exit(3);
    });
}

module.exports = { generateFromGit };
