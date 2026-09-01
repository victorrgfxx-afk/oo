# Audit social media — agent + livrare la 48h

Landing page cu formular, un agent care analizează capturi de ecran ale profilului
și scrie auditul într-un Google Doc, un panou intern din care echipa editează și
aprobă, și livrare automată pe email la 48 de ore.

Lucrează pe patru nișe: **beauty & estetică, HoReCa, fitness & wellness, imobiliare**.

## Fluxul

```
Client completează formularul  (nișă, username, email, capturi)
        │
        ▼
/api/submit ──► creează folderul clientului în Drive + urcă capturile
             ──► scrie rândul în Google Sheets  (stare: queued)
             ──► email de confirmare + notificare internă
        │
        ▼
cron /api/cron/tick, din oră în oră
        │
        ├─ dispatch ─► citește capturile din Drive
        │              trimite în Claude Message Batches   (stare: processing)
        │
        ├─ collect  ─► ia rezultatele, scrie Google Doc-ul
        │              în folderul clientului              (stare: draft_ready)
        │              notifică echipa
        │
        └─ deliver  ─► trimite pe email ce e aprobat
                       și a împlinit fereastra de 48h      (stare: sent)
        │
        ▼
    Între collect și deliver intervine echipa:
    editează documentul, adaugă context, apoi apasă „Aproba" în /admin
```

Nimic nu pleacă automat către client. `deliver` trimite doar ce a fost aprobat
manual din panou.

## De ce capturi de ecran, nu link-uri

Instagram, TikTok și Facebook blochează accesul automat la profiluri. Capturile
ocolesc problema complet și sunt și mai fidele: modelul vede exact ce vede un om
care intră pe profil.

Capturile pot veni pe două căi, ambele funcționale în paralel:
- **clientul** le încarcă în formular (redimensionate în browser înainte de upload);
- **echipa** le pune direct în subfolderul `01-capturi` din Drive.

Un lead fără capturi rămâne în starea `asteapta capturi` și pornește singur la
următoarea rulare de cron, imediat ce apar fișiere în folder.

## Structura

```
src/
  app/
    page.tsx                    landing page + formular
    multumim/                   confirmare după trimitere
    admin/                      panoul intern (listă, aprobare, livrare)
    api/submit/                 primește formularul, creează folderul, scrie leadul
    api/cron/tick/              dispatch → collect → deliver
    api/admin/                  login și acțiuni din panou
  components/
    AuditForm.tsx               formularul (redimensionează capturile client-side)
  lib/
    audit.ts                    promptul, schema JSON, construirea batch-ului
    knowledge/*.ts              playbook-urile celor 4 nișe  ← aici se „antrenează"
    niches.ts                   configurarea nișelor
    pipeline.ts                 cele trei faze
    render.ts                   rezultatul modelului → blocuri de Google Doc
    google.ts                   Drive + Docs + Sheets (fetch, fără googleapis)
    store.ts                    persistență pe Google Sheets
    mail.ts                     Brevo + șabloanele de email
    format.ts, auth.ts, env.ts  utilitare
scripts/
  audit.ts                      agentul de test, pe capturi locale
  check-setup.ts                verifică Google, Sheets, Brevo, Anthropic
  google-login.ts               flux OAuth local → refresh token
  setup.ts                      provizionează Drive, foaia, playbook-urile
  fixtures/                     profil demo cu defecte plantate
```

## Ce conține auditul livrat

Scoruri pe cinci dimensiuni, prima impresie, ce merge deja bine, problemele
ordonate după prioritate (fiecare cu ce te costă și cum se repară), trei variante
de nume afișat și trei de bio scrise complet, CTA-uri și denumiri de highlights,
12 idei de conținut cu hook scris cuvânt cu cuvânt, un plan pe 30 de zile, și
întrebările la care echipa are nevoie de răspuns.

Documentul se generează cu o notă internă la început, pe care echipa o șterge
înainte de trimitere.

## Agentul de test

Rulează exact același prompt, aceeași schemă și aceeași randare ca producția, dar
pe capturi de pe disc și fără să atingă Drive, Sheets sau Brevo. Îl folosești ca
să vezi calitatea auditului înainte de a porni sistemul, și ca să reglezi
playbook-urile de nișă iterând rapid.

```bash
# audit real pe capturi de pe disc
npm run audit -- --nisa beauty --username ana_beauty --dir ./capturi

# doar randarea, fără să cheme Claude și fără să coste nimic
npm run audit -- --nisa horeca --username local --fara-api
```

Scrie două fișiere în `rezultate/`: `.md` (documentul exact cum ajunge în Google
Docs) și `.json` (răspunsul brut). În terminal afișează scorurile, problemele
majore, primele idei, un set de verificări automate (12 idei? 3 variante de bio?
încap în 150 de caractere?) și costul rulării.

Opțiuni: `--platforme instagram,tiktok`, `--note "ce a scris clientul"`,
`--nume`, `--site`, `--out <folder>`, `--fara-trimitere` (construiește cererea
reală și o inspectează — model, efort, schemă, ordinea blocurilor, mărimea
imaginilor — fără să o trimită).

### Material de test

`scripts/fixtures/capturi-demo/` conține trei capturi ale unui profil de
Instagram fictiv din nișa beauty, cu **defecte plantate intenționat**. Îl
folosești ca să verifici dacă agentul le găsește:

```bash
npm run audit -- --nisa beauty --username ana_beauty_official \
  --dir scripts/fixtures/capturi-demo
```

Defectele plantate (numele afișat fără serviciu și oraș, bio generic, lipsa
linkului, highlights doar cu emoji, trei postere Canva în grid, descrieri numai
din hashtag-uri, engagement mic) sunt listate de
`node scripts/fixtures/genereaza-demo.mjs`, care le și regenerează.

Atenție: e un profil sintetic. Validează fluxul și e util ca să compari
playbook-uri între ele, dar pozele sunt gradiente, nu fotografii reale — pentru
a judeca recomandările pe partea vizuală, folosește capturi de pe un cont
adevărat.

## Verificarea configurării

```bash
npm run check              # verifică tot, fără să lase urme
npm run check -- --email   # trimite și un email de test către TEAM_EMAIL
```

Cere un token Google, citește folderul-părinte, creează și șterge un folder și un
document de probă, pune antetul în foaia de calcul, încarcă playbook-urile și
atinge Anthropic cu o cerere minimă. Dacă trece tot, fluxul real funcționează.

## Instalare

```bash
npm install
npm run google-login    # obține credențialele Google, local
npm run setup           # creează folderul, foaia și playbook-urile în Drive
npm run check           # verifică tot, cu apeluri reale
```

`google-login` pornește un server local, te trimite în browser să aprobi, și
scrie refresh token-ul în `.env.local`. `setup` provizionează Drive-ul, generează
parolele care lipsesc și e idempotent — îl rulezi de câte ori vrei.

Detaliile, inclusiv partea care rămâne manuală (OAuth client în Google Cloud,
cheile Anthropic și Brevo, deploy-ul): [SETUP.md](SETUP.md).

## Dezvoltare locală

```bash
npm install
cp .env.example .env.local     # completează valorile
npm run dev
```

`npm run typecheck` verifică tipurile. `npm run build` face build-ul de producție.

Fără `BREVO_API_KEY`, emailurile sunt doar logate în consolă — restul fluxului merge.

## Note

- Modelul folosit e `claude-opus-5`, prin Message Batches API (50% din preț,
  potrivit pentru că livrarea e oricum la 48h).
- Promptul îi interzice explicit modelului să inventeze cifre pe care nu le vede
  în capturi; ce nu e vizibil e formulat ca ipoteză sau ajunge în lista de întrebări
  pentru client.
- Widget-ul mai vechi din repo a fost mutat în `public/legacy/`, neatins.
