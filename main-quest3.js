import Renderer from "./lib/Viz/2DRenderer.js";
import Camera from "./lib/Viz/Camera.js";
import PGA2D from "./lib/PGA2D.js";
import QuestGridObject, { GRID_SIZE } from "./lib/Scene/QuestGridObject.js";
import StandardTextObject from "./lib/Scene/StandardTextObject.js";

function mouseToNDC(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (-e.clientY / window.innerHeight) * 2 + 1;
  return [x, y];
}

function getCellFromEvent(e, camera, gridSize) {
  let mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  let mouseY = (-e.clientY / window.innerHeight) * 2 + 1;
  mouseX /= camera._pose[4];
  mouseY /= camera._pose[5];
  const motor = [camera._pose[0], camera._pose[1], camera._pose[2], camera._pose[3]];
  const p = PGA2D.applyMotorToPoint([mouseX, mouseY], motor);
  const halfLength = 1;
  const cellLength = halfLength * 2;
  const u = Math.floor((p[0] + halfLength) / cellLength * gridSize);
  const v = Math.floor((p[1] + halfLength) / cellLength * gridSize);
  if (u < 0 || u >= gridSize || v < 0 || v >= gridSize) return null;
  const offsetX = -halfLength + u / gridSize * cellLength + cellLength / gridSize * 0.5;
  const offsetY = -halfLength + v / gridSize * cellLength + cellLength / gridSize * 0.5;
  const cellHalf = 0.5 / gridSize;
  if (-cellHalf + offsetX <= p[0] && p[0] <= cellHalf + offsetX &&
      -cellHalf + offsetY <= p[1] && p[1] <= cellHalf + offsetY) {
    return { u, v };
  }
  return null;
}

const quadVertices = new Float32Array([
  -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5
]);

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const camera = new Camera();
  const grid = new QuestGridObject(
    renderer._device,
    renderer._canvasFormat,
    camera._pose,
    quadVertices,
    "./lib/Shaders/questGrid.wgsl",
    "line-strip",
    GRID_SIZE * GRID_SIZE
  );
  await renderer.appendSceneObject(grid);

  const fpsText = new StandardTextObject("fps: 0");
  fpsText._textCanvas.style.zIndex = "100";

  const legendText = new StandardTextObject(
    "WASD: pan | Q/E: zoom | Space: pause | R: reset | +/-: speed | Click: toggle cell | F: hide"
  );
  legendText._textCanvas.style.top = "auto";
  legendText._textCanvas.style.bottom = "10px";
  legendText._textCanvas.style.left = "10px";
  legendText._textCanvas.style.zIndex = "100";

  const movespeed = 0.05;
  let frameCnt = 0;
  const tgtFPS = 60;
  const frameInterval = (1 / tgtFPS) * 1000;
  let lastCalled = Date.now();
  let dragging = false;
  let prevP = { x: 0, y: 0 };
  const DIRTY_THRESHOLD = 0.001;

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        camera.moveDown(movespeed);
        grid.updateCameraPose();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        camera.moveUp(movespeed);
        grid.updateCameraPose();
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        camera.moveRight(movespeed);
        grid.updateCameraPose();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        camera.moveLeft(movespeed);
        grid.updateCameraPose();
        break;
      case "q":
      case "Q":
        camera.zoomIn();
        grid.updateCameraPose();
        break;
      case "e":
      case "E":
        camera.zoomOut();
        grid.updateCameraPose();
        break;
      case " ":
        grid.setPaused(!grid._paused);
        break;
      case "r":
      case "R":
        grid.reset();
        break;
      case "=":
      case "+":
        grid.setSpeed(-30);
        break;
      case "-":
        grid.setSpeed(30);
        break;
      case "f":
      case "F":
        fpsText.toggleVisibility();
        legendText.toggleVisibility();
        break;
    }
  });

  canvasTag.addEventListener("mousedown", (e) => {
    const cell = getCellFromEvent(e, camera, GRID_SIZE);
    if (cell) {
      grid.addToggle(cell.u, cell.v);
    } else {
      dragging = true;
      const ndc = mouseToNDC(e);
      prevP.x = ndc[0];
      prevP.y = ndc[1];
    }
  });

  canvasTag.addEventListener("mouseup", () => { dragging = false; });
  canvasTag.addEventListener("mouseleave", () => { dragging = false; });

  canvasTag.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const ndc = mouseToNDC(e);
    const dx = ndc[0] - prevP.x;
    const dy = ndc[1] - prevP.y;
    const diff = Math.sqrt(dx * dx + dy * dy);
    if (diff > DIRTY_THRESHOLD) {
      prevP.x = ndc[0];
      prevP.y = ndc[1];
      if (dx > 0) camera.moveLeft(dx);
      else camera.moveRight(-dx);
      if (dy > 0) camera.moveDown(dy);
      else camera.moveUp(-dy);
      grid.updateCameraPose();
    }
  });

  const renderFrame = () => {
    const elapsed = Date.now() - lastCalled;
    if (elapsed > frameInterval) {
      frameCnt += 1;
      lastCalled = Date.now() - (elapsed % frameInterval);
      fpsText.updateText("fps: " + frameCnt);
      renderer.render();
    }
    requestAnimationFrame(renderFrame);
  };
  lastCalled = Date.now();
  renderFrame();

  setInterval(() => { frameCnt = 0; }, 1000);

  return renderer;
}

init()
  .then((ret) => { console.log("Quest 3 ready", ret); })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const c = document.getElementById("renderCanvas");
    if (c) c.remove();
  });
