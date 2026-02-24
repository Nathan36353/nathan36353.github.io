import SceneObject from "./SceneObject.js";

export default class ImageFilterObject extends SceneObject {
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
