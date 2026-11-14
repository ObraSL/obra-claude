// Lista todos los textos que pasan por tr()/trN()/trJsx() y dice cuáles
// faltan en lib/i18n/uk.ts y lib/i18n/en.ts.
// Uso: node scripts/claves-i18n.js          → resumen de lo que falta
//      node scripts/claves-i18n.js --json   → todas las claves en JSON
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const archivos = [];
const recorrer = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (!["node_modules", ".next", "i18n"].includes(f.name)) recorrer(p);
    } else if (/\.(tsx?|ts)$/.test(f.name)) archivos.push(p);
  }
};
["app", "components", "lib"].forEach((d) => recorrer(path.join(raiz, d)));

const claves = new Set();
const literales = (n, out) => {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
  else if (ts.isObjectLiteralExpression(n)) return; // valores de los huecos
  ts.forEachChild(n, (c) => literales(c, out));
};

for (const f of archivos) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const nombre = n.expression.getText(sf);
      const args =
        nombre === "tr" || nombre === "trJsx" ? n.arguments.slice(0, 1) : nombre === "trN" ? n.arguments.slice(1, 3) : [];
      for (const a of args) {
        const out = [];
        literales(a, out);
        out.forEach((s) => s && claves.add(s));
      }
    }
    // Etiquetas de listas fijas que se pintan con tr(x.label) / tr(x.descripcion)
    if (ts.isPropertyAssignment(n) && /^(label|descripcion)$/.test(n.name.getText(sf)) && ts.isStringLiteral(n.initializer)) {
      claves.add(n.initializer.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// Listas que se traducen al pintarlas (tr(categoria), tr(ETIQUETA[estado]))
const tipos = fs.readFileSync(path.join(raiz, "lib/types.ts"), "utf8");
const cat = tipos.match(/CATEGORIAS_GASTO = \[([\s\S]*?)\] as const/);
if (cat) for (const m of cat[1].matchAll(/"([^"]+)"/g)) claves.add(m[1]);
const gantt = fs.readFileSync(path.join(raiz, "components/planificacion/Gantt.tsx"), "utf8");
const et = gantt.match(/const ETIQUETA[^{]*\{([\s\S]*?)\};/);
if (et) for (const m of et[1].matchAll(/:\s*"([^"]+)"/g)) claves.add(m[1]);
// Errores que devuelve el servidor en /api/alta y se traducen en pantalla
const pagos = ["app/api/alta/checkout/route.ts", "app/api/alta/codigo/route.ts"]
  .map((p) => fs.readFileSync(path.join(raiz, p), "utf8"))
  .join("\n");
for (const m of pagos.matchAll(/error: "([^"]+)"/g)) claves.add(m[1]);

const lista = [...claves].sort();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(lista, null, 1));
} else {
  const cargar = (idioma) => {
    const src = fs.readFileSync(path.join(raiz, `lib/i18n/${idioma}.ts`), "utf8");
    const sf = ts.createSourceFile("x.ts", src, ts.ScriptTarget.Latest, true);
    const hechas = new Set();
    const v = (n) => {
      if (ts.isPropertyAssignment(n)) hechas.add(n.name.text ?? n.name.getText(sf));
      ts.forEachChild(n, v);
    };
    v(sf);
    return hechas;
  };
  for (const idioma of ["uk", "en"]) {
    const hechas = cargar(idioma);
    const faltan = lista.filter((k) => !hechas.has(k));
    const sobran = [...hechas].filter((k) => !claves.has(k));
    console.log(`${idioma}: ${lista.length - faltan.length}/${lista.length} traducidas`);
    faltan.forEach((k) => console.log(`  FALTA  ${k}`));
    sobran.forEach((k) => console.log(`  SOBRA  ${k}`));
  }
}
