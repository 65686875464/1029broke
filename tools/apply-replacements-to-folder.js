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

async function apply(folder, replacements) {
  const exts = ['.json', '.md', '.tsx', '.ts', '.js', '.jsx', '.env', '.txt'];
  await walk(folder, exts, async (file) => {
    try {
      let txt = await fs.promises.readFile(file, 'utf8');
      let changed = false;
      for (const [k, v] of Object.entries(replacements)) {
        if (!k) continue;
        // replace mustache first
        const mustacheKey = k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const mustache = new RegExp('{{\\s*' + mustacheKey + '\\s*}}', 'g');
        if (mustache.test(txt)) {
          txt = txt.replace(mustache, v);
          changed = true;
        }
        // then literal
        const literal = new RegExp(k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g');
        if (literal.test(txt)) {
          txt = txt.replace(literal, v);
          changed = true;
        }
        // also remove any leftover braces around already-replaced values like {{MyApp}} -> MyApp
        const leftover = new RegExp('{{\\s*' + v.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*}}', 'g');
        if (leftover.test(txt)) {
          txt = txt.replace(leftover, v);
          changed = true;
        }
      }
      if (changed) await fs.promises.writeFile(file, txt, 'utf8');
    } catch (e) {
      // ignore
    }
  });
}

if (require.main === module) {
  const folder = process.argv[2];
  const replFile = process.argv[3];
  if (!folder || !replFile) {
    console.error('Usage: node tools/apply-replacements-to-folder.js <folder> <replacements.json>');
    process.exit(1);
  }
  const replacements = JSON.parse(fs.readFileSync(replFile,'utf8'));
  apply(folder, replacements).then(() => console.log('Applied replacements to', folder)).catch((e)=>{console.error(e);process.exit(2)});
}

module.exports = { apply };
