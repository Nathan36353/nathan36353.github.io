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


class ImageFilterObject extends SceneObject {
  constructor(device, canvasFormat, shaderFile) {
    super(device, canvasFormat, shaderFile);
  }

  async createGeometry() {}

  updateGeometry() {}

  async createRenderPipeline() {}

  render(pass) {}

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Image Filter Pipeline " + this.getName(),
      layout: "auto",
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  createBindGroup(inTexture, outTexture) {
    this._bindGroup = this._device.createBindGroup({
      label: "Image Filter Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inTexture.createView() },
        { binding: 1, resource: outTexture.createView() }
      ]
    });
    this._wgWidth = Math.ceil(inTexture.width / 8);
    this._wgHeight = Math.ceil(inTexture.height / 8);
  }

  compute(pass) {
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.dispatchWorkgroups(this._wgWidth, this._wgHeight);
  }
}


class FilteredRenderer extends Renderer {
  constructor(canvas) {
    super(canvas);
    this._filters = [];
    this._sceneTargetFormat = "rgba8unorm";
  }

  async init() {
    await super.init();
    await this._createBlitPipeline();
    this.resizeCanvas();
  }

  async _createBlitPipeline() {
    const blitShaderUrl = "/lib/Shaders/optimized_blitTexture.wgsl";
    const code = await new Promise((resolve, reject) => {
      const xhttp = new XMLHttpRequest();
      xhttp.open("GET", blitShaderUrl);
      xhttp.setRequestHeader("Cache-Control", "no-cache, no-store, max-age=0");
      xhttp.onload = () => (xhttp.status === 200 ? resolve(xhttp.responseText) : reject(new Error(xhttp.statusText)));
      xhttp.onerror = () => reject(new Error("Failed to load blit shader"));
      xhttp.send();
    });
    const module = this._device.createShaderModule({ label: "Blit", code });
    this._blitPipeline = this._device.createRenderPipeline({
      label: "Blit Pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vertexMain" },
      fragment: {
        module,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      }
    });
    this._blitSampler = this._device.createSampler({
      magFilter: "linear",
      minFilter: "linear"
    });
  }

  resizeCanvas() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * devicePixelRatio));
    const height = Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));
    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.style.width = `${window.innerWidth}px`;
    this._canvas.style.height = `${window.innerHeight}px`;

    const descriptor = {
      size: [width, height, 1],
      format: this._sceneTargetFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING
    };
    this._tex0 = this._device.createTexture({ label: "FilterTex0", ...descriptor });
    this._tex1 = this._device.createTexture({ label: "FilterTex1", ...descriptor });

    if (this._blitPipeline && this.render) this.render();
  }

  async appendFilterObject(obj) {
    await obj.init();
    this._filters.push(obj);
  }

  render() {
    const width = this._canvas.width;
    const height = this._canvas.height;
    if (!width || !height || !this._tex0 || !this._tex1 || !this._blitPipeline) return;

    for (const obj of this._objects) obj?.updateGeometry();

    let readTex = this._tex0;
    let writeTex = this._tex1;

    const encoder = this._device.createCommandEncoder();

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [{
        view: readTex.createView(),
        clearValue: this._clearColor,
        loadOp: "clear",
        storeOp: "store"
      }]
    });
    for (const obj of this._objects) obj?.render(scenePass);
    scenePass.end();

    for (const filter of this._filters) {
      filter.createBindGroup(readTex, writeTex);
      const computePass = encoder.beginComputePass();
      filter.compute(computePass);
      computePass.end();
      [readTex, writeTex] = [writeTex, readTex];
    }

    const blitBindGroup = this._device.createBindGroup({
      layout: this._blitPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: readTex.createView() },
        { binding: 1, resource: this._blitSampler }
      ]
    });

    const presentPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this._context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }]
    });
    presentPass.setPipeline(this._blitPipeline);
    presentPass.setBindGroup(0, blitBindGroup);
    presentPass.draw(6, 1, 0, 0);
    presentPass.end();

    this._device.queue.submit([encoder.finish()]);
  }
}


class Standard2DFullScreenObject extends SceneObject {
  constructor(device, canvasFormat, img) {
    super(device, canvasFormat, "/lib/Shaders/optimized_fullscreenTexture.wgsl");
    this._img = new Image();
    this._img.src = img;
  }

  async createGeometry() {
    await this._img.decode();
    this._bitmap = await createImageBitmap(this._img);

    this._texture = this._device.createTexture({
      label: "Texture " + this.getName(),
      size: [this._bitmap.width, this._bitmap.height, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    this._device.queue.copyExternalImageToTexture(
      { source: this._bitmap },
      { texture: this._texture },
      [this._bitmap.width, this._bitmap.height]
    );

    this._sampler = this._device.createSampler({
      magFilter: "linear",
      minFilter: "linear"
    });
  }

  updateGeometry() {}

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Render Pipeline " + this.getName(),
      layout: "auto",
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain"
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      }
    });

    this._bindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this._texture.createView() },
        { binding: 1, resource: this._sampler }
      ]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(6, 1, 0, 0);
  }

  async createComputePipeline() {}

  compute(pass) {}
}


function makeCircleVertices(segments) {
  const v = [];
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2;
    const t1 = ((i + 1) / segments) * Math.PI * 2;
    v.push(0, 0, Math.cos(t0), Math.sin(t0), Math.cos(t1), Math.sin(t1));
  }
  return new Float32Array(v);
}

class PosedCircleObject extends SceneObject {
  constructor(device, canvasFormat, radius, colorR, colorG, colorB, shaderFile = "/lib/Shaders/optimized_circlePoseColor.wgsl") {
    super(device, canvasFormat, shaderFile);
    this._radius = radius;
    this._segments = 32;
    this._vertices = makeCircleVertices(this._segments);
    this._uniform = new Float32Array(12);
    this.setPose(1, 0, 0, 0, radius, radius, 0, 0);
    this.setColor(colorR, colorG, colorB, 1);
  }

  setPose(rotorC, rotorS, tx, ty, scaleX, scaleY, rcx, rcy) {
    this._uniform[0] = rotorC;
    this._uniform[1] = rotorS;
    this._uniform[2] = tx;
    this._uniform[3] = ty;
    this._uniform[4] = scaleX;
    this._uniform[5] = scaleY;
    this._uniform[6] = rcx ?? 0;
    this._uniform[7] = rcy ?? 0;
  }

  setColor(r, g, b, a = 1) {
    this._uniform[8] = r;
    this._uniform[9] = g;
    this._uniform[10] = b;
    this._uniform[11] = a;
  }

  setTranslation(tx, ty) {
    this._uniform[2] = tx;
    this._uniform[3] = ty;
  }

  setRotation(angle) {
    this._uniform[0] = Math.cos(angle);
    this._uniform[1] = -Math.sin(angle);
  }

  setScale(sx, sy) {
    this._uniform[4] = sx;
    this._uniform[5] = sy ?? sx;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Circle " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._uniformBuffer = this._device.createBuffer({
      label: "Uniform " + this.getName(),
      size: this._uniform.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._uniformBuffer)
      this._device.queue.writeBuffer(this._uniformBuffer, 0, this._uniform);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Circle " + this.getName(),
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
      primitive: { topology: "triangle-list" }
    });
    this._bindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._uniformBuffer } }]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this._vertices.length / 2, 1, 0, 0);
  }

  async createComputePipeline() {}
  compute(pass) {}
}


function makeEllipseVertices(a, b, segments) {
  const v = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    v.push(a * Math.cos(t), b * Math.sin(t));
  }
  return new Float32Array(v);
}

class OrbitPathObject extends SceneObject {
  constructor(device, canvasFormat, radiusOrA, b, shaderFile = "/lib/Shaders/optimized_solidColor.wgsl") {
    super(device, canvasFormat, shaderFile);
    this._b = b ?? radiusOrA;
    this._a = radiusOrA;
    this._vertices = makeEllipseVertices(this._a, this._b, 64);
    this._color = new Float32Array([0.3, 0.35, 0.4, 0.6]);
  }

  setColor(r, g, b, a) {
    this._color[0] = r;
    this._color[1] = g;
    this._color[2] = b;
    this._color[3] = a ?? 1;
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      label: "Orbit " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    this._vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
    };
    this._colorBuffer = this._device.createBuffer({
      label: "Color " + this.getName(),
      size: this._color.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.updateGeometry();
  }

  updateGeometry() {
    if (this._colorBuffer)
      this._device.queue.writeBuffer(this._colorBuffer, 0, this._color);
  }

  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Orbit " + this.getName(),
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
      primitive: { topology: "line-strip" }
    });
    this._bindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this._colorBuffer } }]
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this._vertices.length / 2, 1, 0, 0);
  }

  async createComputePipeline() {}
  compute(pass) {}
}


class PointillismFilterObject extends SceneObject {
  constructor(device, canvasFormat) {
    super(device, canvasFormat, "/lib/Shaders/optimized_filterPointillismPass1.wgsl");
    this._pass2ShaderFile = "/lib/Shaders/optimized_filterPointillismPass2.wgsl";
  }

  async createGeometry() {}

  async createShaders() {
    const code1 = await this.loadShader(this._shaderFile);
    const code2 = await this.loadShader(this._pass2ShaderFile);
    this._shaderModule1 = this._device.createShaderModule({ label: "PointillismPass1", code: code1 });
    this._shaderModule2 = this._device.createShaderModule({ label: "PointillismPass2", code: code2 });
  }

  async createRenderPipeline() {}

  render(pass) {}

  async createComputePipeline() {
    this._computePipeline1 = this._device.createComputePipeline({
      label: "Pointillism Pass1",
      layout: "auto",
      compute: { module: this._shaderModule1, entryPoint: "computeMain" }
    });
    this._computePipeline2 = this._device.createComputePipeline({
      label: "Pointillism Pass2",
      layout: "auto",
      compute: { module: this._shaderModule2, entryPoint: "computeMain" }
    });
  }

  createBindGroup(inTexture, outTexture) {
    const w = inTexture.width;
    const h = inTexture.height;
    const maxDim = Math.max(w, h);
    let numCircles = Math.floor(0.03 * w * h);
    numCircles = Math.min(numCircles, 8000);

    if (!this._randomIndices || this._numCircles !== numCircles) {
      this._numCircles = numCircles;
      this._randomIndices = new Uint32Array(numCircles);
      this._randomRadii = new Float32Array(numCircles);
      this._circleData = new Float32Array(numCircles * 8);
      const totalPixels = w * h;
      for (let i = 0; i < numCircles; i++) {
        this._randomIndices[i] = Math.floor(Math.random() * totalPixels);
        this._randomRadii[i] = 0.01 + Math.random() * 0.09;
      }
      this._indicesBuffer = this._device.createBuffer({
        label: "Pointillism indices",
        size: this._randomIndices.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this._radiiBuffer = this._device.createBuffer({
        label: "Pointillism radii",
        size: this._randomRadii.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      this._circleBuffer = this._device.createBuffer({
        label: "Pointillism circles",
        size: this._circleData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
    }
    this._device.queue.writeBuffer(this._indicesBuffer, 0, this._randomIndices);
    this._device.queue.writeBuffer(this._radiiBuffer, 0, this._randomRadii);

    this._bindGroup1 = this._device.createBindGroup({
      layout: this._computePipeline1.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inTexture.createView() },
        { binding: 1, resource: { buffer: this._indicesBuffer } },
        { binding: 2, resource: { buffer: this._radiiBuffer } },
        { binding: 3, resource: { buffer: this._circleBuffer } }
      ]
    });
    this._bindGroup2 = this._device.createBindGroup({
      layout: this._computePipeline2.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inTexture.createView() },
        { binding: 1, resource: { buffer: this._circleBuffer } },
        { binding: 2, resource: outTexture.createView() }
      ]
    });
    this._wgWidth = Math.ceil(w / 8);
    this._wgHeight = Math.ceil(h / 8);
    this._wgPass1 = Math.ceil(numCircles / 64);
  }

  compute(pass) {
    pass.setPipeline(this._computePipeline1);
    pass.setBindGroup(0, this._bindGroup1);
    pass.dispatchWorkgroups(this._wgPass1, 1, 1);
    pass.setPipeline(this._computePipeline2);
    pass.setBindGroup(0, this._bindGroup2);
    pass.dispatchWorkgroups(this._wgWidth, this._wgHeight);
  }
}


function LinearInterpolate(A, B, t) {
  return A * (1 - t) + B * t;
}

function easeInEaseOut(t) {
  if (t > 0.5) return t * (4 - 2 * t) - 1;
  return 2 * t * t;
}

async function init() {
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new FilteredRenderer(canvasTag);
  await renderer.init();

  const sceneFormat = renderer._sceneTargetFormat || renderer._canvasFormat;

  try {
    await renderer.appendSceneObject(new Standard2DFullScreenObject(renderer._device, sceneFormat, "/assets/space.png"));
  } catch (_) {}

  const orbitRadii = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92];
  const planetSizes = [0.025, 0.02, 0.022, 0.02, 0.035, 0.03, 0.025, 0.024];
  const planetColors = [
    [0.7, 0.6, 0.5], [0.8, 0.5, 0.2], [0.2, 0.5, 0.8], [0.9, 0.3, 0.2],
    [0.85, 0.6, 0.2], [0.9, 0.85, 0.5], [0.5, 0.7, 0.95], [0.4, 0.5, 0.9]
  ];
  const speeds = [0.4, 0.32, 0.26, 0.22, 0.18, 0.15, 0.12, 0.1];
  const orbits = [];
  const planets = [];

  for (let i = 0; i < 8; i++) {
    const a = orbitRadii[i];
    const b = i === 2 ? a * 0.92 : a;
    const orbit = new OrbitPathObject(renderer._device, sceneFormat, a, b);
    await renderer.appendSceneObject(orbit);
    orbits.push(orbit);
    const [r, g, blue] = planetColors[i];
    const planet = new PosedCircleObject(renderer._device, sceneFormat, planetSizes[i], r, g, blue);
    planet.setPose(1, 0, a, 0, planetSizes[i], planetSizes[i], 0, 0);
    await renderer.appendSceneObject(planet);
    planets.push({ obj: planet, angle: Math.random() * 6, speed: speeds[i], a, b, elliptical: i === 2 });
  }

  const sun = new PosedCircleObject(renderer._device, sceneFormat, 0.06, 1, 0.95, 0.4);
  sun.setPose(1, 0, 0, 0, 0.06, 0.06, 0, 0);
  await renderer.appendSceneObject(sun);

  const moonOrbitRadius = 0.06;
  const moonAngle = 0;
  const moonSpeed = 1.2;
  const moon = new PosedCircleObject(renderer._device, sceneFormat, 0.012, 0.75, 0.75, 0.75);
  await renderer.appendSceneObject(moon);

  await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "/lib/Shaders/optimized_filterCopy.wgsl"));
  // Uncomment to apply image-processing filters (grayscale, blur, pointillism):
  // await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "/lib/Shaders/optimized_filterGrayscale.wgsl"));
  // await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "/lib/Shaders/optimized_filterGaussianBlur.wgsl"));
  // await renderer.appendFilterObject(new PointillismFilterObject(renderer._device, renderer._canvasFormat));

  let time = 0;
  function animate() {
    time += 0.016;

    for (let i = 0; i < 8; i++) {
      const p = planets[i];
      p.angle += p.speed * 0.016;
      const px = p.elliptical ? p.a * Math.cos(p.angle) : p.a * Math.cos(p.angle);
      const py = p.elliptical ? p.b * Math.sin(p.angle) : p.a * Math.sin(p.angle);
      p.obj.setTranslation(px, py);
      if (i === 0) p.obj.setRotation(time * 0.8);
    }

    const planet0 = planets[0];
    const px0 = planet0.a * Math.cos(planet0.angle);
    const py0 = planet0.a * Math.sin(planet0.angle);
    const moonAng = planet0.angle * 5 + time * moonSpeed;
    moon.setTranslation(px0 + moonOrbitRadius * Math.cos(moonAng), py0 + moonOrbitRadius * Math.sin(moonAng));

    renderer.render();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  console.log("Quest: Solar system + filters (grayscale, blur, pointillism)");
  return renderer;
}

init().then(ret => {
  console.log(ret);
}).catch(error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) canvas.remove();
});