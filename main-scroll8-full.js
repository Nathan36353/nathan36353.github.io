class PolygonIO {
  static load(path) {
    return new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.open("GET", path);
      xhttp.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
      xhttp.onload = function () {
        if (xhttp.readyState === XMLHttpRequest.DONE && xhttp.status === 200) {
          const lines = xhttp.responseText.split(/\r?\n/);
          const vertices = [];
          for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const parts = line.split(/\s+/);
            if (parts.length < 2) continue;
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            if (!Number.isNaN(x) && !Number.isNaN(y)) {
              vertices.push([x, y]);
            }
          }
          resolve(vertices);
        } else {
          reject({ status: xhttp.status, statusText: xhttp.statusText });
        }
      };
      xhttp.onerror = function () {
        reject({ status: xhttp.status, statusText: xhttp.statusText });
      };
      xhttp.send();
    });
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
    // Recompute text region so the canvas resizes when content grows.
    this.updateTextRegion(newText);
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


class Polygon {
  constructor(vertices) {
    // vertices: Array<[x, y]>, may include duplicate last = first
    this._rawVertices = vertices.slice();
    this._vertices = this._normalize(vertices);
  }

  static async load(path) {
    const verts = await PolygonIO.load(path);
    return new Polygon(verts);
  }

  _normalize(vertices) {
    if (vertices.length < 3) {
      return new Float32Array(0);
    }
    const n = vertices.length;
    const lastIdx = (vertices[0][0] === vertices[n - 1][0] && vertices[0][1] === vertices[n - 1][1])
      ? n - 1
      : n;
    let area2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < lastIdx; i++) {
      const [x0, y0] = vertices[i];
      const [x1, y1] = vertices[(i + 1) % lastIdx];
      const cross = x0 * y1 - x1 * y0;
      area2 += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    const area = area2 / 2;
    const sign = area >= 0 ? 1 : -1;
    const absArea = Math.abs(area) || 1;
    const scale = 1 / Math.sqrt(absArea);
    cx = cx / (3 * area2 || 1);
    cy = cy / (3 * area2 || 1);

    const out = [];
    for (let i = 0; i < lastIdx; i++) {
      const [x, y] = vertices[i];
      const nx = (x - cx) * scale * sign;
      const ny = (y - cy) * scale * sign;
      out.push(nx, ny);
    }
    // close the loop
    out.push(out[0], out[1]);
    return new Float32Array(out);
  }

  get vertexData() {
    return this._vertices;
  }

  get vertexCount() {
    return this._vertices.length / 2;
  }

  get edgeCount() {
    return Math.max(0, this.vertexCount - 1);
  }

  isInsideConvex(point) {
    const px = point[0];
    const py = point[1];
    const v = this._vertices;
    const n = this.vertexCount - 1;
    if (n < 3) return false;
    for (let i = 0; i < n; i++) {
      const x0 = v[2 * i];
      const y0 = v[2 * i + 1];
      const x1 = v[2 * ((i + 1) % n)];
      const y1 = v[2 * ((i + 1) % n) + 1];
      const cross = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
      if (cross < 0) return false;
    }
    return true;
  }

  isInsideWinding(point) {
    const px = point[0];
    const py = point[1];
    const v = this._vertices;
    const n = this.vertexCount;
    let wn = 0;
    for (let i = 0; i < n - 1; i++) {
      const x0 = v[2 * i];
      const y0 = v[2 * i + 1];
      const x1 = v[2 * (i + 1)];
      const y1 = v[2 * (i + 1) + 1];
      if (y0 <= py) {
        if (y1 > py) {
          const isLeft = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
          if (isLeft > 0) wn++;
        }
      } else {
        if (y1 <= py) {
          const isLeft = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
          if (isLeft < 0) wn--;
        }
      }
    }
    return wn !== 0;
  }
}


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


class Standard2DVertexObject extends SceneObject {
  constructor(device, canvasFormat, vertices, shaderFile, topology) {
    super(device, canvasFormat, shaderFile);
    this._vertices = vertices;
    this._topology = topology;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [{
        shaderLocation: 0,
        format: "float32x2",
        offset: 0,
      }],
    };
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
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this._vertices.length / 2);
  }

  async createComputePipeline() {}

  compute(pass) {}
}


class PolygonObject extends Standard2DVertexObject {
  constructor(device, canvasFormat, polygon) {
    const vertices = polygon.vertexData;
    super(device, canvasFormat, vertices, "./lib/Shaders/standard2d.wgsl", "line-strip");
    this._polygon = polygon;
  }

  static async create(device, canvasFormat, path) {
    const poly = await Polygon.load(path);
    return new PolygonObject(device, canvasFormat, poly);
  }

  get polygon() {
    return this._polygon;
  }
}



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
