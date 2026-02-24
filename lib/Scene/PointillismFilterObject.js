import SceneObject from "./SceneObject.js";

export default class PointillismFilterObject extends SceneObject {
  constructor(device, canvasFormat) {
    super(device, canvasFormat, "../Shaders/filterPointillismPass1.wgsl");
    this._pass2ShaderFile = "./lib/Shaders/filterPointillismPass2.wgsl";
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
