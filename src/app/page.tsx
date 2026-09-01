import AuditForm from "@/components/AuditForm";
import { deliveryDelayHours } from "@/lib/env";
import { NICHES } from "@/lib/niches";

export default function Home() {
  const hours = deliveryDelayHours();

  return (
    <main>
      <div className="wrap">
        <header className="masthead">
          <p className="eyebrow">Patru nise. Atat.</p>
          <h1 className="title">Iti spunem exact de ce profilul tau nu aduce clienti.</h1>
          <p className="lede">
            Ne trimiti username-ul, noi ne uitam la profil ca un social media manager platit sa o
            faca, si primesti pe mail in {hours} de ore un audit scris: ce pierzi acum, ce scrii in
            bio cuvant cu cuvant, si 12 idei de continut construite pentru nisa ta.
          </p>
        </header>

        <section>
          <h2 className="section-title">Ce primesti</h2>
          <div className="grid">
            <article className="card">
              <h3>Analiza profilului, punct cu punct</h3>
              <p>
                Prima impresie, identitate vizuala, bio, highlights, felul in care arata grid-ul.
                Fiecare problema vine cu ce te costa si cu pasii de reparat.
              </p>
            </article>
            <article className="card">
              <h3>Copy gata de copiat</h3>
              <p>
                Trei variante de nume afisat si trei de bio, scrise complet. Plus CTA-uri si
                denumiri pentru highlights. Le pui direct, nu le mai gandesti.
              </p>
            </article>
            <article className="card">
              <h3>12 idei de continut pe nisa ta</h3>
              <p>
                Fiecare cu formatul, hook-ul scris cuvant cu cuvant, cadrele pe rand si CTA-ul.
                Toate filmabile cu telefonul, fara echipa.
              </p>
            </article>
            <article className="card">
              <h3>Plan pe 30 de zile</h3>
              <p>
                Patru saptamani, fiecare cu un singur focus si actiuni concrete. Ordinea conteaza:
                intai ce aduce rezultat imediat.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2 className="section-title">Cum functioneaza</h2>
          <div className="grid">
            <article className="card">
              <span className="step-num">1</span>
              <h3>Completezi formularul</h3>
              <p>Nisa, username, email. Dureaza un minut.</p>
            </article>
            <article className="card">
              <span className="step-num">2</span>
              <h3>Ne uitam la profil</h3>
              <p>
                Analizam capturile profilului tau prin sistemul nostru, antrenat pe ce functioneaza
                in fiecare dintre cele patru nise.
              </p>
            </article>
            <article className="card">
              <span className="step-num">3</span>
              <h3>Trecem noi prin el</h3>
              <p>
                Niciun audit nu pleaca automat. Il citim, adaugam observatiile noastre si taiem ce
                nu e relevant pentru tine.
              </p>
            </article>
            <article className="card">
              <span className="step-num">4</span>
              <h3>Il primesti pe mail</h3>
              <p>In maximum {hours} de ore, ca document pe care il poti deschide si comenta.</p>
            </article>
          </div>
        </section>

        <section>
          <h2 className="section-title">Nisele cu care lucram</h2>
          <div className="grid">
            {NICHES.map((niche) => (
              <article className="card" key={niche.id}>
                <h3>{niche.label}</h3>
                <p>{niche.examples}</p>
              </article>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 16 }}>
            Lucram doar pe aceste patru nise pentru ca acolo stim exact ce functioneaza. Un audit
            generic nu ajuta pe nimeni.
          </p>
        </section>

        <section id="formular">
          <h2 className="section-title">Cere auditul</h2>
          <AuditForm
            niches={NICHES.map((n) => ({ id: n.id, label: n.label, hint: n.hint }))}
          />
        </section>

        <footer className="foot">
          <p>
            Auditul se face pe baza informatiilor publice de pe profil si a capturilor primite. Nu
            avem acces la statisticile tale interne si nu iti cerem parola sau acces la cont.
          </p>
        </footer>
      </div>
    </main>
  );
}
