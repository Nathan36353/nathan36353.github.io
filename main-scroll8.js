import Renderer from "./lib/Viz/2DRenderer.js";
import PolygonObject from "./lib/Scene/PolygonObject.js";
import Polygon from "./lib/DS/Polygon.js";
import StandardTextObject from "./lib/Scene/StandardTextObject.js";

function mouseToNDC(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = (-e.clientY / window.innerHeight) * 2 + 1;
  return [x, y];
}

async function createGpuWindingTester(device, polygon) {
  const resp = await fetch("./lib/Shaders/polygonWinding.wgsl", { cache: "no-store" });
  const code = await resp.text();
  const module = device.createShaderModule({ code });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "computeMain" }
  });

  const verts = polygon.vertexData;
  const edgeCount = polygon.edgeCount;
  const edgeData = new Float32Array(edgeCount * 4);
  for (let i = 0; i < edgeCount; i++) {
    const x0 = verts[2 * i];
    const y0 = verts[2 * i + 1];
    const x1 = verts[2 * (i + 1)];
    const y1 = verts[2 * (i + 1) + 1];
    edgeData[4 * i + 0] = x0;
    edgeData[4 * i + 1] = y0;
    edgeData[4 * i + 2] = x1;
    edgeData[4 * i + 3] = y1;
  }

  const edgeBuffer = device.createBuffer({
    size: edgeData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(edgeBuffer, 0, edgeData);

  const mouseBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const windingBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  });

  const stageBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: edgeBuffer } },
      { binding: 1, resource: { buffer: mouseBuffer } },
      { binding: 2, resource: { buffer: windingBuffer } }
    ]
  });

  let lastInside = false;

  async function update(point) {
    const [px, py] = point;
    const zero = new Int32Array(2);
    device.queue.writeBuffer(windingBuffer, 0, zero);
    const mouseArr = new Float32Array([px, py]);
    device.queue.writeBuffer(mouseBuffer, 0, mouseArr);

    if (stageBuffer.mapState !== "unmapped") {
      return lastInside;
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = 64;
    const numGroups = Math.ceil(edgeCount / workgroupSize);
    pass.dispatchWorkgroups(numGroups);
    pass.end();

    encoder.copyBufferToBuffer(windingBuffer, 0, stageBuffer, 0, 8);
    device.queue.submit([encoder.finish()]);

    await stageBuffer.mapAsync(GPUMapMode.READ);
    const wn = new Int32Array(stageBuffer.getMappedRange());
    const outside = wn[0] === 0 || wn[1] === 0;
    stageBuffer.unmap();
    lastInside = !outside;
    return lastInside;
  }

  return { update };
}

async function init() {
  const canvasTag = document.createElement("canvas");
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  const polygon = await Polygon.load("./assets/box.polygon");
  const polyObj = new PolygonObject(renderer._device, renderer._canvasFormat, polygon);
  await renderer.appendSceneObject(polyObj);

  const gpuTester = await createGpuWindingTester(renderer._device, polygon);

  let lastGpuInside = false;

  const statusText = new StandardTextObject("Polygon: box\ninside? outside");
  statusText._textCanvas.style.border = "none";
  statusText._textCanvas.style.top = "20px";
  statusText._textCanvas.style.left = "20px";

  canvasTag.addEventListener("mousemove", (e) => {
    const ndc = mouseToNDC(e);
    const insideConvex = polygon.isInsideConvex(ndc);
    const insideWinding = polygon.isInsideWinding(ndc);
    const inside = insideConvex && insideWinding;

    // Kick off GPU winding test; update text when it finishes.
    gpuTester.update(ndc).then((gpuInside) => {
      lastGpuInside = gpuInside;
      statusText.updateText(
        "Polygon: box\n" +
        "mouse: (" + ndc[0].toFixed(2) + ", " + ndc[1].toFixed(2) + ")\n" +
        "inside (convex test): " + (insideConvex ? "yes" : "no") + "\n" +
        "inside (winding CPU): " + (insideWinding ? "yes" : "no") + "\n" +
        "inside (winding GPU): " + (gpuInside ? "yes" : "no") + "\n" +
        "FINAL (CPU): " + (inside ? "inside" : "outside")
      );
    }).catch(() => {
      statusText.updateText(
        "Polygon: box\n" +
        "mouse: (" + ndc[0].toFixed(2) + ", " + ndc[1].toFixed(2) + ")\n" +
        "inside (convex test): " + (insideConvex ? "yes" : "no") + "\n" +
        "inside (winding CPU): " + (insideWinding ? "yes" : "no") + "\n" +
        "inside (winding GPU): " + (lastGpuInside ? "yes" : "no") + "\n" +
        "FINAL (CPU): " + (inside ? "inside" : "outside")
      );
    });
  });

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
  .then((ret) => { console.log("Scroll 8 ready", ret); })
  .catch((error) => {
    const pTag = document.createElement("p");
    pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
    document.body.appendChild(pTag);
    const c = document.getElementById("renderCanvas");
    if (c) c.remove();
  });

