// Reads VidFast's own server menu (what a viewer sees on vidfast.vc) and updates
// data/vidfast-servers.json when VidFast adds or removes a server.
// Run by .github/workflows/vidfast-servers.yml every 6 hours. Nothing changes if the menu can't be read.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const FILE = 'data/vidfast-servers.json';
const PAGES = ['https://vidfast.vc/movie/603?autoPlay=false', 'https://vidfast.vc/tv/1399/1/1?autoPlay=false'];
const NAME_RE = /^[A-Za-z0-9 ._-]{2,24}$/;

const setOutput = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, key + '<<__EOF__\n' + value + '\n__EOF__\n');
};
const report = (text) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};

// In the page: a server row is a name + details pair whose row also holds the badge image and the star button.
const readRows = () => {
  const rows = [];
  document.querySelectorAll('div').forEach((d) => {
    if (d.children.length !== 2) return;
    const a = d.children[0];
    const b = d.children[1];
    if (a.children.length || b.children.length) return;
    const name = (a.textContent || '').trim();
    const details = (b.textContent || '').trim();
    const row = d.parentElement;
    if (!name || !row) return;
    const img = row.querySelector('img');
    if (!img || !row.querySelector('[role="button"]')) return;
    rows.push({ name, badge: img.src || '', details });
  });
  return rows;
};
// In the page: the server button sits in the player's top-left corner.
const openMenu = () => {
  const btn = [...document.querySelectorAll('button')].find((e) => {
    const r = e.getBoundingClientRect();
    return r.left < 80 && r.top < 80 && r.width > 20 && r.height > 20;
  });
  if (btn) btn.click();
  return !!btn;
};

const readPage = async (browser, url) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const end = Date.now() + 60000;
    while (Date.now() < end) {
      const first = await page.evaluate(readRows);
      if (first.length) {
        await page.waitForTimeout(2000); // let the whole list render
        const again = await page.evaluate(readRows);
        return { rows: again.length >= first.length ? again : first, note: '' };
      }
      await page.evaluate(openMenu);
      await page.waitForTimeout(2500);
    }
    const text = await page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 120).replace(/\s+/g, ' '));
    return { rows: [], note: (await page.title()) + ' | ' + text };
  } catch (e) {
    return { rows: [], note: String((e && e.message) || e).slice(0, 160) };
  } finally {
    await page.close();
  }
};

const main = async () => {
  const current = JSON.parse(readFileSync(FILE, 'utf8'));
  const browser = await chromium.launch();
  let found = [];
  const notes = [];
  try {
    for (const url of PAGES) {
      const r = await readPage(browser, url);
      notes.push(url + ': ' + (r.rows.length ? r.rows.length + ' servers' : 'no menu (' + r.note + ')'));
      if (r.rows.length) {
        found = r.rows;
        break;
      }
    }
  } finally {
    await browser.close();
  }

  const seen = new Set();
  const oldBadge = new Map(current.map((x) => [x.name, x.badge]));
  found = found
    .filter((x) => NAME_RE.test(x.name) && !seen.has(x.name) && seen.add(x.name))
    .map((x) => ({ name: x.name, badge: x.badge || oldBadge.get(x.name) || '', details: x.details }));

  if (found.length < 2) {
    report("Couldn't read VidFast's server menu, so the list was not changed.\n" + notes.join('\n'));
    setOutput('changed', 'false');
    process.exit(1);
  }

  const key = (list) => JSON.stringify(list.map((x) => [x.name, x.badge, x.details]));
  const names = found.map((x) => x.name).join(', ');
  if (key(found) === key(current)) {
    report('No change. VidFast servers: ' + names);
    setOutput('changed', 'false');
    return;
  }

  const before = new Set(current.map((x) => x.name));
  const after = new Set(found.map((x) => x.name));
  const added = found.filter((x) => !before.has(x.name)).map((x) => x.name);
  const removed = current.filter((x) => !after.has(x.name)).map((x) => x.name);
  const parts = [];
  if (added.length) parts.push('added ' + added.join(', '));
  if (removed.length) parts.push('removed ' + removed.join(', '));
  if (!parts.length) parts.push('details or order changed');

  writeFileSync(FILE, JSON.stringify(found, null, 2) + '\n');
  report('VidFast servers ' + parts.join('; ') + '. Now: ' + names);
  setOutput('changed', 'true');
  setOutput('summary', parts.join('; '));
  setOutput('list', names);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
