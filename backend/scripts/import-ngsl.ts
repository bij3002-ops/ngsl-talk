/**
 * 공식 NGSL 단어 목록을 앱 형식(data/ngsl.csv: rank,lemma)으로 변환합니다.
 *
 * 1) https://www.newgeneralservicelist.com/ 에서 NGSL 목록(CSV)을 직접 내려받습니다. (라이선스: CC BY-SA 4.0)
 * 2) npm run import:ngsl -w backend -- <내려받은 파일 경로>
 *
 * 첫 번째 열을 표제어로 읽고, 파일에 적힌 순서(빈도순)를 순위로 사용합니다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("사용법: npm run import:ngsl -w backend -- <NGSL CSV 경로>");
  process.exit(1);
}

const seen = new Set<string>();
for (const line of readFileSync(input, "utf8").split(/\r?\n/)) {
  const lemma = line.split(/[,\t;]/)[0]?.replace(/^﻿|"/g, "").trim().toLowerCase();
  if (lemma && /^[a-z][a-z'-]*$/.test(lemma) && lemma !== "lemma" && lemma !== "word") seen.add(lemma);
}

const out = fileURLToPath(new URL("../data/ngsl.csv", import.meta.url));
writeFileSync(out, "rank,lemma\n" + [...seen].map((w, i) => `${i + 1},${w}`).join("\n") + "\n");
console.log(`${seen.size}개 단어를 ${out}에 저장했습니다. 서버를 다시 시작하세요.`);
