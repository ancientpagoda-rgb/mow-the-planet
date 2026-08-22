// Keep the live POINTS counter tied to all productive harvesting work.
// game.js already increments cutCount when virgin grass is cut, but mature
// crops were being harvested without incrementing the score accumulator.
const previousPostPatch = globalThis.__mowPostPatchGameSource;

globalThis.__mowPostPatchGameSource = (input) => {
  let source = typeof previousPostPatch === "function" ? previousPostPatch(input) : input;

  const before = `      if (cut[index] && cropStage[index] >= 3) {
        cropStage[index] = 0;
        cropType[index] = 0;
        harvestedCropCells += 1;
        unplantedHarvestCells.push(index);`;

  const after = `      if (cut[index] && cropStage[index] >= 3) {
        cropStage[index] = 0;
        cropType[index] = 0;
        harvestedCropCells += 1;
        // cutCount is the lifetime work accumulator used by liveScore().
        // currentCutCount intentionally stays unchanged because this cell was
        // already part of the currently harvested surface coverage.
        cutCount += 1;
        unplantedHarvestCells.push(index);`;

  if (!source.includes(before)) {
    console.warn("[points fix] crop-harvest score marker not found");
    return source;
  }

  return source.replace(before, after);
};
