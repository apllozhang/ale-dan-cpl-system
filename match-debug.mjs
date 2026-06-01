import mysql from 'mysql2/promise';

function n(model) {
  const t = model.trim();
  return { exact: t, lower: t.toLowerCase(), noSpace: t.replace(/\s/g, '') };
}

const conn = await mysql.createConnection('mysql://root:@localhost:3306/ale_cpl');

const [items] = await conn.execute('SELECT productModel FROM quotation_items WHERE quotationId = 1');
const [specs] = await conn.execute('SELECT setId, productModel FROM product_specs ORDER BY setId, productModel');

console.log('=== Quotation items ===');
for (const i of items) console.log(' ', i.productModel);

// Group specs by setId
const bySet = new Map();
for (const s of specs) {
  if (!bySet.has(s.setId)) bySet.set(s.setId, []);
  bySet.get(s.setId).push(s.productModel);
}

// For each set, match
const [sets] = await conn.execute('SELECT id, name FROM product_spec_sets ORDER BY id DESC');
for (const set of sets) {
  const entries = bySet.get(set.id) || [];
  if (entries.length === 0) continue;

  const l1 = new Map(), l2 = new Map(), l3 = new Map();
  for (const e of entries) {
    const nm = n(e);
    l1.set(nm.exact, e); l2.set(nm.lower, e); l3.set(nm.noSpace, e);
  }

  console.log('\n=== Set:', set.name, '(' + entries.length + ') ===');
  for (const e of entries) console.log('  entry:', e);

  for (const item of items) {
    const model = item.productModel;
    const nm = n(model);

    if (l1.has(nm.exact)) { console.log('  L1 HIT:', model, '->', l1.get(nm.exact)); continue; }
    if (l2.has(nm.lower)) { console.log('  L2 HIT:', model, '->', l2.get(nm.lower)); continue; }
    if (l3.has(nm.noSpace)) { console.log('  L3 HIT:', model, '->', l3.get(nm.noSpace)); continue; }

    let best = null, bl = 0;
    for (const e of entries) {
      const el = e.trim().toLowerCase();
      if (el.length >= 2 && nm.lower.startsWith(el) && el.length > bl) { best = e; bl = el.length; }
    }
    if (best) { console.log('  L4 HIT:', model, '->', best); continue; }

    best = null; bl = 0;
    for (const e of entries) {
      const el = e.trim().toLowerCase();
      if (nm.lower.length >= 2 && el.startsWith(nm.lower) && el.length > bl) { best = e; bl = el.length; }
    }
    if (best) { console.log('  L5 HIT:', model, '->', best); continue; }

    console.log('  MISS:', model);
  }
}

await conn.end();
process.exit(0);
