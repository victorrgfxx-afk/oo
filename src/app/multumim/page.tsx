import Link from "next/link";
import { deliveryDelayHours } from "@/lib/env";

export const metadata = { title: "Am primit cererea ta" };

export default function ThankYou() {
  const hours = deliveryDelayHours();
  return (
    <main className="wrap">
      <header className="masthead">
        <p className="eyebrow">Gata</p>
        <h1 className="title">Am primit cererea ta.</h1>
        <p className="lede">
          Ti-am trimis un email de confirmare. Auditul ajunge la tine in maximum {hours} de ore -
          il scriem, il verificam de mana si abia apoi pleaca.
        </p>
      </header>

      <section>
        <div className="card">
          <h3>Vrei un audit mai precis?</h3>
          <p>
            Raspunde la emailul de confirmare cu 3-6 capturi de ecran ale profilului: grid-ul
            intreg, bio-ul si cateva postari recente. Cu cat vedem mai mult, cu atat sunt mai
            concrete recomandarile.
          </p>
        </div>
      </section>

      <footer className="foot">
        <Link href="/">Inapoi la pagina principala</Link>
      </footer>
    </main>
  );
}
