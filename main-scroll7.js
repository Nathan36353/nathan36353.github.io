import Renderer from "./lib/Viz/2DRenderer.js";
import MassSpringSystemObject from "./lib/Scene/MassSpringSystemObject.js";

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const massSpring = new MassSpringSystemObject(
    renderer._device,
    renderer._canvasFormat,
    "./lib/Shaders/massspring.wgsl",
    16
  );
  await renderer.appendSceneObject(massSpring);

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
  .then((ret) => { console.log("Scroll 7 ready", ret); })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const c = document.getElementById("renderCanvas");
    if (c) c.remove();
  });
