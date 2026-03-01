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


const FLOATS_PER_PARTICLE = 9; // p(2), ip(2), v(2), iv(2), life(1)

class FlameParticleObject extends SceneObject {
  constructor(device, canvasFormat, shaderFile, numParticles = 4096) {
    super(device, canvasFormat, shaderFile);
    this._numParticles = numParticles;
    this._step = 0;
  }

  resetParticles() {
    for (let i = 0; i < this._numParticles; i++) {
      const x = (Math.random() - 0.5) * 0.18;
      const y = -0.88;
      const vx = (Math.random() - 0.5) * 0.001;
      const vy = 0.005 + Math.random() * 0.004;
      const life = 0.3 + Math.random() * 0.7;
      const base = i * FLOATS_PER_PARTICLE;
      this._particles[base + 0] = x;
      this._particles[base + 1] = y;
      this._particles[base + 2] = x;
      this._particles[base + 3] = y;
      this._particles[base + 4] = vx;
      this._particles[base + 5] = vy;
      this._particles[base + 6] = vx;
      this._particles[base + 7] = vy;
      this._particles[base + 8] = life;
    }
  }

  async createGeometry() {
    this._particles = new Float32Array(this._numParticles * FLOATS_PER_PARTICLE);
    this.resetParticles();

    const quadVerts = new Float32Array([
      0, 0,
      1, 0, 0.707, 0.707, 0, 1, -0.707, 0.707, -1, 0, -0.707, -0.707, 0, -1, 0.707, -0.707
    ]);
    const quadIndices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 1
    ]);

    this._vertexBuffer = this._device.createBuffer({
      label: "Flame quad vertices " + this.getName(),
      size: quadVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, quadVerts);

    this._indexBuffer = this._device.createBuffer({
      label: "Flame quad indices " + this.getName(),
      size: quadIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._indexBuffer, 0, quadIndices);

    const bufferSize = this._particles.byteLength;
    this._particleBuffers = [
      this._device.createBuffer({
        label: "Flame particles 1 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }),
      this._device.createBuffer({
        label: "Flame particles 2 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    ];
    this._device.queue.writeBuffer(this._particleBuffers[0], 0, this._particles);
    this._device.queue.writeBuffer(this._particleBuffers[1], 0, this._particles);
  }

  async createRenderPipeline() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Flame Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Flame Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout]
    });
    this._bindGroups = [
      this._device.createBindGroup({
        label: "Flame Bind 1 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[0] } },
          { binding: 1, resource: { buffer: this._particleBuffers[1] } }
        ]
      }),
      this._device.createBindGroup({
        label: "Flame Bind 2 " + this.getName(),
        layout: this._bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[1] } },
          { binding: 1, resource: { buffer: this._particleBuffers[0] } }
        ]
      })
    ];
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Flame Render " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexMain",
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }]
        }]
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{
          format: this._canvasFormat,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
          }
        }]
      },
      primitive: { topology: "triangle-list" }
    });
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.setIndexBuffer(this._indexBuffer, "uint16");
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.drawIndexed(24, this._numParticles);
  }

  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "Flame Compute " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain"
      }
    });
  }

  compute(pass) {
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 64), 1, 1);
    ++this._step;
  }
}

/**
 * Quest 4: Enchanted Symphony of Motion — Flame effect
 * Loaded as SOURCE (not obfuscated) until you're ready to seal.
 */

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