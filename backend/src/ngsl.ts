import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BAND_SIZE = 500;

export interface Word {
  rank: number;
  lemma: string;
  band: number;
}

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const officialPath = dataDir + "ngsl.csv";
const samplePath = dataDir + "ngsl-sample.csv";

export const source: "official" | "sample" = existsSync(officialPath) ? "official" : "sample";

function load(path: string): Word[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .slice(1) // header: rank,lemma
    .map((line) => line.split(","))
    .filter(([rank, lemma]) => rank && lemma)
    .map(([rank, lemma]) => {
      const r = Number(rank);
      return { rank: r, lemma: lemma.trim().toLowerCase(), band: Math.ceil(r / BAND_SIZE) };
    });
}

export const words: Word[] = load(source === "official" ? officialPath : samplePath);
export const wordByLemma = new Map(words.map((w) => [w.lemma, w]));

export const bands = Array.from({ length: Math.ceil(words.length / BAND_SIZE) }, (_, i) => ({
  band: i + 1,
  from: i * BAND_SIZE + 1,
  to: Math.min((i + 1) * BAND_SIZE, words.length),
}));

/** 너무 기본적이어서 회화 미션 목표로 부적합한 기능어(관사, 대명사, 조동사 등). */
const TRIVIAL = new Set(["the", "be", "and", "of", "to", "a", "in", "have", "it", "you", "he", "for", "they", "not", "that", "we", "on", "with", "this", "i", "do", "as", "at", "she", "but", "from", "by", "will", "or", "so", "if", "which", "there", "who", "what", "when", "where", "how", "than", "then", "into", "any", "some", "no", "can", "could", "would", "should", "may", "might", "my", "your", "his", "her", "its", "our", "their", "me", "him", "us", "them", "an", "all", "one"]);

export function isTargetable(lemma: string): boolean {
  return !TRIVIAL.has(lemma) && lemma.length > 2;
}

const IRREGULAR: Record<string, string[]> = {
  be: ["am", "is", "are", "was", "were", "been", "being", "'m", "'re", "'s"],
  have: ["has", "had", "having", "'ve", "'d"],
  do: ["does", "did", "done", "doing"],
  go: ["went", "gone", "goes"],
  get: ["got", "gotten"],
  make: ["made"],
  say: ["said", "says"],
  know: ["knew", "known"],
  take: ["took", "taken"],
  see: ["saw", "seen"],
  come: ["came"],
  think: ["thought"],
  give: ["gave", "given"],
  find: ["found"],
  tell: ["told"],
  feel: ["felt"],
  leave: ["left"],
  buy: ["bought"],
  bring: ["brought"],
  eat: ["ate", "eaten"],
  drink: ["drank", "drunk"],
  pay: ["paid"],
  meet: ["met"],
  keep: ["kept"],
  begin: ["began", "begun"],
  write: ["wrote", "written"],
  speak: ["spoke", "spoken"],
  sit: ["sat"],
  stand: ["stood"],
  run: ["ran"],
  put: ["put"],
  mean: ["meant"],
  spend: ["spent"],
  send: ["sent"],
  build: ["built"],
  hear: ["heard"],
  hold: ["held"],
  lose: ["lost"],
  sell: ["sold"],
  teach: ["taught"],
  understand: ["understood"],
  good: ["better", "best"],
  bad: ["worse", "worst"],
  child: ["children"],
  person: ["people"],
  man: ["men"],
  woman: ["women"],
};

/** 표제어(lemma)의 규칙/불규칙 활용형을 생성합니다. */
export function formsOf(lemma: string): string[] {
  const f = new Set([lemma, lemma + "s", lemma + "es", lemma + "ed", lemma + "d", lemma + "ing", lemma + "er", lemma + "est", lemma + "ly"]);
  if (lemma.endsWith("e")) f.add(lemma.slice(0, -1) + "ing");
  if (/[^aeiou]y$/.test(lemma)) {
    const stem = lemma.slice(0, -1);
    ["ies", "ied", "ier", "iest", "ily"].forEach((s) => f.add(stem + s));
  }
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(lemma)) {
    const last = lemma.at(-1);
    f.add(lemma + last + "ed");
    f.add(lemma + last + "ing");
  }
  IRREGULAR[lemma]?.forEach((x) => f.add(x));
  return [...f];
}

const formIndex = new Map<string, string>();
for (const w of [...words].reverse()) {
  // 빈도가 높은(순위가 앞선) 단어가 우선하도록 역순으로 채웁니다.
  for (const form of formsOf(w.lemma)) formIndex.set(form, w.lemma);
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

/** 발화 텍스트에서 사용된 NGSL 표제어 집합을 구합니다. */
export function lemmasIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const tok of tokenize(text)) {
    const lemma = formIndex.get(tok) ?? formIndex.get(tok.replace(/'[a-z]+$/, ""));
    if (lemma) out.add(lemma);
  }
  return out;
}
