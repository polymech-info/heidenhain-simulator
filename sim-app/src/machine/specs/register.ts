/**
 * Language specs register here and override a builtin with the same head.
 *
 *   import "@/machine/cycles/drilling_cycles";
 *
 * A cycle file calls `registerCycle`. Call-active cycles run from `M99` and `CYCL CALL`.
 * `registerOpcode("CYCL DEF 200", handler)` still wins over the generic `CYCL DEF` builtin.
 */
import "@/machine/cycles/drilling_cycles";
import "@/machine/cycles/tapping_cycles";
import "@/machine/cycles/thread_cycles";
import "@/machine/cycles/datum_cycles";
