# Little orchard sprite pack

Twenty original sprites generated with the built-in ImageGen tool on 2026-11-06.
The prompts and asset order are recorded in [generation.json](generation.json).
These are hand-painted storybook assets with an elevated three-quarter view,
warm upper-left light and genuine alpha transparency. No third-party game assets
or character designs were used. Project distribution uses the repository license.

[Open the complete catalog](sprite-catalog.png).

- Six plant states: sprout, young, flowering, green fruit, ripe fruit, harvested.
- Two shrubs: leafy and flowering.
- Two buildings: cottage and tool shed.
- Stone well, potting bench, empty/full baskets, watering can, compost sack and neutral gardener.
- Distinct Mira, Rook and Pip gardener bodies matching their cross-world portraits.

## Files and scale

`sprites/` contains individual 256 × 256 transparent PNGs. The runtime uses the
optimized WebP atlas in `src/game/assets/orchard-atlas.webp`; each cell is 256 × 256,
four columns, with its root at `(128, 236)`. `src/game/sprite-keys.ts` records the
cell order. Plants share one source scale across growth stages, so the seedling
is naturally smaller than the mature bush. No per-state automatic fit stretches
small plants to mature size. Original generated resolutions are retained locally
in ignored `output/sprites/source/` and are not shipped in the game package.

The scene chooses sprites from actual host state: unwatered beds are sprouts,
watered beds become young plants, the ripening phase shows flowers then green
fruit, and only mature fruit uses the ripe sprite. The harvested sprite appears
only after the host has picked that bed. The basket artwork switches from empty
to full after the first harvest; its adjacent numeric count is the exact yield.
The gardener is a static pose with a small walking sway, not a generated walk animation.

## Explicit local preparation

Ordinary `pnpm build` consumes the prepared atlas and needs no image tools or
image-generation credentials. To prepare the art again from the retained local
originals, install ImageMagick and `cwebp`, then run:

```sh
node scripts/prepare-sprites.mjs
```

The script crops transparent padding, preserves alpha, applies a common plant
scale, aligns roots, creates the runtime atlas and renders the catalog. Catalog
labels use the system Arial font on macOS or DejaVu Sans elsewhere; set
`SPRITE_CATALOG_FONT` to an available font file if needed. Regeneration is local
and manual, with no remote execution or deployment.

## Ground tiles

Two original ground textures were generated with built-in ImageGen on 2026-11-06.
[Grass](terrain/grass.png) and [earth](terrain/earth.png) are opaque 256 × 256
repeating tiles. Their exact prompts and preparation are recorded in
[terrain generation](terrain/generation.json). Full generated originals remain
in ignored `output/terrain/source/`; runtime WebP copies live in
`src/game/assets/`. Builds consume these prepared files without image tools.

The renderer uses tiled grass, soil routes and planting beds. It adds no vector
fence, ground hatching, bed outlines or oval cast shadows. Wet and composted
soil use a texture tint; pouring uses the watering-can sprite. The well sits
behind its host interaction point so the companion remains in front while
refilling. Mechanics and AI authority are unchanged.

Terrain transitions blend the existing earth and grass artwork through a
deterministic, feathered irregular contour. Rounded paths and oval beds share one
union, so joins have no rectangular seams. The terrain is composed once at mount;
frames only update crop artwork and subtle watered/composted soil tint. World
labels for the companion and basket are omitted; exact harvest counts remain in
the accessible game status. No new image generation is needed for transitions.
