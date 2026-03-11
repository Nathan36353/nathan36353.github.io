# Build obfuscated bundles (final display)

The project HTML pages load **obfuscated** code from the `dist/` folder.

## What gets obfuscated

| Entry point      | Combined file      | Obfuscated output   |
|------------------|--------------------|---------------------|
| main.js          | main-full.js       | dist/demo.min.js    |
| main-scroll4.js  | main-scroll4-full.js | dist/scroll4.min.js |
| main-scroll5.js  | main-scroll5-full.js | dist/scroll5.min.js |
| main-scroll6.js  | main-scroll6-full.js | dist/scroll6.min.js |
| main-quest3.js   | main-quest3-full.js  | dist/quest3.min.js  |

## Steps

1. **Optional – optimize WGSL shaders** (so the combined bundle uses optimized_*.wgsl):
   ```bash
   python optimizeWGSL.py cameraView
   python optimizeWGSL.py gridView
   python optimizeWGSL.py particles
   python optimizeWGSL.py questGrid
   ```
   (And any other shaders your entries use.)

2. **Combine and obfuscate**:
   ```bash
   python build.py
   ```
   - Runs `combine.py` on each entry → produces `*-full.js`.
   - If **Node.js/npx** is installed: obfuscates each `*-full.js` → `dist/xxx.min.js`.
   - If not: copies `*-full.js` into `dist/` as `xxx.min.js` and prints a note. Install Node and run `python build.py` again to obfuscate, or obfuscate the `*-full.js` files manually and put the results in `dist/` with the names above.

3. **Serve and test** (e.g. `python -m http.server 8080`), then open the hub and each project. They load from `dist/*.min.js`.

## Where obfuscated code lives

All final scripts are in **`dist/`**:

- `dist/demo.min.js`
- `dist/scroll4.min.js`
- `dist/scroll5.min.js`
- `dist/scroll6.min.js`
- `dist/quest3.min.js`

The HTML files (demo.html, scroll4.html, …) already point to these. After running `python build.py`, commit the `dist/` folder so the live site uses the obfuscated bundles.
