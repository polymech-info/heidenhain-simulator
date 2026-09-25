/**
 * Language specs register here and override a builtin with the same head.
 *
 *   import "./cycle200";
 *
 * A spec file calls `registerOpcode("CYCL DEF 200", handler)`.
 * The specific head is tried before the generic `CYCL DEF` builtin.
 */
export {};
