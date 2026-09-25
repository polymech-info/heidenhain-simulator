# Heidenhain sim

Host for native Klartext. The left list loads a few programs straight from `samples/common` (`/samples/…`). Drop any other `.h` on the view. The file is parsed, walked, and drawn as a toolpath. Cycle, probe, and FK specs are not expanded yet — they show up as gaps.

Built-in names live in `samples.json`. Dev serves `samples/common` at `/samples`. A production build copies those files into `dist/samples`. The longer entries are complete programs (`BEGIN PGM` … `END PGM`) with several tools, so each one runs on its own.

Z is up. Millimetres. An `INCH` program is scaled to mm for the view. The tool starts at the origin.

Play follows the path (rapids are faster). Step with the arrows or by clicking a block. Space plays and pauses.

```
npm run dev
```

## Pipeline

```
.h text
  → parseKlartext        blocks, heads, address words
  → runProgram           opcode table
  → trace                stock, path, notes, gaps
  → PathView             BLK FORM + toolpath
```

| File | Role |
| --- | --- |
| `src/lang/parse.ts` | Line numbers, `~` continuations, comments, words |
| `src/machine/registry.ts` | `registerOpcode` / `lookupOpcode` |
| `src/machine/handlers.ts` | Motion and machine-state builtins |
| `src/machine/specs/register.ts` | Where the next language specs plug in |
| `src/machine/run.ts` | Walks blocks until `M30` |

`CYCL DEF 200` is looked up before `CYCL DEF`. `FN 0` before `FN`. A bare `M5` uses the `M` handler.

## What runs

| Block | Effect |
| --- | --- |
| `BEGIN PGM` / `END PGM` / comments | Kept in the listing |
| `BLK FORM 0.1` / `0.2` | Stock box. Plane letter is stored (`Z` only for arcs) |
| `TOOL CALL n … S` | Tool and spindle speed |
| `L` | Absolute XYZ line. `FMAX` is rapid and not modal. `F` / `FQ` set feed |
| `CC` / `CP` | Circle center, then polar arc (`IPA`, `DR`, optional helical `Z`) |
| `FN 0: Qn = …` | Writes a Q register. `FQ50` reads it |
| `CYCL DEF` | Stores the cycle and its Q values. Does not cut |
| `M99` / `CYCL CALL` | Noted as not expanded |
| `M3` `M4` `M5` `M8` `M9` `M30` | Spindle, coolant, program stop |
| Anything else | Listed under **Not simulated** |

`R0` is the programmed path. `RL` / `RR` are not offset. `M140` does not retract. Rotary and parallel axes are ignored.

## Adding a spec

Create `src/machine/specs/cycle200.ts` and import it from `src/machine/specs/register.ts`.

```ts
import type { KlartextBlock } from "@/lang/types";
import type { Machine } from "@/machine/machine";
import { registerOpcode } from "@/machine/registry";

function expandDrill(machine: Machine, block: KlartextBlock) {
  // Q words are already on the block. Move the tool, then return.
}

registerOpcode("CYCL DEF 200", expandDrill);
```

The specific head replaces the generic `CYCL DEF` builtin for that number. Read Q values from `block.words` (`addr === "Q"`). Pose, feed, and the path are on `Machine` (`moveTo`, `push`). Leave unknown blocks unregistered — the runner already records the gap.
