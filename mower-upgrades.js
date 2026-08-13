export const MOWER_UPGRADE_MAX = 5;

export const MOWER_UPGRADE_SPECS = Object.freeze({
  deck: { label: "Wide deck", baseCost: 650, perLevel: 0.12, detail: "+12% cutting radius / level" },
  battery: { label: "Battery", baseCost: 550, perLevel: 0.32, detail: "+32% endurance / level" },
  hopper: { label: "Hopper", baseCost: 700, perLevel: 0.35, detail: "+35% crop capacity / level" },
  traction: { label: "All-terrain", baseCost: 600, perLevel: 0.18, detail: "+18% traction / level" },
  armor: { label: "Armor", baseCost: 850, perLevel: 0.11, detail: "+11% damage resistance / level" },
  scanner: { label: "Scanner", baseCost: 750, perLevel: 0.28, detail: "faster, longer-range autonomous routing" },
  blades: { label: "Blade system", baseCost: 900, perLevel: 0.10, detail: "+10% harvested crop yield / level" },
  suspension: { label: "4WD suspension", baseCost: 1050, perLevel: 0.12, detail: "more speed + grip on rough ground" },
  solar: { label: "Solar array", baseCost: 1100, perLevel: 0.009, detail: "passive battery recovery in clear skies" },
  repair: { label: "Field repair", baseCost: 1200, perLevel: 0.12, detail: "shorter fire + redeploy downtime" },
  amphibious: { label: "Amphibious kit", baseCost: 1600, perLevel: 0.10, detail: "cross water; faster afloat each level" },
  attachment: { label: "Attachment chassis", baseCost: 1400, perLevel: 0.04, detail: "+4% strength to installed hardware / level" },
});

export function mowerUpgradeCost(key, level) {
  const spec = MOWER_UPGRADE_SPECS[key];
  if (!spec) return Infinity;
  return Math.round(spec.baseCost * Math.pow(1.55, Math.max(0, level)) / 25) * 25;
}
