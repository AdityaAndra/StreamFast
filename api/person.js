// Extra person facts + awards from Wikidata (free, CC0).
// GET /api/person?wd=Q38111 -> { awards: [{ a, y, f, won }], facts: { birthName, nickname, height, citizenship, education, spouses, children, occupations } }

const WD_RE = /^Q\d+$/;
const ENDPOINT = 'https://query.wikidata.org/sparql?format=json&query=';
const UA = 'VidFast/1.0 (https://streamfast.vercel.app)';

const sparql = async (q) => {
  const r = await fetch(ENDPOINT + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  if (!r.ok) throw new Error(`Wikidata ${r.status}`);
  return (await r.json()).results.bindings;
};

const label = (b, name) => {
  const v = b[name];
  const l = b[`${name}Label`];
  if (v && v.type === 'literal') return v.value;
  return l ? l.value : v ? v.value : undefined;
};
const isQid = (s) => /^Q\d+$/.test(s || '');
const year = (t) => (t ? String(t).slice(0, 4).replace(/^\+/, '') : undefined);

export default async function handler(req, res) {
  const wd = String((req.query && req.query.wd) || '');
  if (!WD_RE.test(wd)) {
    res.status(400).json({ error: 'Invalid Wikidata id' });
    return;
  }

  const awardsQ = `SELECT ?award ?awardLabel ?time ?for ?forLabel ?kind WHERE {
    { wd:${wd} p:P166 ?s . ?s ps:P166 ?award . BIND("won" AS ?kind) } UNION
    { wd:${wd} p:P1411 ?s . ?s ps:P1411 ?award . BIND("nom" AS ?kind) }
    OPTIONAL { ?s pq:P585 ?time } OPTIONAL { ?s pq:P1686 ?for }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 600`;

  const factsQ = `SELECT ?k ?val ?valLabel ?start ?end ?amt ?unit WHERE {
    { wd:${wd} wdt:P1477 ?val . BIND("birthName" AS ?k) } UNION
    { wd:${wd} wdt:P1449 ?val . BIND("nickname" AS ?k) } UNION
    { wd:${wd} wdt:P27 ?val . BIND("citizenship" AS ?k) } UNION
    { wd:${wd} wdt:P69 ?val . BIND("education" AS ?k) } UNION
    { wd:${wd} p:P26 ?st . ?st ps:P26 ?val . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } BIND("spouse" AS ?k) } UNION
    { wd:${wd} wdt:P1971 ?val . BIND("children" AS ?k) } UNION
    { wd:${wd} wdt:P106 ?val . BIND("occupation" AS ?k) } UNION
    { wd:${wd} p:P2048/psv:P2048 ?hv . ?hv wikibase:quantityAmount ?amt ; wikibase:quantityUnit ?unit . BIND("height" AS ?k) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 300`;

  try {
    const [aRows, fRows] = await Promise.all([sparql(awardsQ), sparql(factsQ).catch(() => [])]);

    const seen = new Set();
    const awards = [];
    for (const b of aRows) {
      const a = label(b, 'award');
      if (!a || isQid(a)) continue;
      const y = year(b.time && b.time.value);
      const f = label(b, 'for');
      const won = b.kind.value === 'won';
      const key = `${a}|${y || ''}|${f || ''}|${won}`;
      if (seen.has(key)) continue;
      seen.add(key);
      awards.push({ a, y, f: f && !isQid(f) ? f : undefined, won });
    }

    const facts = { citizenship: [], education: [], spouses: [], occupations: [] };
    const add = (list, v) => v && !isQid(v) && !list.includes(v) && list.push(v);
    for (const b of fRows) {
      const k = b.k.value;
      const v = label(b, 'val');
      if (k === 'birthName' && !facts.birthName) facts.birthName = v;
      else if (k === 'nickname' && !facts.nickname) facts.nickname = v;
      else if (k === 'citizenship') add(facts.citizenship, v);
      else if (k === 'education') add(facts.education, v);
      else if (k === 'occupation') add(facts.occupations, v);
      else if (k === 'children' && !facts.children) facts.children = Number(v) || undefined;
      else if (k === 'spouse' && v && !isQid(v) && !facts.spouses.some((s) => s.name === v)) {
        facts.spouses.push({ name: v, from: year(b.start && b.start.value), to: year(b.end && b.end.value) });
      } else if (k === 'height' && !facts.heightCm && b.amt) {
        const amt = Number(b.amt.value);
        const unit = b.unit ? b.unit.value : '';
        const cm = /Q11573$/.test(unit) ? amt * 100 : /Q174728$/.test(unit) ? amt : /Q3710$/.test(unit) ? amt * 30.48 : /Q218593$/.test(unit) ? amt * 2.54 : null;
        if (cm && cm > 90 && cm < 260) facts.heightCm = Math.round(cm);
      }
    }
    facts.occupations = facts.occupations.slice(0, 8);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    res.status(200).json({ awards, facts });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Wikidata.' });
  }
}
