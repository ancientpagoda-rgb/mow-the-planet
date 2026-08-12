# Mow the Planet

A touch-first living-planet simulation built with Three.js, where a farming village grows among dragons, rocs, and one impossible cat.

The world runs at a brisk **1.7× simulation speed** while camera movement remains unscaled for comfortable touch control.
Cut grass regrows after **55 simulated seconds**, turning the planet into a continuous renewable mowing ecosystem.
Rendering adapts its internal resolution to device performance. Large uncapped dragon broods switch new hatchlings to lightweight 3D models, avoid extra fire lights, and skip rendering on the hidden side of the planet.
The enlarged 10,800 × 5,400 world is generated from a compact 192 × 96 scientific lattice: tectonic-style elevation, latitude-sensitive rainfall, downhill flow accumulation, rivers, lakes, small oceans, moisture biomes, and elevation contour bands. About 13% of the surface is water; water blocks ground workers while dragons cross it freely.

## Run locally

```bash
python3 -m http.server 4174 --directory .
```

Then open `http://127.0.0.1:4174/`.

## Controls

- The mower launches in **AUTO** mode and seeks uncut grass by itself.
- Hold **NITRO** (or `Shift`) for a temporary speed boost. Nitro recharges slowly and rapidly at charging stations.
- Spend 5,000 earned score to upgrade the founding mower into a large tractor with a wide pulled mowing deck.
- Each worker reproduces after personally mowing **0.25 kg**. Offspring inherit a generation number, join an autonomous worker class, and seek separate uncut patches. The colony is capped at 12 workers for mobile performance.
- Every worker levels itself up after each kilogram it personally mows, up to level 5. Each level adds 10% permanent movement speed and 10% cutting width, then triggers a glowing seven-second 1.75× speed burst.
- The worker cycle includes weed-whacker workers: walking characters with animated legs and spinning trimmers who move more slowly but work closer to habitats and obstacles than riding mowers.
- The worker cycle also produces helmeted chainsaw walkers. They seek mature trees, visibly run their saws, fell trees for score and personal progress, and leave saplings that begin regrowing after 16 seconds.
- Three articulated dragons begin above the terrain, flap and bank around the globe, chase riders, breathe layered fire with a hot core, sparks, and local firelight, and eat captured offspring. After three meals, a dragon hatches a smaller next-generation dragon that grows to full size; the brood has no population cap. Scorched riders visibly catch fire around the torso and head with flickering flames, embers, and rising smoke. If the founding rider is eaten, a replacement redeploys from a charging station after a short delay.
- Touch: tap **AUTO** to toggle autopilot; hold **GO** and use the steering buttons to take over.
- Camera: drag to orbit smoothly around the planet, pinch or scroll to change distance, and release to coast gently. On desktop, right- or middle-drag anchors the camera position while pivoting the view. Tap **◎** for a globe overview. **POV** enters the founding rider's first-person view; **CHASE** follows from behind and above. Both stay linked to the founder, allow drag/pinch camera control, switch directly between one another, and expose **RETURN** on the active view to restore the previous free-camera pose.
- Keyboard: `W/A/S/D` or arrow keys.
- Autopilot returns to the nearest amber field station to recharge.

## MVP systems

- a truly spherical lawn planet mapped from 10,800 × 5,400 latitude/longitude mowing coordinates, with visibly displaced scientific topography and hydrology;
- a true 3D mower, rider, terrain, habitats, lighting, shadows, and chase camera;
- grass relief, large-scale biome tinting, atmospheric rim light, moving cloud cover, and a star field;
- terrain-aware placement keeps mowers, habitats, charging stations, and the Surface viewpoint seated on hills and valleys;
- 0.48×–55× pinch, mouse-wheel, and one-tap camera zoom controls, including a full-globe view;
- standard damped globe-orbit camera, independent from the mower;
- deterministic procedural grass texture and planet-wide habitats;
- persistent cut cells and striped mowing trails;
- mower acceleration, steering, reversing, battery drain, and charging;
- colony reproduction, autonomous offspring, generations, hatch progress, and score;
- extensible worker classes: riding mowers for broad coverage, weed-whacker walkers for close trimming, and chainsaw walkers for renewable forestry;
- flying dragon predators, fire-breath attacks, mower losses, and founder redeployment;
- collision penalties for trees, stones, water, and flowers;
- touch controls, keyboard controls, synthesized mower audio, completion scoring;
- responsive iPhone and desktop layouts.
