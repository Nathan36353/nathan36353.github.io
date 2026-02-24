# nathan36353.github.io — Arcane Portal

This portal displays a 2D solar system animation and image-processing filters (Quest).

## Quest: Solar System + Image Processing

### Solar system (1 point each)
- **Circles and colors**: Sun and planets are circles with distinct colors; orbits are ellipse paths.
- **Interpolation (3+ poses)**: The spaceship (3 circles) animates along 3 keyframe poses with ease-in-ease-out interpolation.
- **Planet orbits**: Eight planets orbit the sun (circular or elliptical).
- **Moon**: One moon orbits the first planet.
- **Elliptical orbit**: The third planet uses an elliptical orbit (a ≠ b).
- **Full system**: Sun + 8 planets, orbits, one moon.
- **Space background**: Optional; add `assets/space.png` for a full-screen starfield/nebula texture.
- **Spaceship**: Animated object made of 3 circles, moving through 3 interpolated poses.
- **Planet rotation**: The first planet rotates (spins) while orbiting.

### Image processing (compute shaders)
- **Grayscale**: Formula 0.299R + 0.587G + 0.114B (uncomment in main.js).
- **Gaussian blur**: 5×5 kernel (uncomment in main.js).
- **Pointillism (2 pts)**: 3% random pixels as circle centers, radius 1–10% of max dimension, circles colored with center pixel (uncomment in main.js).

### Run locally
1. `python server.py`
2. Open http://localhost:8080/index.html

### Seal for submission
1. `python combine.py main.js`
2. Run `optimizeWGSL.py` on each shader used (blitTexture, circlePoseColor, solidColor, filterCopy, filterGrayscale, filterGaussianBlur, filterPointillismPass1, filterPointillismPass2, fullscreenTexture).
3. Obfuscate main-full.js → main.min.js
4. Point HTML to main.min.js
