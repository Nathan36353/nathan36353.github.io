import Renderer from "./2DRenderer.js";

export default class FilteredRenderer extends Renderer {
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
    const blitShaderUrl = "./lib/Shaders/blitTexture.wgsl";
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
