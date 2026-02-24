import Renderer from "./lib/Viz/2DRenderer.js";
import MassSpringSystemObject from "./lib/Viz/Scene/MassSpringSystemObject.js";

function setStatus(msg, isError) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? "#f88" : "#888";
  }
}

// Sim space: x in [-0.25, 0.25], y in [0.5, -0.2] (top to bottom)
function clientToSim(clientX, clientY, canvas) {
  const r = canvas.getBoundingClientRect();
  const u = (clientX - r.left) / r.width;
  const v = (clientY - r.top) / r.height;
  return {
    x: -0.25 + u * 0.5,
    y: 0.5 - v * 0.7,
  };
}

async function init() {
  const canvas = document.createElement("canvas");
  canvas.id = "renderCanvas";
  document.body.appendChild(canvas);

  setStatus("Initializing WebGPU…");
  const renderer = new Renderer(canvas);
  renderer._clearColor = { r: 0.06, g: 0.08, b: 0.12, a: 1 };
  await renderer.init();
  if (renderer.resizeCanvas) renderer.resizeCanvas();

  setStatus("Loading mass-spring system…");
  const massSpring = new MassSpringSystemObject(
    renderer._device,
    renderer._canvasFormat,
    "./lib/Viz/Scene/Shaders/massspring.wgsl",
    15,
    0,
    0
  );
  await renderer.appendSceneObject(massSpring);

  try {
    const img = new Image();
    img.crossOrigin = "";
    img.src = "./assets/campus.jpg";
    await img.decode();
    const bitmap = await createImageBitmap(img);
    await massSpring.setClothTextureFromImage(bitmap);
  } catch (_) {}

  const interaction = { mouseX: 0, mouseY: 0, forceX: 0, forceY: 0, windX: 0, windY: 0 };
  const RADIUS_SQ = 0.06;
  const FORCE_STRENGTH = 0.06;
  const WIND_STRENGTH = 0.004;

  canvas.addEventListener("mousemove", (e) => {
    const sim = clientToSim(e.clientX, e.clientY, canvas);
    interaction.mouseX = sim.x;
    interaction.mouseY = sim.y;
    if (e.buttons) {
      interaction.forceX = 0;
      interaction.forceY = FORCE_STRENGTH;
    } else {
      interaction.forceY = 0.01;
      interaction.forceX = 0;
    }
  });
  canvas.addEventListener("mousedown", (e) => {
    const sim = clientToSim(e.clientX, e.clientY, canvas);
    interaction.mouseX = sim.x;
    interaction.mouseY = sim.y;
    interaction.forceX = 0;
    interaction.forceY = FORCE_STRENGTH;
  });
  canvas.addEventListener("mouseup", () => {
    interaction.forceX = 0;
    interaction.forceY = 0.005;
  });
  canvas.addEventListener("mouseleave", () => {
    interaction.forceX = 0;
    interaction.forceY = 0;
  });
  document.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") { interaction.windX = -WIND_STRENGTH; }
    if (e.key === "ArrowRight") { interaction.windX = WIND_STRENGTH; }
    if (e.key === "ArrowUp") { interaction.windY = WIND_STRENGTH; }
    if (e.key === "ArrowDown") { interaction.windY = -WIND_STRENGTH; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") interaction.windX = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") interaction.windY = 0;
  });

  setStatus("Drag mouse to push cloth; arrow keys = wind.");
  let frameCount = 0;
  function loop() {
    frameCount++;
    massSpring.setInteraction(interaction.mouseX, interaction.mouseY, interaction.forceX, interaction.forceY, RADIUS_SQ, interaction.windX, interaction.windY);
    const t = frameCount * 0.02;
    renderer._clearColor = {
      r: 0.06 + 0.02 * Math.sin(t),
      g: 0.08 + 0.02 * Math.sin(t + 1),
      b: 0.12 + 0.02 * Math.sin(t + 2),
      a: 1,
    };
    renderer.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init().catch((e) => {
  console.error(e);
  setStatus("Error: " + (e.message || String(e)), true);
  document.body.appendChild(document.createElement("pre")).textContent = (e.message || e) + "\n\n" + (e.stack || "");
});
