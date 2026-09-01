/**
 * Genereaza un profil de Instagram demo, ca material de test pentru agent.
 *
 * Profilul are defecte plantate intentionat (vezi RASPUNSURI mai jos), ca sa
 * poti verifica daca agentul le gaseste. Nu e un profil real - foloseste-l ca
 * sa validezi fluxul si sa compari playbook-uri intre ele, nu ca sa judeci
 * calitatea recomandarilor pe fotografie reala.
 *
 *   node scripts/fixtures/genereaza-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.join(import.meta.dirname, "capturi-demo");
const CHROME = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

/** Defectele plantate, pentru verificare manuala dupa rulare. */
export const RASPUNSURI = [
  "Numele afisat (ana_beauty_official) nu contine serviciul si nici orasul",
  "Bio generic (\"pasiune pentru frumusete\"), fara serviciu, oras sau dovada",
  "Nu exista link de programare in bio",
  "Highlights doar cu emoji, fara text",
  "Trei postere facute in Canva rup grid-ul de rezultate",
  "Nicaieri nu apare fata proprietarei",
  "Descrieri formate doar din hashtag-uri",
  "Engagement foarte mic fata de numarul de urmaritori (12 aprecieri la 3.847)",
];

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 430px; background: #fff; color: #000;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px; -webkit-font-smoothing: antialiased;
  }
  .status { display: flex; justify-content: space-between; padding: 10px 18px 4px; font-size: 13px; font-weight: 600; }
  .navbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px 12px; }
  .navbar .handle { font-size: 17px; font-weight: 700; }
  .navbar .spacer { flex: 1; }
  .navbar .icon { font-size: 19px; color: #262626; }
  .head { display: flex; align-items: center; gap: 26px; padding: 4px 18px 14px; }
  .avatar {
    width: 86px; height: 86px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(150deg, #e8c9b8 0%, #d4a58c 45%, #b8836a 100%);
    border: 1px solid #dbdbdb;
  }
  .stats { display: flex; flex: 1; justify-content: space-around; text-align: center; }
  .stats b { display: block; font-size: 17px; font-weight: 700; }
  .stats span { font-size: 13px; color: #262626; }
  .bio { padding: 0 18px 14px; line-height: 1.42; }
  .bio .name { font-weight: 700; margin-bottom: 3px; }
  .bio .cat { color: #737373; margin-bottom: 3px; }
  .bio .link { color: #b0b0b0; font-size: 13.5px; margin-top: 4px; }
  .buttons { display: flex; gap: 6px; padding: 0 18px 18px; }
  .buttons div {
    flex: 1; text-align: center; padding: 7px 0; border-radius: 8px;
    background: #efefef; font-weight: 600; font-size: 14px;
  }
  .highlights { display: flex; gap: 18px; padding: 0 18px 18px; }
  .highlights .h { text-align: center; }
  .highlights .ring {
    width: 60px; height: 60px; border-radius: 50%; border: 1px solid #dbdbdb;
    display: flex; align-items: center; justify-content: center; font-size: 24px;
    background: #fafafa;
  }
  .highlights .lbl { font-size: 12px; margin-top: 5px; color: #262626; }
  .tabs { display: flex; border-top: 1px solid #dbdbdb; }
  .tabs div { flex: 1; text-align: center; padding: 11px 0; font-size: 19px; color: #b0b0b0; }
  .tabs div.on { color: #000; border-bottom: 1.5px solid #000; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; }
  .tile { aspect-ratio: 1; position: relative; overflow: hidden; }
  .tile .tag { position: absolute; top: 6px; right: 7px; color: #fff; font-size: 13px; opacity: .95; }

  /* Fotografii de rezultat: tonuri de piele si prim-planuri */
  .p1 { background: radial-gradient(circle at 38% 42%, #f2ded2 0%, #dcb69c 38%, #8a5f47 100%); }
  .p2 { background: linear-gradient(160deg, #f6e7dc 0%, #e0bda6 50%, #9c7259 100%); }
  .p3 { background: radial-gradient(circle at 60% 35%, #efd9cb 0%, #c99a7d 55%, #6f4a35 100%); }
  .p4 { background: linear-gradient(200deg, #f8ece4 0%, #d9b49b 55%, #a3765b 100%); }
  .p5 { background: radial-gradient(circle at 45% 55%, #f4e2d6 0%, #d1a88c 45%, #7d543e 100%); }
  .p6 { background: linear-gradient(140deg, #fbf1ea 0%, #e3c3ad 48%, #8f6349 100%); }

  /* Posterele din Canva: fond plat, text mare, alt registru vizual */
  .poster {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 10px; color: #fff; font-weight: 800; line-height: 1.15;
  }
  .poster small { font-weight: 600; font-size: 10px; opacity: .9; margin-top: 6px; letter-spacing: .04em; }
  .c1 { background: #d94f70; font-size: 21px; }
  .c2 { background: #6b4ea8; font-size: 19px; }
  .c3 { background: #2f8f7a; font-size: 20px; }

  /* Pagina de postare */
  .post-head { display: flex; align-items: center; gap: 11px; padding: 11px 14px; }
  .post-head .mini {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(150deg, #e8c9b8, #b8836a);
  }
  .post-head b { font-size: 14px; }
  .photo { width: 430px; height: 430px; }
  .acts { display: flex; gap: 14px; padding: 10px 14px 6px; font-size: 21px; }
  .acts .spacer { flex: 1; }
  .likes { padding: 0 14px 5px; font-weight: 600; }
  .caption { padding: 0 14px 5px; line-height: 1.42; }
  .caption b { font-weight: 600; }
  .tags { color: #00376b; }
  .meta { padding: 3px 14px 16px; color: #8e8e8e; font-size: 12px; }
`;

const page = (body) =>
  `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;

const statusBar = `<div class="status"><span>9:41</span><span>5G ▮▮▮</span></div>`;

const navbar = `<div class="navbar"><span class="handle">ana_beauty_official</span><span class="spacer"></span><span class="icon">☰</span></div>`;

const header = `
  <div class="head">
    <div class="avatar"></div>
    <div class="stats">
      <div><b>214</b><span>postări</span></div>
      <div><b>3.847</b><span>urmăritori</span></div>
      <div><b>1.203</b><span>urmăriți</span></div>
    </div>
  </div>
  <div class="bio">
    <div class="name">Ana</div>
    <div class="cat">Frumusețe, produse cosmetice și îngrijire personală</div>
    <div>✨ Pasiune pentru frumusețe ✨</div>
    <div>💕 DM pentru programări</div>
    <div>📍 Vino să ne cunoaștem</div>
    <div class="link">Adaugă link</div>
  </div>
  <div class="buttons"><div>Editează profilul</div><div>Distribuie profilul</div></div>
  <div class="highlights">
    <div class="h"><div class="ring">💅</div><div class="lbl">​</div></div>
    <div class="h"><div class="ring">✨</div><div class="lbl">​</div></div>
    <div class="h"><div class="ring">💕</div><div class="lbl">​</div></div>
    <div class="h"><div class="ring">🌸</div><div class="lbl">​</div></div>
  </div>
  <div class="tabs"><div class="on">▦</div><div>▷</div><div>◎</div></div>`;

const tiles = [
  `<div class="tile p1"></div>`,
  `<div class="tile poster c1">-20% LA<br>EXTENSII<br>GENE<small>OFERTĂ LIMITATĂ</small></div>`,
  `<div class="tile p2"><span class="tag">▶</span></div>`,
  `<div class="tile p3"></div>`,
  `<div class="tile p4"><span class="tag">▶</span></div>`,
  `<div class="tile poster c2">PROGRAMĂRI<br>DESCHISE<br>PENTRU MAI<small>SCRIE-NE ÎN DM</small></div>`,
  `<div class="tile p5"></div>`,
  `<div class="tile poster c3">LA MULȚI ANI<br>TUTUROR<br>MĂMICILOR!<small>8 MARTIE</small></div>`,
  `<div class="tile p6"></div>`,
];

/* ------------------------------ Cele trei capturi ----------------------------- */

// Inaltimea e fixata pe continut: altfel raman zone albe care nu spun nimic
// modelului si costa tokeni degeaba.
const capturi = {
  "01-profil": page(statusBar + navbar + header + `<div class="grid">${tiles.slice(0, 3).join("")}</div>`),
  "02-grid": page(statusBar + navbar + `<div class="grid">${tiles.join("")}</div>`),
  "03-postare": page(
    statusBar +
      `<div class="post-head"><div class="mini"></div><b>ana_beauty_official</b></div>` +
      `<div class="photo p3"></div>` +
      `<div class="acts"><span>♡</span><span>💬</span><span>➤</span><span class="spacer"></span><span>🔖</span></div>` +
      `<div class="likes">12 aprecieri</div>` +
      `<div class="caption"><b>ana_beauty_official</b> <span class="tags">#gene #extensiigene #lashes #beauty #frumusete #lashextensions #volumerus #genefrumoase #beautysalon #instabeauty #lashartist #genenaturale</span></div>` +
      `<div class="meta">ACUM 3 ZILE</div>`,
  ),
};

fs.mkdirSync(OUT, { recursive: true });

const INALTIMI = { "01-profil": 656, "02-grid": 512, "03-postare": 648 };

for (const [name, html] of Object.entries(capturi)) {
  const htmlPath = path.join(OUT, `${name}.html`);
  fs.writeFileSync(htmlPath, html);
  execFileSync(CHROME, [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=430,${INALTIMI[name]}`,
    `--screenshot=${path.join(OUT, `${name}.png`)}`,
    `file://${htmlPath}`,
  ], { stdio: "pipe" });
  fs.unlinkSync(htmlPath);
  const kb = (fs.statSync(path.join(OUT, `${name}.png`)).size / 1024).toFixed(0);
  console.log(`  ${name}.png  ${kb} KB`);
}

console.log(`\nCapturi in ${OUT}\n`);
console.log("Defecte plantate, de verificat in audit:");
RASPUNSURI.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
