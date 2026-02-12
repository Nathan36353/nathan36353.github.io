import Renderer from "/lib/Viz/2DRenderer.js";
import Camera from "/lib/Viz/Camera.js";
import Camera2DVertexObject from "/lib/Scene/Camera2DVertexObject.js";

function mouseToNDC(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (-e.clientY / window.innerHeight) * 2 + 1;
  return [x, y];
}

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const camera = new Camera();
  const triangle = new Camera2DVertexObject(
    renderer._device,
    renderer._canvasFormat,
    camera._pose,
    new Float32Array([0, 0.5, -0.5, 0, 0.5, 0]),
    "/lib/Shaders/cameraView.wgsl",
    "triangle-list"
  );
  await renderer.appendSceneObject(triangle);

  const movespeed = 0.05;
  let sceneDirty = true;
  let frameCnt = 0;
  let renderCount = 0;
  const tgtFPS = 60;
  const frameInterval = (1 / tgtFPS) * 1000;
  let lastCalled = Date.now();

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        camera.moveUp(movespeed);
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        camera.moveDown(movespeed);
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        camera.moveLeft(movespeed);
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        camera.moveRight(movespeed);
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
      case "q":
      case "Q":
        camera.zoomIn();
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
      case "e":
      case "E":
        camera.zoomOut();
        triangle.updateCameraPose();
        sceneDirty = true;
        break;
    }
  });

  let dragging = false;
  let prevP = { x: 0, y: 0 };
  const DIRTY_THRESHOLD = 0.001;

  canvasTag.addEventListener("mousedown", (e) => {
    dragging = true;
    const ndc = mouseToNDC(e);
    prevP.x = ndc[0];
    prevP.y = ndc[1];
  });

  canvasTag.addEventListener("mouseup", () => {
    dragging = false;
  });

  canvasTag.addEventListener("mouseleave", () => {
    dragging = false;
  });

  canvasTag.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const ndc = mouseToNDC(e);
    const dx = ndc[0] - prevP.x;
    const dy = ndc[1] - prevP.y;
    const diff = Math.sqrt(dx * dx + dy * dy);
    if (diff > DIRTY_THRESHOLD) {
      prevP.x = ndc[0];
      prevP.y = ndc[1];
      if (dx > 0) camera.moveRight(-dx);
      else camera.moveLeft(dx);
      if (dy > 0) camera.moveUp(-dy);
      else camera.moveDown(dy);
      triangle.updateCameraPose();
      sceneDirty = true;
    }
  });

  const renderFrame = () => {
    const elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      frameCnt += 1;
      lastCalled = Date.now() - (elapsed % frameInterval);
      if (sceneDirty) {
        renderer.render();
        renderCount += 1;
        sceneDirty = false;
      }
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();

  setInterval(() => {
    console.log("fps tick", frameCnt, "renders", renderCount);
    frameCnt = 0;
    renderCount = 0;
  }, 1000);

  return renderer;
}

init()
  .then((ret) => {
    console.log("Scroll 4 ready", ret);
  })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const c = document.getElementById("renderCanvas");
    if (c) c.remove();
  });
