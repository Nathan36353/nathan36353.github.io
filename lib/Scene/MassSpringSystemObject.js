import SceneObject from "./SceneObject.js";

const FLOATS_PER_PARTICLE = 8; // p(2), v(2), dv(2), mass(1), dummy(1)
const FLOATS_PER_SPRING = 4;   // ptA, ptB, restLength, stiffness

export default class MassSpringSystemObject extends SceneObject {
  constructor(device, canvasFormat, shaderFile, size = 16) {
    super(device, canvasFormat, shaderFile);
    this._size = size;
    this._numParticles = this._size * this._size;
    this._numSprings = [
      this._size * Math.ceil((this._size - 1) / 2),
      this._size * Math.floor((this._size - 1) / 2),
      this._size * Math.ceil((this._size - 1) / 2),
      this._size * Math.floor((this._size - 1) / 2),
    ];
    this._step = 0;
  }

  resetParticles() {
    const edgeLength = 0.7;
    const delta = edgeLength / this._size;
    for (let j = 0; j < this._size; ++j) {
      for (let i = 0; i < this._size; ++i) {
        const idx = j * this._size + i;
        this._particles[FLOATS_PER_PARTICLE * idx + 0] = -0.25 + delta * i;
        this._particles[FLOATS_PER_PARTICLE * idx + 1] = 0.5 - delta * j;
        this._particles[FLOATS_PER_PARTICLE * idx + 2] = 0;
        this._particles[FLOATS_PER_PARTICLE * idx + 3] = 0;
        this._particles[FLOATS_PER_PARTICLE * idx + 4] = 0;
        this._particles[FLOATS_PER_PARTICLE * idx + 5] = 0;
        this._particles[FLOATS_PER_PARTICLE * idx + 6] = 0.0001 * this._numParticles;
        this._particles[FLOATS_PER_PARTICLE * idx + 7] = j === 0 ? 1 : 0;
      }
    }
  }

  resetSprings() {
    const edgeLength = 0.7;
    const delta = edgeLength / this._size;
    const stiffness = 12;
    let ysize = Math.ceil((this._size - 1) / 2);
    for (let j = 0; j < this._size; ++j) {
      for (let i = 0; i < ysize; ++i) {
        let idx = j * ysize + i;
        this._springs[0][FLOATS_PER_SPRING * idx + 0] = j * this._size + i * 2;
        this._springs[0][FLOATS_PER_SPRING * idx + 1] = j * this._size + i * 2 + 1;
        this._springs[0][FLOATS_PER_SPRING * idx + 2] = delta;
        this._springs[0][FLOATS_PER_SPRING * idx + 3] = stiffness;
        this._springs[2][FLOATS_PER_SPRING * idx + 0] = 2 * i * this._size + j;
        this._springs[2][FLOATS_PER_SPRING * idx + 1] = (2 * i + 1) * this._size + j;
        this._springs[2][FLOATS_PER_SPRING * idx + 2] = delta;
        this._springs[2][FLOATS_PER_SPRING * idx + 3] = stiffness;
      }
    }
    ysize = Math.floor((this._size - 1) / 2);
    for (let j = 0; j < this._size; ++j) {
      for (let i = 0; i < ysize; ++i) {
        let idx = j * ysize + i;
        this._springs[1][FLOATS_PER_SPRING * idx + 0] = j * this._size + i * 2 + 1;
        this._springs[1][FLOATS_PER_SPRING * idx + 1] = j * this._size + i * 2 + 2;
        this._springs[1][FLOATS_PER_SPRING * idx + 2] = delta;
        this._springs[1][FLOATS_PER_SPRING * idx + 3] = stiffness;
        this._springs[3][FLOATS_PER_SPRING * idx + 0] = (2 * i + 1) * this._size + j;
        this._springs[3][FLOATS_PER_SPRING * idx + 1] = (2 * i + 2) * this._size + j;
        this._springs[3][FLOATS_PER_SPRING * idx + 2] = delta;
        this._springs[3][FLOATS_PER_SPRING * idx + 3] = stiffness;
      }
    }
  }

  async createGeometry() {
    this._particles = new Float32Array(this._numParticles * FLOATS_PER_PARTICLE);
    this.resetParticles();

    this._particleBuffers = [
      this._device.createBuffer({
        label: "MassSpring particles 1 " + this.getName(),
        size: this._particles.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this._device.createBuffer({
        label: "MassSpring particles 2 " + this.getName(),
        size: this._particles.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
    this._device.queue.writeBuffer(this._particleBuffers[0], 0, this._particles);
    this._device.queue.writeBuffer(this._particleBuffers[1], 0, this._particles);

    this._springs = [
      new Float32Array(this._numSprings[0] * FLOATS_PER_SPRING),
      new Float32Array(this._numSprings[1] * FLOATS_PER_SPRING),
      new Float32Array(this._numSprings[2] * FLOATS_PER_SPRING),
      new Float32Array(this._numSprings[3] * FLOATS_PER_SPRING),
    ];
    this.resetSprings();

    this._springBuffers = [];
    for (let i = 0; i < 4; ++i) {
      this._springBuffers.push(
        this._device.createBuffer({
          label: "MassSpring springs " + i + " " + this.getName(),
          size: this._springs[i].byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
      );
      this._device.queue.writeBuffer(this._springBuffers[i], 0, this._springs[i]);
    }

    const springSegVerts = new Float32Array([0, 0, 1, 0]);
    this._springVertexBuffer = this._device.createBuffer({
      label: "Spring segment " + this.getName(),
      size: springSegVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._springVertexBuffer, 0, springSegVerts);

    const pi = Math.PI;
    const particleVerts = new Float32Array(18);
    for (let i = 0; i < 9; ++i) {
      const theta = (2 * pi * i) / 8;
      particleVerts[i * 2] = Math.cos(theta);
      particleVerts[i * 2 + 1] = Math.sin(theta);
    }
    this._particleVertexBuffer = this._device.createBuffer({
      label: "Particle circle " + this.getName(),
      size: particleVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._particleVertexBuffer, 0, particleVerts);
  }

  async createShaders() {
    await super.createShaders();
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "MassSpring Bind Group Layout " + this.getName(),
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      ],
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "MassSpring Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout],
    });

    // Fixed: buf0 = current state (update output), buf1 = accumulation target
    this._bindGroups = [];
    for (let g = 0; g < 4; ++g) {
      this._bindGroups.push(
        this._device.createBindGroup({
          layout: this._bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: this._particleBuffers[0] } },
            { binding: 1, resource: { buffer: this._particleBuffers[1] } },
            { binding: 2, resource: { buffer: this._springBuffers[g] } },
          ],
        })
      );
    }
    this._updateBindGroup = this._device.createBindGroup({
      layout: this._bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._particleBuffers[1] } },
        { binding: 1, resource: { buffer: this._particleBuffers[0] } },
        { binding: 2, resource: { buffer: this._springBuffers[0] } },
      ],
    });
    this._copyBindGroup = this._device.createBindGroup({
      layout: this._bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._particleBuffers[0] } },
        { binding: 1, resource: { buffer: this._particleBuffers[1] } },
        { binding: 2, resource: { buffer: this._springBuffers[0] } },
      ],
    });
  }

  async createRenderPipeline() {
    this._springPipeline = this._device.createRenderPipeline({
      label: "MassSpring spring render " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "springVertexMain",
        buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }] }],
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "springFragmentMain",
        targets: [{ format: this._canvasFormat }],
      },
      primitive: { topology: "line-strip" },
    });

    this._particlePipeline = this._device.createRenderPipeline({
      label: "MassSpring particle render " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "particleVertexMain",
        buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, format: "float32x2", offset: 0 }] }],
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "particleFragmentMain",
        targets: [{ format: this._canvasFormat }],
      },
      primitive: { topology: "line-strip" },
    });
  }

  async createComputePipeline() {
    this._copyPipeline = this._device.createComputePipeline({
      label: "MassSpring copy " + this.getName(),
      layout: this._pipelineLayout,
      compute: { module: this._shaderModule, entryPoint: "copyMain" },
    });
    this._computePipeline = this._device.createComputePipeline({
      label: "MassSpring compute " + this.getName(),
      layout: this._pipelineLayout,
      compute: { module: this._shaderModule, entryPoint: "computeMain" },
    });
    this._updatePipeline = this._device.createComputePipeline({
      label: "MassSpring update " + this.getName(),
      layout: this._pipelineLayout,
      compute: { module: this._shaderModule, entryPoint: "updateMain" },
    });
  }

  render(pass) {
    pass.setPipeline(this._springPipeline);
    for (let i = 0; i < 4; ++i) {
      if (this._numSprings[i] > 0) {
        pass.setBindGroup(0, this._bindGroups[i]);
        pass.setVertexBuffer(0, this._springVertexBuffer);
        pass.draw(2, this._numSprings[i]);
      }
    }
    pass.setPipeline(this._particlePipeline);
    pass.setBindGroup(0, this._bindGroups[0]);
    pass.setVertexBuffer(0, this._particleVertexBuffer);
    pass.draw(9, this._numParticles);
  }

  compute(pass) {
    pass.setPipeline(this._copyPipeline);
    pass.setBindGroup(0, this._copyBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 256));
    for (let i = 0; i < 4; ++i) {
      if (this._numSprings[i] > 0) {
        pass.setPipeline(this._computePipeline);
        pass.setBindGroup(0, this._bindGroups[i]);
        pass.dispatchWorkgroups(Math.ceil(this._numSprings[i] / 256));
      }
    }
    pass.setPipeline(this._updatePipeline);
    pass.setBindGroup(0, this._updateBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 256));
    ++this._step;
  }
}
