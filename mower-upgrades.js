export const MOWER_UPGRADE_MAX = 5;

export const MOWER_UPGRADE_SPECS = Object.freeze({
  deck: { label: "Wide deck", baseCost: 650, perLevel: 0.12, detail: "+12% cutting radius / level" },
  battery: { label: "Battery", baseCost: 550, perLevel: 0.32, detail: "+32% endurance / level" },
  hopper: { label: "Grain trailer", baseCost: 700, perLevel: 0.35, detail: "+35% grain hauling capacity / level" },
  traction: { label: "All-terrain", baseCost: 600, perLevel: 0.18, detail: "+18% traction / level" },
  armor: { label: "Armor", baseCost: 850, perLevel: 0.11, detail: "+11% damage resistance / level" },
  scanner: { label: "Scanner", baseCost: 750, perLevel: 0.28, detail: "faster, longer-range autonomous routing" },
});

export function mowerUpgradeCost(key, level) {
  const spec = MOWER_UPGRADE_SPECS[key];
  if (!spec) return Infinity;
  return Math.round(spec.baseCost * Math.pow(1.55, Math.max(0, level)) / 25) * 25;
}
