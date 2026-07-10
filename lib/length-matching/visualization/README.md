# Length-matching visualization API

`index.ts` exposes `createLengthMatchingVisualization(input)`, the only entry
point for composing solver debug graphics. It preserves the snapshot draw order:
routes, then board/obstacles, then the current candidate diagnostic.

Use `createLengthMatchingColorTheme(colorMap)` from `color-theme.ts` for every
connection color, transparency variant, and static debug color. Builders must
not read `colorMap` or call `transparentize()` directly.

`graphics-layers.ts` owns PCB-layer to graphics-layer conversion. Route,
obstacle, and attempt builders only append graphics to the supplied collection.

The SVG snapshot test is the visual compatibility contract; change it only for
an intentional visual design change.
