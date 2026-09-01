# Instalare

Cea mai mare parte e automatizată. Drumul scurt, pe cont Google personal:

```bash
npm install
npm run google-login    # deschide browserul, aprobi, gata
npm run setup           # creează folderul, foaia, playbook-urile
npm run check           # verifică tot, cu apeluri reale
```

Rămâne de făcut de mână doar ce nu poate fi automatizat: un OAuth client în
Google Cloud, cheia Anthropic, cheia Brevo și deploy-ul. Sub 15 minute în total.

---

## 1. Cheia Anthropic

[console.anthropic.com](https://console.anthropic.com) → **API Keys** → creează o
cheie (`sk-ant-api03-...`) și adaugă credit pe cont.

Atenție: un abonament Claude.ai (Pro/Max) **nu** îți dă acces la API — sunt
facturate separat. Cheile de Admin (`sk-ant-admin...`) nu funcționează aici.

```bash
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." >> .env.local
```

Cu asta singură poți deja rula agentul pe capturi locale, fără nimic altceva:

```bash
npm run audit -- --nisa beauty --username ana_beauty_official \
  --dir scripts/fixtures/capturi-demo
```

Fă asta **înainte** de restul setup-ului. Dacă auditul nu te convinge, ai aflat
în două minute, nu după o oră de configurări.

---

## 2. Google Cloud

Singura parte care nu poate fi automatizată — necesită browserul tău.

1. [console.cloud.google.com](https://console.cloud.google.com) → creează un
   proiect (ex. `audit-social`).
2. **APIs & Services → Library** → activează: **Google Drive API**,
   **Google Docs API**, **Google Sheets API**.
3. **OAuth consent screen** → tip **External** → completează datele minime →
   adaugă-te ca **Test user**.
4. **Credentials → Create credentials → OAuth client ID** → tip
   **Web application** → la **Authorized redirect URIs** adaugă exact:

   ```
   http://127.0.0.1:53682/callback
   ```

5. Copiază **Client ID** și **Client secret**.

Apoi:

```bash
npm run google-login
```

Îți cere cele două valori, deschide fluxul de autorizare, și scrie singur
refresh token-ul în `.env.local`.

> Cât timp aplicația e în modul **Testing** pe consent screen, refresh token-ul
> expiră la 7 zile. Pentru producție apasă **Publish app**. Fiind scope-uri
> sensibile, Google poate cere verificare; până atunci rulezi `npm run google-login`
> din nou o dată pe săptămână.

---

## 3. Provizionarea

```bash
npm run setup
```

Creează în Drive-ul tău:

- folderul **Audituri - clienti** (aici apare câte un subfolder per client),
- foaia **Audituri - leaduri**, cu fila și antetul puse,
- folderul **Audituri - playbook-uri**, cu câte un Google Doc per nișă.

Scrie toate ID-urile în `.env.local` și generează `ADMIN_PASSWORD` și
`CRON_SECRET`. Rulează de câte ori vrei — găsește ce există deja și nu duplică.

---

## 4. Brevo

1. [brevo.com](https://www.brevo.com) → **SMTP & API → API Keys** → creează o
   cheie → `BREVO_API_KEY`.
2. **Senders, Domains & Dedicated IPs** → adaugă **domeniul tău** și pune
   înregistrările SPF și DKIM pe care ți le dă, în DNS-ul de la registrar.
3. `MAIL_FROM_EMAIL=audit@domeniul-tau.ro`, `MAIL_FROM_NAME=Numele agenției`,
   `TEAM_EMAIL=` unde vrei notificările interne.

> **Nu folosi o adresă @gmail.com ca expeditor.** Nu poți configura SPF și DKIM
> pentru gmail.com — nu e domeniul tău — deci mailurile nu trec alinierea DMARC
> și ajung frecvent în spam. Pentru un audit trimis unui client care nu te
> cunoaște încă, asta înseamnă că nici nu află că i-ai scris.

> Dacă `relay.enabled` e `false` pe cont, partea de transactional nu e activată.
> Verifică în Brevo la **Transactional → Email**.

Testul definitiv:

```bash
npm run check -- --email
```

---

## 5. Deploy pe Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → conectează contul
   de GitHub și importă repo-ul. (Dacă Vercel nu vede repo-ul, instalează
   aplicația Vercel pe contul de GitHub și dă-i acces.)
2. **Settings → Environment Variables** → copiază tot din `.env.local`.
3. Deploy.

Odată legat, fiecare push se deployează singur.

### Programarea rulărilor

`vercel.json` înregistrează un cron zilnic, fiindcă **planul Hobby permite doar
o rulare pe zi** — prea rar pentru o promisiune de 48 de ore.

Pe Hobby, pune un scheduler extern gratuit ([cron-job.org](https://cron-job.org),
Make sau n8n) care să apeleze din oră în oră:

```
https://domeniul-tau.ro/api/cron/tick?key=VALOAREA_DIN_CRON_SECRET
```

`npm run setup` îți afișează adresa completă, gata de copiat.

Pe **Vercel Pro**, schimbă în `vercel.json` programul în `0 * * * *` și nu-ți mai
trebuie nimic extern.

Se poate rula și o singură fază: `?phase=dispatch`, `?phase=collect`,
`?phase=deliver`.

---

## 6. Verificare finală

```bash
npm run check
```

Apoi testul complet prin interfață:

1. Deschide `/admin`, intră cu `ADMIN_PASSWORD`. Tabelul e gol.
2. Completează formularul cu adresa ta și 2-3 capturi.
3. În Drive apare folderul `@username - Nișă - data` cu subfolderul `01-capturi`.
4. În `/admin`, apasă **Ruleaza pipeline-ul acum**. Starea trece în
   `se analizeaza`.
5. Batch-ul durează de obicei sub o oră. Mai apasă o dată; starea devine
   `draft de verificat` și apare linkul către document.
6. Editează documentul, apoi **Aproba** (pleacă la 48h) sau **Trimite acum**.

---

## Antrenarea agentului de conținut

Playbook-ul fiecărei nișe e ce citește modelul înainte să scrie ideile.

**Dintr-un Google Doc** (rapid, fără deploy): `npm run setup` ți-a creat deja
câte unul per nișă, în folderul **Audituri - playbook-uri**. Tot ce scrii acolo
se adaugă la playbook-ul din cod, la fiecare rulare.

**În cod** (permanent, versionat): `src/lib/knowledge/beauty.ts`, `horeca.ts`,
`fitness.ts`, `imobiliare.ts`. Text simplu între backtick-uri.

Bucla de lucru: modifici playbook-ul, rulezi `npm run audit` pe aceleași capturi,
compari rezultatele. Durează un minut.

---

## Costuri

Auditul rulează prin **Message Batches API**, la 50% din prețul standard.

Per client, cu 6 capturi: estimativ **0,10-0,20 USD**. La 100 de audituri pe
lună, aproximativ **10-20 USD**. Google e gratuit la acest volum, iar Brevo are
un plan gratuit de 300 de emailuri pe zi (un audit consumă 3).

E o estimare, nu o măsurătoare. Partea greu de prezis e cât gândește modelul
înainte să răspundă — la efort `high` acei tokeni pot depăși răspunsul propriu-zis
și sunt facturați ca output. Pentru cifra ta reală, rulează o dată `npm run audit`;
îți afișează tokenii și costul, atât sincron cât și prin Batch.

Ce influențează costul, în ordinea impactului: cât gândește modelul (reglabil din
`output_config.effort` în `src/lib/audit.ts`), numărul de capturi
(`MAX_SCREENSHOTS`) și lungimea playbook-urilor.

---

## Anexă: service account în loc de OAuth

Dacă ai Google Workspace și preferi un service account:

1. **IAM & Admin → Service Accounts** → creează unul → **Keys → Add key → JSON**.
2. Pune conținutul fișierului în `GOOGLE_SERVICE_ACCOUNT_JSON` (sau același JSON
   codificat base64, dacă dashboard-ul strică newline-urile).
3. Un service account **nu are spațiu propriu în Drive**, deci fișierele trebuie
   create într-un **Shared Drive**. Creează acolo un folder, dă acces de
   **Content manager** adresei `...@...iam.gserviceaccount.com`, și pune ID-ul
   folderului în `GOOGLE_DRIVE_PARENT_FOLDER_ID`.
4. Dă acces și pe foaia de calcul, apoi rulează `npm run setup`.
