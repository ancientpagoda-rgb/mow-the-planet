const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, max) => ((value % max) + max) % max;

function hash(x, y = 0, seed = 0) {
  let value = Math.imul((x | 0) + 31 + seed * 17, 374761393) ^ Math.imul((y | 0) + 19, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function sphereNormal(gridX, gridY, width, height) {
  const longitude = (gridX / width) * Math.PI * 2;
  const latitude = Math.PI / 2 - (gridY / height) * Math.PI;
  const cosLatitude = Math.cos(latitude);
  return {
    x: -cosLatitude * Math.cos(longitude),
    y: Math.sin(latitude),
    z: cosLatitude * Math.sin(longitude),
  };
}

export function createScientificWorld({
  width,
  height,
  gridWidth = 180,
  gridHeight = 90,
  seed = 7319,
  seaLevel = 0.48,
} = {}) {
  const riverWaterThreshold = 0.85;
  const count = gridWidth * gridHeight;
  const elevation = new Float32Array(count);
  const rainfall = new Float32Array(count);
  const flow = new Float32Array(count);
  const river = new Float32Array(count);
  const lake = new Float32Array(count);
  const downstream = new Int32Array(count);
  downstream.fill(-1);

  const plates = Array.from({ length: 13 }, (_, index) => {
    const longitude = hash(index, 1, seed) * Math.PI * 2;
    const latitude = Math.asin(hash(index, 2, seed) * 2 - 1);
    const cosLatitude = Math.cos(latitude);
    return {
      x: -cosLatitude * Math.cos(longitude),
      y: Math.sin(latitude),
      z: cosLatitude * Math.sin(longitude),
      uplift: hash(index, 3, seed) * 0.34 - 0.16,
    };
  });

  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const index = gy * gridWidth + gx;
      const n = sphereNormal(gx + 0.5, gy + 0.5, gridWidth, gridHeight);
      let nearest = Infinity;
      let second = Infinity;
      let plateUplift = 0;
      for (const plate of plates) {
        const distance = 1 - (n.x * plate.x + n.y * plate.y + n.z * plate.z);
        if (distance < nearest) {
          second = nearest;
          nearest = distance;
          plateUplift = plate.uplift;
        } else if (distance < second) second = distance;
      }
      const boundary = Math.exp(-Math.max(0, second - nearest) * 34);
      const continental =
        Math.sin(n.x * 3.2 + n.z * 1.6 - n.y * 0.7) * 0.17 +
        Math.cos(n.z * 2.7 - n.y * 2.1) * 0.12 +
        Math.sin((n.x - n.z) * 6.4 + n.y * 2.3) * 0.075;
      const ridges = Math.max(0, boundary - 0.43) * (0.18 + hash(gx, gy, seed) * 0.08);
      const polarDrop = Math.pow(Math.abs(n.y), 3.2) * 0.045;
      elevation[index] = clamp(0.47 + plateUplift + continental + ridges - polarDrop, 0.04, 0.96);

      const latitudeRain = 0.34 + (1 - Math.abs(n.y)) * 0.34;
      const rainBands = Math.sin(n.y * Math.PI * 5.5 + n.x * 2.3) * 0.16;
      rainfall[index] = clamp(latitudeRain + rainBands + hash(gx, gy, seed ^ 0x51f15e) * 0.2, 0.05, 1);
    }
  }

  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const index = gy * gridWidth + gx;
      if (elevation[index] <= seaLevel) continue;
      let bestIndex = -1;
      let bestHeight = elevation[index] + hash(gx, gy, seed ^ 0x77a) * 0.001;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (!ox && !oy) continue;
          const nx = wrap(gx + ox, gridWidth);
          const ny = clamp(gy + oy, 0, gridHeight - 1);
          const neighbor = ny * gridWidth + nx;
          const neighborHeight = elevation[neighbor] + hash(nx, ny, seed ^ 0x77a) * 0.001;
          if (neighborHeight < bestHeight) {
            bestHeight = neighborHeight;
            bestIndex = neighbor;
          }
        }
      }
      downstream[index] = bestIndex;
      flow[index] = 0.12 + rainfall[index];
    }
  }

  const elevationOrder = Array.from({ length: count }, (_, index) => index)
    .sort((a, b) => elevation[b] - elevation[a]);
  for (const index of elevationOrder) {
    const target = downstream[index];
    if (target >= 0) flow[target] += flow[index];
  }

  for (let index = 0; index < count; index += 1) {
    if (elevation[index] <= seaLevel) continue;
    river[index] = clamp((Math.log1p(flow[index]) - 1.55) / 2.15, 0, 1);
    if (downstream[index] < 0 && flow[index] > 2.8 && elevation[index] < seaLevel + 0.18) {
      lake[index] = clamp((flow[index] - 2.8) / 7, 0.3, 1);
    }
  }

  const lakeSource = lake.slice();
  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const index = gy * gridWidth + gx;
      if (lakeSource[index] <= 0) continue;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = wrap(gx + ox, gridWidth);
          const ny = clamp(gy + oy, 0, gridHeight - 1);
          const neighbor = ny * gridWidth + nx;
          lake[neighbor] = Math.max(lake[neighbor], lakeSource[index] * 0.48);
        }
      }
    }
  }

  const sample = (x, y) => {
    const gx = wrap((x / width) * gridWidth, gridWidth);
    const gy = clamp((y / height) * gridHeight, 0, gridHeight - 0.0001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = wrap(x0 + 1, gridWidth);
    const y1 = Math.min(gridHeight - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const i00 = y0 * gridWidth + x0;
    const i10 = y0 * gridWidth + x1;
    const i01 = y1 * gridWidth + x0;
    const i11 = y1 * gridWidth + x1;
    const bilinear = (array) => {
      const top = array[i00] + (array[i10] - array[i00]) * tx;
      const bottom = array[i01] + (array[i11] - array[i01]) * tx;
      return top + (bottom - top) * ty;
    };
    const e = bilinear(elevation);
    const rain = bilinear(rainfall);
    // Hydrology used to snap to the nearest simulation cell. That made rivers
    // and lake shores render as conspicuous rectangular tiles on the globe.
    // Keep the compact flow simulation, but interpolate its visual/collision
    // field so shorelines remain stable and read as continuous water.
    const riverStrength = bilinear(river);
    const lakeStrength = bilinear(lake);
    const ocean = e <= seaLevel;
    const water = ocean || lakeStrength > 0.22 || riverStrength > riverWaterThreshold;
    const relief = clamp((e - seaLevel) / (1 - seaLevel), 0, 1);
    const moisture = clamp(rain * 0.72 + riverStrength * 0.35 + lakeStrength * 0.5, 0, 1);
    const biome = ocean ? "ocean"
      : lakeStrength > 0.22 ? "lake"
        : riverStrength > riverWaterThreshold ? "river"
          : relief > 0.72 ? "alpine"
            : moisture < 0.32 ? "dryland"
              : moisture > 0.7 ? "wetland"
                : "grassland";
    return { elevation: e, rainfall: rain, moisture, river: riverStrength, lake: lakeStrength, ocean, water, relief, biome };
  };

  const sampleNormal = (nx, ny, nz) => {
    let longitude = Math.atan2(nz, -nx);
    if (longitude < 0) longitude += Math.PI * 2;
    const latitude = Math.asin(clamp(ny, -1, 1));
    return sample((longitude / (Math.PI * 2)) * width, ((Math.PI / 2 - latitude) / Math.PI) * height);
  };

  return { width, height, gridWidth, gridHeight, seaLevel, elevation, rainfall, flow, river, lake, sample, sampleNormal };
}
