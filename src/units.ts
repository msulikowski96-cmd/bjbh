
export type UnitSystem = 'metric' | 'imperial';

export const KG_TO_LBS = 2.20462;
export const CM_TO_IN = 0.393701;

export function kgToLbs(kg: number): number {
  return Number((kg * KG_TO_LBS).toFixed(1));
}

export function lbsToKg(lbs: number): number {
  return Number((lbs / KG_TO_LBS).toFixed(1));
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalInches = cm * CM_TO_IN;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { ft, in: inches };
}

export function ftInToCm(ft: number, inches: number): number {
  const totalInches = ft * 12 + inches;
  return Math.round(totalInches / CM_TO_IN);
}

export function formatWeight(kg: number, system: UnitSystem): string {
  if (system === 'metric') return `${kg} kg`;
  return `${kgToLbs(kg)} lbs`;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === 'metric') return `${cm} cm`;
  const { ft, in: inches } = cmToFtIn(cm);
  return `${ft}'${inches}"`;
}
