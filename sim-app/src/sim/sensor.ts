/**
 * SICK DT35-B15551 (part 1057651) — values from the product data sheet.
 * Used by the sim and by algorithm/scanEstimate.ts (keep numbers in one place).
 */

export const DT35 = {
  part: "DT35-B15551",
  partNo: "1057651",
  minRangeMm: 50,
  maxRangeMm90: 12000,
  maxRangeMm18: 5300,
  maxRangeMm6: 3100,
  resolutionMm: 0.1,
  repeatabilitySigmaMm: 0.5,
  accuracyTypMm: 10,
  spotMmAt2m: 15,
  sampleHzFast: 50,
} as const;
