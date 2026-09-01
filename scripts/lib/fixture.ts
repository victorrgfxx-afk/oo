import type { AuditResult } from "../../src/lib/types";

/**
 * Audit de proba, folosit cu `--fara-api`. Nu atinge deloc Claude - serveste
 * la verificarea randarii, a documentului si a fluxului, gratis.
 */
export const FIXTURE: AuditResult = {
  scor_general: 54,
  scoruri: {
    bio_si_pozitionare: 35,
    identitate_vizuala: 68,
    calitate_continut: 62,
    engagement_si_comunitate: 51,
    conversie: 28,
  },
  prima_impresie:
    "Un strain care intra pe profil intelege in cinci secunde ca faci ceva in zona de beauty, dar nu intelege ce anume si nici unde. Bio-ul spune \"pasiune pentru frumusete\", ceea ce nu il ajuta sa decida nimic.\n\nGrid-ul arata decent ca lumina si culoare, dar alterneaza rezultate cu postere facute in Canva, iar posterele rup ritmul vizual si trag ochiul catre partea cea mai slaba a contului.",
  puncte_forte: [
    "Lumina naturala consecventa in majoritatea pozelor cu rezultate - se vede ca filmezi in acelasi loc, la aceeasi ora.",
    "Ai deja un volum bun de before/after, materia prima pentru continut e acolo.",
    "Raspunzi la comentarii, ceea ce se vede in cele trei postari recente.",
  ],
  probleme: [
    {
      titlu: "Bio-ul nu spune ce faci si nici in ce oras",
      de_ce_conteaza:
        "Clientul de beauty e local si decide in cateva secunde. Fara serviciu si oras in bio si in numele afisat, nu apari in cautari si pierzi oameni care erau deja pregatiti sa se programeze.",
      cum_repari:
        "Schimba numele afisat in \"Prenume | Serviciu Oras\" si rescrie bio-ul dupa formula: ce faci, pentru cine, unde, o dovada, un CTA cu link.",
      prioritate: "mare",
    },
    {
      titlu: "Nu exista link de programare",
      de_ce_conteaza:
        "Singurul canal de booking e DM-ul. Seara si in weekend, cand oamenii chiar se uita pe Instagram, nu raspunde nimeni, si o parte din cereri se pierd definitiv.",
      cum_repari:
        "Pune un link de programare in bio, chiar si un formular simplu. Adauga-l si in primul comentariu la postarile cu rezultate.",
      prioritate: "mare",
    },
    {
      titlu: "Posterele din Canva rup grid-ul",
      de_ce_conteaza:
        "Sunt cele mai slabe vizual din tot contul si stau exact acolo unde se uita un vizitator nou. Trag in jos impresia despre restul muncii tale.",
      cum_repari:
        "Scoate-le din feed si muta anunturile in story. Pastreaza in grid doar rezultate, proces si fata ta.",
      prioritate: "medie",
    },
    {
      titlu: "Highlights fara nume clare",
      de_ce_conteaza:
        "Sunt patru highlights cu iconite si fara text. Nimeni nu deschide ce nu intelege, deci pierzi cel mai bun loc de a raspunde la obiectii inainte sa fie puse.",
      cum_repari:
        "Redenumeste-le: Preturi, Rezultate, Program, Intrebari. Patru cuvinte, nu iconite.",
      prioritate: "medie",
    },
    {
      titlu: "Nu apari nicaieri la fata",
      de_ce_conteaza:
        "In beauty, increderea in om inchide vanzarea, nu poza cu rezultatul. Un cont fara chip ramane un catalog.",
      cum_repari:
        "O postare pe saptamana in care vorbesti la camera 20 de secunde despre un lucru concret din munca ta.",
      prioritate: "mica",
    },
  ],
  copy: {
    nume_afisat: [
      { varianta: "Ana M. | Gene & sprancene Cluj", motiv: "Contine serviciul si orasul, deci apare in cautari locale." },
      { varianta: "Ana M. | Lash artist Cluj-Napoca", motiv: "Varianta pentru cine cauta direct termenul de specialitate." },
      { varianta: "Ana | Extensii gene Cluj, Zorilor", motiv: "Adauga si cartierul, util cand concurenta pe oras e mare." },
    ],
    bio: [
      { varianta: "Extensii gene 1:1 si volum rus | Cluj, Zorilor | +1.400 cliente din 2019 | Programari:", motiv: "Serviciu, loc, dovada si CTA, in limita de caractere." },
      { varianta: "Gene care tin 4 saptamani, fara sa iti strice naturalele | Cluj | Programari:", motiv: "Porneste de la obiectia reala, nu de la serviciu." },
      { varianta: "Lash artist certificat | Cluj, Zorilor | Luni-Sambata 9-19 | Rezerva-ti locul:", motiv: "Include programul, util cand primesti multe intrebari despre disponibilitate." },
    ],
    call_to_action: [
      "Scrie-mi \"GENE\" in DM si iti trimit locurile libere din saptamana asta.",
      "Programeaza-te din link - vezi direct ce ore sunt libere.",
      "Salveaza postarea daca vrei sa o ai la indemana cand te programezi.",
    ],
    highlights: ["Preturi", "Rezultate", "Program", "Intrebari frecvente", "Inainte / dupa"],
  },
  idei_continut: [
    { titlu: "De ce iti cad genele dupa doua saptamani", format: "Reel 15s", hook: "Daca iti cad genele in doua saptamani, nu e vina tehnicianei. E asta.", structura: ["Prim-plan pe o gena aplicata gresit", "Aceeasi zona, aplicare corecta", "Text pe ecran cu regula in trei cuvinte"], cta: "Salveaza pentru cand te programezi.", de_ce_functioneaza: "Raspunde la obiectia care opreste cele mai multe programari.", efort: "mic" },
    { titlu: "Aplicare, fara muzica", format: "Reel 12s", hook: "Fara muzica. Doar sunetul.", structura: ["Close-up pe penseta", "Aplicarea unei singure gene", "Cadru final cu ochiul deschis"], cta: "Comenteaza daca vrei si partea a doua.", de_ce_functioneaza: "Formatul satisfying tine oamenii pana la final, ceea ce creste distributia.", efort: "mic" },
    { titlu: "Clienta dupa trei ani de extensii", format: "Carusel 4 slide-uri", hook: "Trei ani de extensii, la rand. Uite cum arata naturalele ei acum.", structura: ["Slide 1: intrebarea", "Slide 2: poza naturalelor", "Slide 3: ce a facut diferit", "Slide 4: ce faci tu diferit"], cta: "Intreaba-ma orice in comentarii.", de_ce_functioneaza: "Demonteaza cea mai raspandita frica din nisa, cu dovada.", efort: "mediu" },
    { titlu: "Cat costa, de fapt", format: "Reel 20s", hook: "Hai sa iti spun sincer cat costa si de ce.", structura: ["Vorbesti la camera", "Text pe ecran cu cele trei componente ale pretului", "Final cu pretul afisat"], cta: "Preturile complete sunt in highlight-ul Preturi.", de_ce_functioneaza: "Pre-calificheaza clientii si scade intrebarile de tip \"cat costa?\" in DM.", efort: "mic" },
    { titlu: "Trei greseli cu care vii la mine", format: "Carusel 5 slide-uri", hook: "Trei lucruri pe care le faci acasa si imi strica mie treaba.", structura: ["Slide de titlu", "Cate un slide pe greseala", "Slide final cu ce sa faci in schimb"], cta: "Salveaza-l, o sa ai nevoie.", de_ce_functioneaza: "Caruselele educative se salveaza mult, iar salvarile cresc reach-ul.", efort: "mediu" },
    { titlu: "Ziua mea in salon", format: "Reel 30s", hook: "07:40. Prima clienta vine la 08:00.", structura: ["Pregatirea postului de lucru", "Doua-trei cadre din timpul zilei", "Ultimul client, seara"], cta: "Scrie-mi daca vrei un loc saptamana viitoare.", de_ce_functioneaza: "Pune fata pe brand si construieste increderea care inchide vanzarea.", efort: "mediu" },
    { titlu: "Am reparat asta in 40 de minute", format: "Reel 15s", hook: "A venit asa. Am avut 40 de minute.", structura: ["Before, lumina naturala", "Doua cadre din proces", "After, acelasi unghi si aceeasi lumina"], cta: "Trimite-mi o poza in DM si iti spun ce se poate face.", de_ce_functioneaza: "Transformarea e coloana vertebrala a nisei, iar unghiul identic o face credibila.", efort: "mic" },
    { titlu: "Ce inseamna 1:1, volum si mega volum", format: "Carusel 4 slide-uri", hook: "1:1, volum, mega volum. In romana, acum.", structura: ["Slide de titlu", "Cate un slide pe tip, cu poza reala", "Slide final: care ti se potriveste"], cta: "Nu stii care e a ta? Scrie-mi.", de_ce_functioneaza: "Elimina confuzia care blocheaza decizia de programare.", efort: "mediu" },
    { titlu: "Cele doua ore dintre clienti", format: "Story, serie de 4", hook: "Ce fac intre doua cliente si de ce dureaza atat.", structura: ["Dezinfectia postului", "Sterilizarea instrumentarului", "Pregatirea pentru urmatoarea"], cta: "Intreaba-ma orice cu stickerul de intrebari.", de_ce_functioneaza: "Igiena e o obiectie tacuta pe care putini o adreseaza explicit.", efort: "mic" },
    { titlu: "Mesajul pe care il primesc cel mai des", format: "Reel 12s", hook: "Primesc mesajul asta de zece ori pe saptamana.", structura: ["Screenshot al mesajului, anonimizat", "Raspunsul tau la camera", "Text final cu concluzia"], cta: "Ai aceeasi intrebare? Scrie-mi.", de_ce_functioneaza: "Continutul construit pe intrebari reale ajunge exact la cine le are.", efort: "mic" },
    { titlu: "Cum arata dupa patru saptamani", format: "Carusel 3 slide-uri", hook: "Ziua 1, ziua 14, ziua 28. Aceeasi clienta.", structura: ["Cate un slide pe etapa, acelasi unghi", "Ultimul slide: cand se face refill"], cta: "Refill-ul se face la 3-4 saptamani. Programeaza-te din link.", de_ce_functioneaza: "Raspunde la \"cat tine\", intrebarea care decide pretul perceput.", efort: "mediu" },
    { titlu: "Locuri libere joi", format: "Story", hook: "Mai am doua locuri joi.", structura: ["Poza cu un rezultat recent", "Text cu orele libere", "Sticker de link"], cta: "Apasa pe link si alege ora.", de_ce_functioneaza: "Urgenta reala, nu inventata, si merge direct la programare.", efort: "mic" },
  ],
  plan_30_zile: [
    { saptamana: 1, focus: "Reparam profilul, nu continutul", actiuni: ["Schimba numele afisat si bio-ul cu una dintre variantele propuse.", "Pune linkul de programare.", "Redenumeste cele patru highlights."] },
    { saptamana: 2, focus: "Curatam grid-ul si pornim transformarile", actiuni: ["Scoate posterele din feed.", "Posteaza doua before/after filmate din acelasi unghi.", "Un reel de proces, fara muzica."] },
    { saptamana: 3, focus: "Raspundem la obiectii", actiuni: ["Caruselul cu cele trei greseli.", "Reel-ul despre pret.", "Seria de story despre igiena."] },
    { saptamana: 4, focus: "Punem fata pe brand", actiuni: ["Un reel cu tine vorbind la camera.", "Ziua in salon.", "Story cu locurile libere, de doua ori in saptamana."] },
  ],
  intrebari_pentru_client: [
    "Care serviciu iti aduce cei mai multi bani si pe care ai vrea sa il vinzi mai des?",
    "Ai un sistem de programare online sau totul trece prin DM?",
    "Cate programari pe saptamana ai acum si cate ai vrea?",
    "Ai buget de reclama sau lucram doar organic?",
  ],
};
