/**
 * Quest 4: Enchanted Symphony of Motion — Flame effect
 * Loaded as SOURCE (not obfuscated) until you're ready to seal.
 */
import Renderer from "./lib/Viz/2DRenderer.js";
import FlameParticleObject from "./lib/Scene/FlameParticleObject.js";

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const flame = new FlameParticleObject(
    renderer._device,
    renderer._canvasFormat,
    "./lib/Shaders/flame.wgsl",
    12000
  );
  await renderer.appendSceneObject(flame);

  const tgtFPS = 60;
  const frameInterval = (1 / tgtFPS) * 1000;
  let lastCalled = Date.now();

  const renderFrame = () => {
    const elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      lastCalled = Date.now() - (elapsed % frameInterval);
      renderer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();

  return renderer;
}

init()
  .then((ret) => { console.log("Quest 4 ready", ret); })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const canvas = document.getElementById("renderCanvas");
    if (canvas) canvas.remove();
  });
