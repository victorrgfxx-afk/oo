"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface NicheOption {
  id: string;
  label: string;
  hint: string;
}

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
];

const MAX_FILES = 8;
const MAX_DIMENSION = 1600;

interface Prepared {
  file: File;
  preview: string;
}

/**
 * Redimensioneaza captura in browser inainte de upload.
 *
 * Doua motive: request-urile catre functiile serverless au limita de marime,
 * si oricum modelul reduce imaginile la ~1568px, deci peste atat platim
 * transfer degeaba.
 */
async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_200_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "captura";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    // Daca browserul nu poate procesa imaginea, o trimitem asa cum e.
    return file;
  }
}

export default function AuditForm({ niches }: { niches: NicheOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Prepared[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;
    setError(null);
    const prepared: Prepared[] = [];
    for (const file of picked.slice(0, MAX_FILES)) {
      const small = await downscale(file);
      prepared.push({ file: small, preview: URL.createObjectURL(small) });
    }
    setShots((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return prepared;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      const form = new FormData(event.currentTarget);
      // Inlocuim fisierele originale cu variantele redimensionate.
      form.delete("screenshots");
      for (const shot of shots) form.append("screenshots", shot.file, shot.file.name);

      const res = await fetch("/api/submit", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Ceva n-a mers. Incearca din nou.");
      }
      router.push("/multumim");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ceva n-a mers.");
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="form-shell" onSubmit={onSubmit} noValidate>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}

      <fieldset>
        <legend>Care e nisa ta?</legend>
        <p className="hint">Deocamdata lucram doar cu aceste patru nise.</p>
        <div className="niches">
          {niches.map((niche, i) => (
            <label className="choice" key={niche.id}>
              <input type="radio" name="niche" value={niche.id} required defaultChecked={i === 0} />
              <span className="choice-label">{niche.label}</span>
              <span className="choice-hint">{niche.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Unde esti prezent?</legend>
        <p className="hint">Alege una sau mai multe.</p>
        <div className="chips">
          {PLATFORMS.map((platform, i) => (
            <label className="chip" key={platform.id}>
              <input
                type="checkbox"
                name="platforms"
                value={platform.id}
                defaultChecked={i === 0}
              />
              {platform.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Datele tale</legend>

        <div className="two-col">
          <div className="field">
            <label htmlFor="username">Username-ul contului</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              placeholder="@numele_tau"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="tu@exemplu.ro"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="two-col">
          <div className="field">
            <label htmlFor="name">
              Nume <span className="optional">(optional)</span>
            </label>
            <input id="name" name="name" type="text" autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="website">
              Site <span className="optional">(optional)</span>
            </label>
            <input id="website" name="website" type="text" placeholder="exemplu.ro" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="notes">
            Ce te blocheaza acum? <span className="optional">(optional, dar ajuta mult)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            placeholder="Ex: postez de doi ani, am 3.000 de urmaritori, dar nu imi vine nicio programare din Instagram."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>
          Capturi de ecran <span className="optional">(optional)</span>
        </legend>
        <p className="hint">
          Ideal 3-6 capturi: profilul intreg cu grid-ul, bio-ul si cateva postari recente. Daca nu
          le trimiti, le facem noi - dar cu ele auditul e mai precis.
        </p>

        <div
          className="dropzone"
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
        >
          <strong>{shots.length > 0 ? `${shots.length} capturi alese` : "Alege capturile"}</strong>
          <span>JPG, PNG sau WEBP. Maximum 8.</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          name="screenshots"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={onFiles}
        />

        {shots.length > 0 && (
          <div className="thumbs">
            {shots.map((shot) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={shot.preview} className="thumb" src={shot.preview} alt="" />
            ))}
          </div>
        )}
      </fieldset>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company">Companie</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="field">
        <label className="consent">
          <input type="checkbox" name="consent" value="da" required />
          <span>
            Sunt de acord sa imi analizati profilul public si sa imi trimiteti auditul pe email.
            Nu folosim adresa in alt scop si o poti cere stearsa oricand.
          </span>
        </label>
      </div>

      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Se trimite..." : "Vreau auditul"}
      </button>
    </form>
  );
}
