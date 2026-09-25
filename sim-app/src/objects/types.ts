import type { Group } from "three";

export type LoadTruth = {
  heightMm: number;
  radiusMm: number;
};

export type LoadDefinition = {
  id: string;
  name: string;
  description: string;
  /** Build in mm. Origin = turntable centre, Y-up (Three), floor at y=0. */
  create: () => Group;
  truth: LoadTruth;
};
