import type { Axis, KlartextBlock, KlartextProgram, Unit, Word } from "@/lang/types";

const PHRASES = [
  "BEGIN PGM",
  "END PGM",
  "BLK FORM",
  "TOOL CALL",
  "TOOL DEF",
  "CYCL DEF",
  "CYCL CALL",
  "TCH PROBE",
  "CALL LBL",
] as const;

const AXES = new Set<string>(["X", "Y", "Z", "A", "B", "C", "U", "V", "W"]);

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const RE_FQ = /^FQ(\d+)$/;
const RE_F = new RegExp(`^F(${NUM})$`);
const RE_AXIS = new RegExp(`^([XYZABCUVW])(${NUM})$`);
const RE_IPA = new RegExp(`^IPA(${NUM})$`);
const RE_S = new RegExp(`^S(${NUM})$`);
const RE_M = /^M(\d+)$/;
const RE_Q = new RegExp(`^Q(\\d+)=(${NUM}|MAX)$`);
const RE_MB = new RegExp(`^MB(?:MAX|(${NUM}))$`);
const RE_PLAIN = new RegExp(`^${NUM}$`);
const RE_RCOMP = /^R([0LR])$/;
const RE_R = new RegExp(`^R(${NUM})$`);
const RE_FN = /^FN\s+(\d+)\b\s*:?\s*/;
const RE_MISC = /^(M\d+)\b\s*/;
const RE_OP = /^([A-Z]{1,4})\b\s*/;
const RE_NUMBERED = /^(\d+)\s+([\s\S]*)$/;

function classify(token: string): Word | null {
  if (token === "FMAX") return { addr: "F", mode: "max" };
  if (token === "DR+") return { addr: "DR", sign: 1 };
  if (token === "DR-") return { addr: "DR", sign: -1 };

  let m = RE_FQ.exec(token);
  if (m) return { addr: "F", mode: "q", q: Number(m[1]) };

  m = RE_F.exec(token);
  if (m) return { addr: "F", mode: "mm", n: Number(m[1]) };

  m = RE_AXIS.exec(token);
  if (m && AXES.has(m[1])) return { addr: m[1] as Axis, n: Number(m[2]) };

  m = RE_IPA.exec(token);
  if (m) return { addr: "IPA", n: Number(m[1]) };

  m = RE_S.exec(token);
  if (m) return { addr: "S", n: Number(m[1]) };

  m = RE_M.exec(token);
  if (m) return { addr: "M", n: Number(m[1]) };

  m = RE_Q.exec(token);
  if (m) {
    if (m[2] === "MAX") return { addr: "Q", q: Number(m[1]), max: true };
    return { addr: "Q", q: Number(m[1]), n: Number(m[2]) };
  }

  m = RE_RCOMP.exec(token);
  if (m) return { addr: "R", comp: m[1] as "0" | "L" | "R" };

  m = RE_R.exec(token);
  if (m) return { addr: "R", n: Number(m[1]) };

  return null;
}

function splitWords(rest: string): { args: string[]; words: Word[] } {
  const tokens = rest.match(/\S+/g) ?? [];
  const args: string[] = [];
  const words: Word[] = [];
  let started = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const qSplit = /^Q(\d+)=$/.exec(token);
    const qValue = tokens[i + 1];
    if (qSplit && qValue === "MAX") {
      started = true;
      words.push({ addr: "Q", q: Number(qSplit[1]), max: true });
      i += 1;
      continue;
    }
    if (qSplit && qValue != null && RE_PLAIN.test(qValue)) {
      started = true;
      words.push({ addr: "Q", q: Number(qSplit[1]), n: Number(qValue) });
      i += 1;
      continue;
    }

    const qBare = /^Q(\d+)$/.exec(token);
    const eq = tokens[i + 1];
    if (qBare && eq?.startsWith("=")) {
      started = true;
      const raw = eq.slice(1);
      if (raw === "MAX") words.push({ addr: "Q", q: Number(qBare[1]), max: true });
      else {
        const n = Number(raw);
        words.push({ addr: "Q", q: Number(qBare[1]), n: Number.isFinite(n) ? n : 0 });
      }
      i += 1;
      continue;
    }

    const mbGlued = RE_MB.exec(token);
    if (mbGlued) {
      started = true;
      if (mbGlued[1] == null) words.push({ addr: "MB", max: true });
      else words.push({ addr: "MB", n: Number(mbGlued[1]) });
      continue;
    }
    if (token === "MB") {
      const mbNext = tokens[i + 1];
      if (mbNext === "MAX") {
        started = true;
        words.push({ addr: "MB", max: true });
        i += 1;
        continue;
      }
      if (mbNext != null && RE_PLAIN.test(mbNext)) {
        started = true;
        words.push({ addr: "MB", n: Number(mbNext) });
        i += 1;
        continue;
      }
    }
    const word = classify(token);
    if (word) {
      started = true;
      words.push(word);
      continue;
    }
    if (!started) args.push(token);
    else words.push({ addr: "raw", text: token });
  }

  return { args, words };
}

function tokenize(body: string): { head: string; args: string[]; words: Word[] } {
  const trimmed = body.trim();
  if (!trimmed) return { head: ";", args: [], words: [] };
  if (trimmed.startsWith(";")) return { head: ";", args: [], words: [] };
  if (trimmed.startsWith("*")) return { head: "*", args: [], words: [] };

  for (const phrase of PHRASES) {
    if (trimmed === phrase || trimmed.startsWith(`${phrase} `)) {
      return { head: phrase, ...splitWords(trimmed.slice(phrase.length).trim()) };
    }
  }

  const fn = RE_FN.exec(trimmed);
  if (fn) {
    const parsed = splitWords(trimmed.slice(fn[0].length).trim());
    return { head: "FN", args: [fn[1], ...parsed.args], words: parsed.words };
  }

  const misc = RE_MISC.exec(trimmed);
  if (misc) return { head: misc[1], ...splitWords(trimmed.slice(misc[0].length).trim()) };

  const op = RE_OP.exec(trimmed);
  if (op) return { head: op[1], ...splitWords(trimmed.slice(op[0].length).trim()) };

  const head = trimmed.split(/\s+/)[0] ?? ";";
  return { head, ...splitWords(trimmed.slice(head.length).trim()) };
}

type Peeled = {
  number: number | null;
  code: string;
  cont: boolean;
  display: string;
};

function peel(raw: string): Peeled {
  let s = raw.trim();
  let cont = false;
  if (s.endsWith("~")) {
    cont = true;
    s = s.slice(0, -1).trim();
  }
  const display = s;
  let number: number | null = null;
  const numbered = RE_NUMBERED.exec(s);
  if (numbered) {
    number = Number(numbered[1]);
    s = numbered[2];
  }
  const semi = s.indexOf(";");
  if (semi >= 0) s = s.slice(0, semi);
  return { number, code: s.trim(), cont, display };
}

type OpenBlock = {
  number: number | null;
  lines: string[];
  codes: string[];
  open: boolean;
};

function shown(line: Peeled, first: boolean): string {
  if (first && line.number != null) return line.display.replace(/^\d+\s+/, "");
  return line.display;
}

/**
 * Join `~` continuations and split each block into a head, args, and words.
 * Unknown opcodes are kept; they are not rejected.
 */
export function parseKlartext(source: string): KlartextProgram {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: KlartextBlock[] = [];
  let cur: OpenBlock | null = null;

  const flush = () => {
    if (!cur) return;
    const body = cur.codes.join(" ").replace(/\s+/g, " ").trim();
    const tok = tokenize(body);
    blocks.push({
      index: blocks.length,
      number: cur.number,
      lines: cur.lines,
      head: tok.head,
      args: tok.args,
      words: tok.words,
    });
    cur = null;
  };

  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const line = peel(raw);
    if (cur?.open) {
      cur.lines.push(line.display);
      if (line.code) cur.codes.push(line.code);
      cur.open = line.cont;
      if (!cur.open) flush();
      continue;
    }
    if (!line.code && !line.display) continue;
    cur = {
      number: line.number,
      lines: [shown(line, true)],
      codes: line.code ? [line.code] : [],
      open: line.cont,
    };
    if (!cur.open) flush();
  }
  if (cur?.open) flush();
  else if (cur) flush();

  let name: string | null = null;
  let unit: Unit | null = null;
  for (const block of blocks) {
    if (block.head !== "BEGIN PGM") continue;
    name = block.args[0] ?? null;
    const declared = block.args.find((arg) => arg === "MM" || arg === "INCH");
    if (declared === "MM" || declared === "INCH") unit = declared;
    break;
  }

  return { name, unit, blocks };
}
