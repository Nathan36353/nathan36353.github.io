import Renderer from "./lib/Viz/2DRenderer.js";
import ParticleSystemObject from "./lib/Scene/ParticleSystemObject.js";

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const particles = new ParticleSystemObject(
    renderer._device,
    renderer._canvasFormat,
    "./lib/Shaders/particles.wgsl",
    4096
  );
  await renderer.appendSceneObject(particles);

  let frameCnt = 0;
  const tgtFPS = 60;
  const frameInterval = (1 / tgtFPS) * 1000;
  let lastCalled = Date.now();

  const renderFrame = () => {
    const elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      frameCnt += 1;
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
  .then((ret) => { console.log("Scroll 6 ready", ret); })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const c = document.getElementById("renderCanvas");
    if (c) c.remove();
  });
