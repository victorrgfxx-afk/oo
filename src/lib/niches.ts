import type { NicheId } from "./types";
import { BEAUTY_PLAYBOOK } from "./knowledge/beauty";
import { HORECA_PLAYBOOK } from "./knowledge/horeca";
import { FITNESS_PLAYBOOK } from "./knowledge/fitness";
import { IMOBILIARE_PLAYBOOK } from "./knowledge/imobiliare";

export interface Niche {
  id: NicheId;
  label: string;
  /** Text scurt afisat sub caseta din formular. */
  hint: string;
  /** Exemple de tipuri de business, pentru landing page. */
  examples: string;
  playbook: string;
  /**
   * Numele variabilei de mediu care poate contine ID-ul unui Google Doc cu
   * completari la playbook. Daca e setata, textul din Doc se adauga la
   * playbook-ul de mai sus - asa "antrenam" agentul fara deploy.
   */
  kbDocEnv: string;
}

export const NICHES: Niche[] = [
  {
    id: "beauty",
    label: "Beauty & estetica",
    hint: "Salon, cosmetica, unghii, gene, clinica estetica",
    examples: "saloane, nail tech, lash artists, clinici estetice",
    playbook: BEAUTY_PLAYBOOK,
    kbDocEnv: "KB_DOC_ID_BEAUTY",
  },
  {
    id: "horeca",
    label: "HoReCa",
    hint: "Restaurant, cafenea, bar, cofetarie, pizzerie",
    examples: "restaurante, cafenele, baruri, cofetarii",
    playbook: HORECA_PLAYBOOK,
    kbDocEnv: "KB_DOC_ID_HORECA",
  },
  {
    id: "fitness",
    label: "Fitness & wellness",
    hint: "Sala, antrenor personal, nutritie, yoga, pilates",
    examples: "sali, antrenori, nutritionisti, studiouri",
    playbook: FITNESS_PLAYBOOK,
    kbDocEnv: "KB_DOC_ID_FITNESS",
  },
  {
    id: "imobiliare",
    label: "Imobiliare",
    hint: "Agent sau agentie imobiliara",
    examples: "agenti independenti, agentii, dezvoltatori mici",
    playbook: IMOBILIARE_PLAYBOOK,
    kbDocEnv: "KB_DOC_ID_IMOBILIARE",
  },
];

export const NICHE_IDS = NICHES.map((n) => n.id) as [NicheId, ...NicheId[]];

export function getNiche(id: string): Niche | undefined {
  return NICHES.find((n) => n.id === id);
}

export function nicheLabel(id: string): string {
  return getNiche(id)?.label ?? id;
}
