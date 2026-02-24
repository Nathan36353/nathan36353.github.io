import SceneObject from "./SceneObject.js";

export default class Standard2DFullScreenObject extends SceneObject {
  constructor(device, canvasFormat, img) {
    super(device, canvasFormat, "./lib/Shaders/fullscreenTexture.wgsl");
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
