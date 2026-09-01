# Instalare

Durează aproximativ 45 de minute prima dată. Parcurge pașii în ordine.

---

## 1. Cheia Anthropic

1. Intră pe [console.anthropic.com](https://console.anthropic.com) → **API Keys** → creează o cheie.
2. Pune-o în `ANTHROPIC_API_KEY`.
3. Adaugă credit pe cont. Vezi secțiunea **Costuri** de mai jos pentru ce înseamnă asta în bani.

---

## 2. Google Cloud: activarea API-urilor

1. [console.cloud.google.com](https://console.cloud.google.com) → creează un proiect (ex. `audit-social`).
2. **APIs & Services → Library** → activează, pe rând:
   - Google Drive API
   - Google Docs API
   - Google Sheets API

---

## 3. Google: autentificarea

Ai două variante. **Alege una singură.**

### Varianta A — service account (dacă ai Google Workspace)

Recomandată dacă lucrezi cu un **Shared Drive**. Un service account nu are spațiu
propriu în Drive, deci nu poate crea fișiere într-un „My Drive" obișnuit — de
aceea are nevoie de Shared Drive.

1. **IAM & Admin → Service Accounts** → creează unul.
2. La contul creat: **Keys → Add key → Create new key → JSON**. Se descarcă un fișier.
3. Pune conținutul întreg al fișierului în `GOOGLE_SERVICE_ACCOUNT_JSON`.
   Dacă interfața Vercel se împiedică de ghilimele și newline-uri, codifică-l base64
   (`base64 -w0 cheie.json`) și pune rezultatul — aplicația acceptă ambele forme.
4. În Drive, creează un **Shared Drive**, iar în el un folder (ex. `Audituri`).
5. Dă acces de **Content manager** la adresa service account-ului
   (`...@...iam.gserviceaccount.com`), atât pe Shared Drive cât și pe foaia de calcul.

### Varianta B — OAuth pe contul tău (dacă ai Gmail personal)

Aplicația scrie în Drive-ul tău, ca și cum ai crea tu fișierele. Fără Shared Drive.

1. **APIs & Services → OAuth consent screen** → tip **External** → completează
   datele minime → la **Scopes** adaugă `.../auth/drive`, `.../auth/documents`,
   `.../auth/spreadsheets` → adaugă-te ca **Test user**.
2. **Credentials → Create credentials → OAuth client ID** → tip **Web application** →
   la **Authorized redirect URIs** adaugă `https://developers.google.com/oauthplayground`.
3. Notează `Client ID` și `Client secret`.
4. Intră pe [OAuth Playground](https://developers.google.com/oauthplayground) →
   rotița din dreapta sus → bifează **Use your own OAuth credentials** → pune ID-ul și secretul.
5. În stânga, la **Step 1**, introdu manual cele trei scope-uri de mai sus →
   **Authorize APIs** → aprobă cu contul tău.
6. **Step 2 → Exchange authorization code for tokens** → copiază **Refresh token**.
7. Completează `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REFRESH_TOKEN` și lasă `GOOGLE_SERVICE_ACCOUNT_JSON` gol.

> Cât timp aplicația e în modul **Testing** pe consent screen, refresh token-ul expiră
> la 7 zile. Pentru producție, publică aplicația (**Publish app**). Fiind scope-uri
> sensibile, Google poate cere verificare; până atunci merge cu tine ca test user,
> reînnoind token-ul săptămânal.

---

## 4. Folderul din Drive și foaia de calcul

1. Creează în Drive folderul părinte (ex. `Audituri`). Deschide-l și ia ID-ul din URL:
   `drive.google.com/drive/folders/`**`ACESTA_E_ID-UL`** → `GOOGLE_DRIVE_PARENT_FOLDER_ID`.
2. Creează o foaie de calcul goală (ex. `Audituri - leaduri`). ID-ul e din URL:
   `docs.google.com/spreadsheets/d/`**`ACESTA_E_ID-UL`**`/edit` → `GOOGLE_SHEET_ID`.
3. Redenumește prima filă în `Leads` (sau schimbă `GOOGLE_SHEET_NAME`).
4. **Nu scrie nimic în ea** — aplicația își pune singură antetul la prima cerere.
5. Dacă folosești varianta A, dă acces de editor pe foaie service account-ului.

---

## 5. Brevo (emailuri)

1. [brevo.com](https://www.brevo.com) → cont → **SMTP & API → API Keys** → creează o cheie →
   `BREVO_API_KEY`.
2. **Senders** → adaugă și verifică adresa de expeditor → `MAIL_FROM_EMAIL`.
3. `MAIL_FROM_NAME` = numele care apare în inbox.
4. `TEAM_EMAIL` = unde vrei notificările interne (lead nou, draft gata, eroare).

> Livrabilitatea depinde de configurarea SPF și DKIM pe domeniul tău. Brevo îți dă
> înregistrările DNS exacte; fără ele, o parte din emailuri ajung în spam.

---

## 6. Deploy pe Vercel

1. Importă repo-ul în Vercel.
2. **Settings → Environment Variables** → adaugă tot ce e în `.env.example`.
3. Deploy.
4. `vercel.json` înregistrează deja cron-ul orar pe `/api/cron/tick`.

### Atenție la planul Hobby

Pe **Hobby**, Vercel permite un singur cron job și doar o rulare pe zi — prea rar
pentru o promisiune de 48 de ore. Ai două opțiuni:

- **Vercel Pro** — cron-ul orar din `vercel.json` funcționează ca atare.
- **Scheduler extern** (gratuit) — [cron-job.org](https://cron-job.org), Make sau n8n,
  configurat să apeleze din oră în oră:
  `https://domeniul-tau.ro/api/cron/tick?key=VALOAREA_DIN_CRON_SECRET`

Poți rula și o singură fază: `?phase=dispatch`, `?phase=collect`, `?phase=deliver`.

---

## 7. Verificare

Rulează întâi verificatorul automat — testează chiar apelurile reale și îți spune
exact ce nu merge:

```bash
npm run check              # Google, Drive, Docs, Sheets, playbook-uri, Anthropic
npm run check -- --email   # și un email de test către TEAM_EMAIL
```

Creează și șterge singur un folder și un document de probă, deci nu lasă urme.

Apoi vezi cum arată un audit real, fără să pornești tot sistemul — pune câteva
capturi într-un folder și rulează:

```bash
npm run audit -- --nisa beauty --username ana_beauty --dir ./capturi
```

În final, testul complet prin interfață:

1. Deschide `/admin`, intră cu `ADMIN_PASSWORD`. Trebuie să vezi tabelul gol.
2. Completează formularul de pe pagina principală cu adresa ta, cu 2-3 capturi.
3. În Drive apare imediat folderul `@username - Nișă - data` cu subfolderul `01-capturi`.
4. În `/admin`, apasă **Ruleaza pipeline-ul acum**. Starea trece în `se analizeaza`.
5. Batch-ul durează de obicei sub o oră. Mai apasă o dată; starea devine
   `draft de verificat` și apare linkul către document.
6. Editează documentul, apoi **Aproba** (pleacă la 48h) sau **Trimite acum**.

---

## Antrenarea agentului de conținut

Playbook-ul fiecărei nișe e ce citește modelul înainte să scrie ideile. Sunt două
moduri de a-l îmbunătăți:

**În cod** (permanent, versionat): editează
`src/lib/knowledge/beauty.ts`, `horeca.ts`, `fitness.ts`, `imobiliare.ts`.
E text simplu între backtick-uri. Cu cât pui mai multe exemple reale din piață —
hook-uri care au mers, greșeli pe care le vezi des, formate care performează —
cu atât ies ideile mai bune. Necesită deploy.

**Dintr-un Google Doc** (rapid, fără deploy): creează un Doc per nișă, pune ID-ul
în `KB_DOC_ID_BEAUTY` etc. Textul din Doc se adaugă la playbook-ul din cod la
fiecare rulare. Bun pentru completări între deploy-uri. Dacă Doc-ul e inaccesibil,
se folosește doar playbook-ul din cod — auditul nu se blochează.

---

## Costuri

Auditul rulează prin **Message Batches API**, la 50% din prețul standard, pentru că
oricum livrăm la 48 de ore.

Per client, cu 6 capturi: în jur de **0,08-0,12 USD**. La 100 de audituri pe lună,
aproximativ **8-12 USD**. Google Drive/Docs/Sheets sunt gratuite la acest volum,
iar Brevo are un plan gratuit de 300 de emailuri pe zi.

Ce influențează costul: numărul de capturi (`MAX_SCREENSHOTS`) și lungimea
playbook-urilor.
