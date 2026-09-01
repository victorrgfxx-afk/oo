/**
 * Obtine un refresh token Google, local, fara OAuth Playground.
 *
 *   npm run google-login
 *
 * Porneste un server pe 127.0.0.1, iti da un link, tu aprobi in browser, iar
 * scriptul scrie GOOGLE_OAUTH_REFRESH_TOKEN in .env.local. Inlocuieste toata
 * secventa manuala din Playground, unde scope-urile se introduc de mana si se
 * greseste usor.
 *
 * Singurul lucru pe care tot tu il faci: creezi un OAuth client ID in Google
 * Cloud Console (tip "Web application") si adaugi ca redirect URI exact
 * http://127.0.0.1:53682/callback
 */
import http from "node:http";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadEnvFiles } from "./lib/env-file";
import { readEnvFile, updateEnvFile } from "./lib/env-write";
import { c } from "./lib/cli";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
];

function pagina(titlu: string, mesaj: string, culoare: string): string {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${titlu}</title></head>
<body style="margin:0;display:grid;place-items:center;height:100vh;font-family:system-ui,sans-serif;background:#faf9f7;color:#1c1917">
<div style="text-align:center;max-width:420px;padding:32px">
<div style="font-size:44px;color:${culoare};margin-bottom:12px">${culoare === "#2f6f4e" ? "✓" : "✕"}</div>
<h1 style="font-size:21px;margin:0 0 10px">${titlu}</h1>
<p style="color:#6f675e;line-height:1.55;margin:0">${mesaj}</p>
</div></body></html>`;
}

/** Asteapta un singur callback OAuth si intoarce codul. */
function asteaptaCodul(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      if (code) {
        res.end(pagina("Gata", "Poti inchide fila si te intorci in terminal.", "#2f6f4e"));
      } else {
        res.end(pagina("Nu a mers", error ?? "Autorizarea a fost anulata.", "#b4232b"));
      }

      server.close();
      if (code) resolve(code);
      else reject(new Error(error ?? "Autorizare anulata."));
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      reject(
        err.code === "EADDRINUSE"
          ? new Error(`Portul ${PORT} e ocupat. Inchide ce ruleaza pe el si reia.`)
          : err,
      );
    });

    server.listen(PORT, "127.0.0.1");
    setTimeout(() => {
      server.close();
      reject(new Error("Nu am primit raspuns in 5 minute."));
    }, 300_000).unref();
  });
}

async function main() {
  loadEnvFiles();
  const existing = readEnvFile();

  console.log(`\n${c.bold("Autentificare Google")}\n`);

  let clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? existing.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
  let clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? existing.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";

  if (!clientId || !clientSecret) {
    console.log("Ai nevoie de un OAuth client ID din Google Cloud Console:");
    console.log(c.dim("  1. console.cloud.google.com -> APIs & Services -> Credentials"));
    console.log(c.dim("  2. Create credentials -> OAuth client ID -> Web application"));
    console.log(c.dim(`  3. Authorized redirect URIs -> adauga exact:  ${REDIRECT}`));
    console.log(c.dim("  4. Copiaza Client ID si Client secret\n"));

    const rl = readline.createInterface({ input: stdin, output: stdout });
    if (!clientId) clientId = (await rl.question("Client ID:     ")).trim();
    if (!clientSecret) clientSecret = (await rl.question("Client secret: ")).trim();
    rl.close();
    console.log("");
  }

  if (!clientId || !clientSecret) {
    console.error(c.red("Fara client ID si secret nu pot continua.\n"));
    process.exit(1);
  }

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      // Fara asta, Google nu retrimite refresh token la a doua autorizare.
      prompt: "consent",
    });

  console.log("Deschide linkul asta in browser si aproba accesul:\n");
  console.log(`  ${authUrl}\n`);
  console.log(c.dim(`Astept pe ${REDIRECT} ...`));

  const code = await asteaptaCodul();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    console.error(`\n${c.red("Schimbul de token a esuat:")} ${res.status} ${await res.text()}\n`);
    process.exit(1);
  }

  const tokens = (await res.json()) as { refresh_token?: string };
  if (!tokens.refresh_token) {
    console.error(
      `\n${c.red("Google nu a trimis refresh token.")} Revoca accesul aplicatiei la\n` +
        "myaccount.google.com/permissions si reia - se intampla cand contul a mai\n" +
        "autorizat aplicatia inainte.\n",
    );
    process.exit(1);
  }

  updateEnvFile({
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_REFRESH_TOKEN: tokens.refresh_token,
  });

  console.log(`\n${c.green("Gata.")} Am scris credentialele in .env.local\n`);
  console.log(`Urmatorul pas:  ${c.bold("npm run setup")}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red("A picat:")} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
