import type { DocBlock } from "../../src/lib/google";

/**
 * Randeaza aceleasi blocuri care ajung in Google Docs, dar ca markdown, ca sa
 * poti citi rezultatul in terminal sau intr-un fisier, fara Drive.
 *
 * Foloseste exact iesirea lui `renderAudit`, deci ce vezi aici e ce ajunge in
 * document: daca lipseste ceva in preview, lipseste si in Doc.
 */
export function blocksToMarkdown(blocks: DocBlock[]): string {
  const out: string[] = [];
  let prevWasBullet = false;

  for (const block of blocks) {
    const isBullet = block.t === "bullet";
    if (!isBullet && prevWasBullet) out.push("");

    switch (block.t) {
      case "h1":
        out.push(`# ${block.text}`, "");
        break;
      case "h2":
        out.push("", `## ${block.text}`, "");
        break;
      case "h3":
        out.push("", `### ${block.text}`, "");
        break;
      case "bullet":
        out.push(`- ${block.text}`);
        break;
      default:
        out.push(block.bold ? `**${block.text}**` : block.text, "");
    }
    prevWasBullet = isBullet;
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
