// Relative (not "@/") so the seed/import scripts can import this file directly.

/**
 * Tamil → Latin ("Tanglish") transliteration.
 *
 *   கடலை பருப்பு  ->  Kadalai Paruppu
 *   துவரம் பருப்பு ->  Thuvaram Paruppu
 *   மிளகு         ->  Milagu
 *
 * This is a *fallback*, not the source of truth. Every item that came from
 * the spreadsheet carries a hand-written Tanglish name in
 * prisma/data/master-data.json; this exists so an item typed in later
 * (at the shop, in the master list) still gets a readable Latin name
 * without anyone having to invent one.
 *
 * Tanglish has no single agreed spelling, so the rules below aim for how
 * people actually write these words rather than a reversible scheme:
 *   - stops voice between vowels (கடலை is "kadalai", not "katalai")
 *   - doubled stops stay unvoiced (பருப்பு is "paruppu")
 *   - ழ is "zh", ற/ர are both "r", ண/ந/ன are all "n"
 * Anything that isn't a Tamil letter (Latin brand names, digits, "500g")
 * passes through untouched.
 */

const VIRAMA = "்";
const AYTHAM = "ஃ"; // ஃ

const VOWELS: Record<string, string> = {
  அ: "a",
  ஆ: "aa",
  இ: "i",
  ஈ: "ee",
  உ: "u",
  ஊ: "oo",
  எ: "e",
  ஏ: "e",
  ஐ: "ai",
  ஒ: "o",
  ஓ: "o",
  ஔ: "au",
};

const VOWEL_SIGNS: Record<string, string> = {
  "ா": "aa",
  "ி": "i",
  "ீ": "ee",
  "ு": "u",
  "ூ": "oo",
  "ெ": "e",
  "ே": "e",
  "ை": "ai",
  "ொ": "o",
  "ோ": "o",
  "ௌ": "au",
};

/** Base (word-initial / doubled) romanisation of each consonant. */
const CONSONANTS: Record<string, string> = {
  க: "k",
  ங: "ng",
  ச: "s",
  ஞ: "ny",
  ட: "t",
  ண: "n",
  த: "th",
  ந: "n",
  ன: "n",
  ப: "p",
  ம: "m",
  ய: "y",
  ர: "r",
  ற: "r",
  ல: "l",
  ள: "l",
  ழ: "zh",
  வ: "v",
  ஶ: "sh",
  ஷ: "sh",
  ஸ: "s",
  ஹ: "h",
  ஜ: "j",
};

/** How the six stops read once a vowel or nasal precedes them. */
const VOICED: Record<string, string> = {
  க: "g",
  ச: "s",
  ட: "d",
  த: "dh",
  ப: "b",
};

const NASALS = new Set(["ங", "ஞ", "ண", "ந", "ம", "ன"]);

/**
 * Doubled consonants that don't simply repeat their base form:
 * ச்ச reads "ch" (பச்சை -> pachai, not "passai") and ற்ற reads "tr"
 * (கற்று -> katru).
 */
const GEMINATES: Record<string, { pure: string; doubled: string }> = {
  ச: { pure: "", doubled: "ch" },
  ற: { pure: "t", doubled: "r" },
};

function isTamilLetter(ch: string): boolean {
  return ch in VOWELS || ch in CONSONANTS || ch === AYTHAM;
}

export function toTanglish(nameTa: string): string {
  const chars = [...nameTa];
  let out = "";

  // Voicing context: whether the previous letter left us on a vowel, and
  // which consonant (if any) was left hanging on a virama.
  let afterVowel = false;
  let pendingConsonant: string | null = null;
  let afterNasal = false;
  // Set when a preceding nasal changes how this consonant reads (ஞ்ச -> "nj").
  let forcedForm: string | null = null;

  for (let index = 0; index < chars.length; index++) {
    const ch = chars[index];

    if (ch in VOWELS) {
      out += VOWELS[ch];
      afterVowel = true;
      pendingConsonant = null;
      afterNasal = false;
      forcedForm = null;
      continue;
    }

    if (ch === AYTHAM) {
      out += "h";
      afterVowel = false;
      pendingConsonant = null;
      afterNasal = false;
      forcedForm = null;
      continue;
    }

    if (ch in CONSONANTS) {
      const next = chars[index + 1];
      const isPure = next === VIRAMA;
      const sign = next !== undefined && next in VOWEL_SIGNS ? VOWEL_SIGNS[next] : null;
      const doubled = pendingConsonant === ch;
      const geminate = GEMINATES[ch];

      if (isPure) {
        const following = chars[index + 2];
        // ங்க reads "ng", not "ngk"; ஞ்ச reads "nj", not "nysa".
        if (ch === "ங" && following === "க") {
          out += "n";
          forcedForm = null;
        } else if (ch === "ஞ" && following === "ச") {
          out += "n";
          forcedForm = "j";
        } else if (geminate && following === ch) {
          out += geminate.pure;
          forcedForm = null;
        } else {
          out += CONSONANTS[ch];
          forcedForm = null;
        }
        pendingConsonant = ch;
        afterNasal = NASALS.has(ch);
        afterVowel = false;
        index += 1; // consume the virama
        continue;
      }

      const body =
        forcedForm ??
        (doubled && geminate
          ? geminate.doubled
          : !doubled && (afterVowel || afterNasal) && ch in VOICED
            ? VOICED[ch]
            : CONSONANTS[ch]);

      out += body + (sign ?? "a");
      if (sign) index += 1; // consume the vowel sign
      pendingConsonant = null;
      afterNasal = false;
      afterVowel = true;
      forcedForm = null;
      continue;
    }

    // Latin text, digits, punctuation, spaces — kept verbatim.
    out += ch;
    afterVowel = false;
    pendingConsonant = null;
    afterNasal = false;
    forcedForm = null;
  }

  return capitalizeWords(out);
}

/** Title-cases the transliterated words, leaving pass-through text alone. */
function capitalizeWords(value: string): string {
  return value.replace(/(^|[\s(/-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return prefix + letter.toUpperCase();
  });
}

/** True when a name is written in Tamil script and so can be transliterated. */
export function hasTamilScript(value: string): boolean {
  return [...value].some(isTamilLetter);
}
