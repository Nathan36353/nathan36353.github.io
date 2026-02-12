class SceneObject {
  static _objectCnt = 0;
  constructor(device, canvasFormat, shaderFile) {
    if (this.constructor == SceneObject) {
      throw new Error("Abstract classes can't be instantiated.");
    }
    this._device = device;
    this._canvasFormat = canvasFormat;
    this._shaderFile = shaderFile;
    SceneObject._objectCnt += 1;
  }

  getName() {
    return this.constructor.name + " " + SceneObject._objectCnt.toString();
  }

  async init() {
    await this.createGeometry();
    await this.createShaders();
    await this.createRenderPipeline();
    await this.createComputePipeline();
  }

  async createGeometry() { throw new Error("Method 'createGeometry()' must be implemented."); }

  updateGeometry() { }

  loadShader(filename) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.open("GET", filename);
      xhttp.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
      xhttp.onload = function() {
        if (xhttp.readyState === XMLHttpRequest.DONE && xhttp.status === 200) {
          resolve(xhttp.responseText);
        } else {
          reject({ status: xhttp.status, statusText: xhttp.statusText });
        }
      };
      xhttp.onerror = function() {
        reject({ status: xhttp.status, statusText: xhttp.statusText });
      };
      xhttp.send();
    });
  }

  async createShaders() {
    const shaderCode = await this.loadShader(this._shaderFile);
    this._shaderModule = this._device.createShaderModule({
      label: "Shader " + this.getName(),
      code: shaderCode,
    });
  }

  async createRenderPipeline() { throw new Error("Method 'createRenderPipeline()' must be implemented."); }

  render(pass) { throw new Error("Method 'render(pass)' must be implemented."); }

  async createComputePipeline() { }

  compute(pass) { }
}


class Camera2DVertexObject extends SceneObject {
  constructor(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances = 1) {
    super(device, canvasFormat, shaderFile);
    this._cameraPose = cameraPose;
    this._vertices = vertices;
    this._topology = topology;
    this._numInstances = numInstances;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._cameraPoseBuffer = this._device.createBuffer({
      label: "Camera Pose " + this.getName(),
      size: this._cameraPose.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateCameraPose();
  }

  updateGeometry() {}

  updateCameraPose() {
    if (this._cameraPoseBuffer)
      this._device.queue.writeBuffer(this._cameraPoseBuffer, 0, this._cameraPose);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Render Pipeline " + this.getName(),
      layout: "auto",
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [this._vertexBufferLayout]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      },
      primitive: { topology: this._topology }
    });
    this._bindGroup = this._device.createBindGroup({
      label: "Renderer Bind Group " + this.getName(),
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._cameraPoseBuffer } }]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(this._vertices.length / 2, this._numInstances);
  }

  async createComputePipeline() {}
  compute(pass) {}
}


const GRID_SIZE = 256;
const MAX_TOGGLES = 64;

class QuestGridObject extends Camera2DVertexObject {
  constructor(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances) {
    super(device, canvasFormat, cameraPose, vertices, shaderFile, topology, numInstances);
    this._paused = false;
    this._updateIntervalMs = 150;
    this._toggleCount = 0;
    this._toggles = new Uint32Array(MAX_TOGGLES);
  }

  async createGeometry() {
    await super.createGeometry();
    this._cellStatus = new Uint32Array(GRID_SIZE * GRID_SIZE);
    this._randomize();
    this._cellStateBuffers = [
      this._device.createBuffer({
        label: "Quest Grid Buffer 1 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Quest Grid Buffer 2 " + this.getName(),
        size: this._cellStatus.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStatus);
    this._device.queue.writeBuffer(this._cellStateBuffers[1], 0, this._cellStatus);
    this._paramsBuffer = this._device.createBuffer({
      label: "Params " + this.getName(),
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this._togglesBuffer = this._device.createBuffer({
      label: "Toggles " + this.getName(),
      size: MAX_TOGGLES * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this._step = 0;
  }

  _randomize() {
    for (let i = 0; i < this._cellStatus.length; i++) {
      this._cellStatus[i] = Math.random() > 0.5 ? 1 : 0;
    }
  }

  reset() {
    this._randomize();
    this._device.queue.writeBuffer(this._cellStateBuffers[0], 0, this._cellStatus);
    this._device.queue.writeBuffer(this._cellStateBuffers[1], 0, this._cellStatus);
  }

  setPaused(paused) {
    this._paused = paused;
  }

  setSpeed(deltaMs) {
    this._updateIntervalMs = Math.max(50, Math.min(500, this._updateIntervalMs + deltaMs));
  }

  addToggle(u, v) {
    if (u < 0 || u >= GRID_SIZE || v < 0 || v >= GRID_SIZE) return false;
    if (this._toggleCount >= MAX_TOGGLES) return false;
    this._toggles[this._toggleCount++] = v * GRID_SIZE + u;
    return true;
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Quest Grid Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {} },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Quest Grid Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Quest Grid Render Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [this._vertexBufferLayout]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      },
      primitive: { topology: this._topology }
    });
    this._createBindGroups();
  }

  _createBindGroups() {
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Quest Grid Bind Group 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[0] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[1] } },
          { binding: 3, resource: { buffer: this._paramsBuffer } },
          { binding: 4, resource: { buffer: this._togglesBuffer } }
        ]
      }),
      this._device.createBindGroup({
        label: "Quest Grid Bind Group 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._cameraPoseBuffer } },
          { binding: 1, resource: { buffer: this._cellStateBuffers[1] } },
          { binding: 2, resource: { buffer: this._cellStateBuffers[0] } },
          { binding: 3, resource: { buffer: this._paramsBuffer } },
          { binding: 4, resource: { buffer: this._togglesBuffer } }
        ]
      })
    ];
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.draw(this._vertices.length / 2, this._numInstances);
  }

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Quest Grid update pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  compute(pass) {
    if (this._paused) return;
    const now = performance.now();
    this._lastComputeTime = this._lastComputeTime ?? now;
    if (now - this._lastComputeTime < this._updateIntervalMs) return;
    this._lastComputeTime = now;
    const paramsView = new Uint32Array([this._toggleCount]);
    this._device.queue.writeBuffer(this._paramsBuffer, 0, paramsView);
    this._device.queue.writeBuffer(this._togglesBuffer, 0, this._toggles);
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(GRID_SIZE / 8), Math.ceil(GRID_SIZE / 8));
    this._toggleCount = 0;
    ++this._step;
  }
}

export { GRID_SIZE };

function geometricProduct(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
    a[0] * b[2] + a[1] * b[3] + a[2] * b[0] - a[3] * b[1],
    a[0] * b[3] - a[1] * b[2] + a[2] * b[1] + a[3] * b[0]
  ];
}

function reverse(a) {
  return [a[0], -a[1], -a[2], -a[3]];
}

function createPoint(p) {
  return [0, 1, p[1], -p[0]];
}

function extractPoint(m) {
  return [-m[3] / m[1], m[2] / m[1]];
}

function applyMotor(pMultivector, m) {
  const rev = reverse(m);
  const pRev = geometricProduct(pMultivector, rev);
  return geometricProduct(m, pRev);
}

export function applyMotorToPoint(p, motor) {
  const pt = createPoint(p);
  const transformed = applyMotor(pt, motor);
  return extractPoint(transformed);
}

export function normalizeMotor(m) {
  const n = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]);
  if (n === 0) return [1, 0, 0, 0];
  return [m[0] / n, m[1] / n, m[2] / n, m[3] / n];
}

export function createTranslator(dx, dy) {
  return [1, 0, dx / 2, dy / 2];
}

{
  geometricProduct,
  reverse,
  createTranslator,
  normalizeMotor,
  applyMotorToPoint
};


class Camera {
  constructor() {
    this._pose = new Float32Array([1, 0, 0, 0, 1, 1]);
  }

  updatePose(motor) {
    this._pose[0] = motor[0];
    this._pose[1] = motor[1];
    this._pose[2] = motor[2];
    this._pose[3] = motor[3];
  }

  moveLeft(d) {
    const dt = PGA2D.createTranslator(-d, 0);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveRight(d) {
    const dt = PGA2D.createTranslator(d, 0);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveUp(d) {
    const dt = PGA2D.createTranslator(0, d);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  moveDown(d) {
    const dt = PGA2D.createTranslator(0, -d);
    const newpose = PGA2D.normalizeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }

  zoomIn() {
    this._pose[4] = Math.min(8, this._pose[4] * 1.1);
    this._pose[5] = Math.min(8, this._pose[5] * 1.1);
  }

  zoomOut() {
    this._pose[4] = Math.max(0.5, this._pose[4] / 1.1);
    this._pose[5] = Math.max(0.5, this._pose[5] / 1.1);
  }
}

class StandardTextObject {
  constructor(inputText, spacing = 5, textFont = "18px Arial") {
    this._textFont = textFont;
    this._lineSpacing = spacing;
    this._textCanvas = document.createElement("canvas");
    this._textContext = this._textCanvas.getContext("2d");
    this.updateTextRegion(inputText);
    this.updateText(inputText);
    this._textCanvas.style.position = "absolute";
    this._textCanvas.style.top = "10px";
    this._textCanvas.style.left = "10px";
    this._textCanvas.style.border = "1px solid red";
    document.body.appendChild(this._textCanvas);
  }

  updateTextRegion(newText) {
    this._textContext.font = this._textFont;
    this._lines = newText.split("\n");
    this._width = Math.max(...this._lines.map((line) => this._textContext.measureText(line).width));
    const match = this._textFont.match(/(\d+)px/);
    if (match) {
      this._fontSize = parseInt(match[1], 10);
    } else {
      this._fontSize = 18;
      this._textFont = "18px Arial";
    }
    this._height = this._lines.length * (this._fontSize + this._lineSpacing);
    this._paddingx = 5;
    this._paddingtop = 3;
    this._canvasWidth = Math.ceil(this._width + this._paddingx * 2);
    this._canvasHeight = Math.ceil(this._height + this._paddingtop);
    this._textCanvas.width = this._canvasWidth;
    this._textCanvas.height = this._canvasHeight;
    this._textContext.font = this._textFont;
    this._textContext.textBaseline = "top";
  }

  updateText(newText) {
    this._lines = newText.split("\n");
    this._textContext.fillStyle = "rgba(1, 1, 1, 0.5)";
    this._textContext.clearRect(0, 0, this._canvasWidth, this._canvasHeight);
    this._textContext.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
    this._textContext.fillStyle = "white";
    this._lines.forEach((line, idx) => {
      const x = this._paddingx;
      const y = this._paddingtop + idx * (this._fontSize + this._lineSpacing);
      this._textContext.fillText(line, x, y);
    });
  }

  toggleVisibility() {
    this._textCanvas.hidden = !this._textCanvas.hidden;
  }
}

class Renderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._objects = [];
    this._clearColor = { r: 0, g: 56/255, b: 101/255, a: 1 }; // Blue
  }

  async init() {
    if (!navigator.gpu) {
      throw Error("WebGPU is not supported in this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }
    this._device = await adapter.requestDevice();
    this._context = this._canvas.getContext("webgpu");
    this._canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._canvasFormat,
    });
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  resizeCanvas() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth * devicePixelRatio;
    const height = window.innerHeight * devicePixelRatio;
    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.style.width = `${window.innerWidth}px`;
    this._canvas.style.height = `${window.innerHeight}px`;
    this.render();
  }

  async appendSceneObject(obj) {
    await obj.init();
    this._objects.push(obj);
  }

  renderToSelectedView(outputView) {
    for (const obj of this._objects) {
      obj?.updateGeometry();
    }
    const encoder = this._device.createCommandEncoder();
    const hasCompute = this._objects.some((obj) => obj._computePipeline);
    if (hasCompute) {
      const computePass = encoder.beginComputePass();
      for (const obj of this._objects) {
        if (obj._computePipeline) obj.compute(computePass);
      }
      computePass.end();
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        clearValue: this._clearColor,
        loadOp: "clear",
        storeOp: "store",
      }]
    });
    for (const obj of this._objects) {
      obj?.render(pass);
    }
    pass.end();
    const commandBuffer = encoder.finish();
    this._device.queue.submit([commandBuffer]);
  }

  render() {
    this.renderToSelectedView(this._context.getCurrentTexture().createView());
  }
}


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
    "/lib/Shaders/optimized_questGrid.wgsl",
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