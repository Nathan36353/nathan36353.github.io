const canvas = document.querySelector("#c");
if (!navigator.gpu) throw new Error("WebGPU not supported");

const rect = (x0, y0, x1, y1, r, g, b) => [
  x0, y0, r, g, b,  x1, y0, r, g, b,  x1, y1, r, g, b,
  x0, y0, r, g, b,  x1, y1, r, g, b,  x0, y1, r, g, b
];

const tri = (ax, ay, bx, by, cx, cy, r, g, b) => [
  ax, ay, r, g, b,
  bx, by, r, g, b,
  cx, cy, r, g, b
];

const circle = (cx, cy, rad, segs, r, g, b) => {
  const o = [];
  for (let i = 0; i < segs; i++) {
    const a1 = Math.PI * 2 * i / segs;
    const a2 = Math.PI * 2 * (i + 1) / segs;
    o.push(...tri(
      cx, cy,
      cx + Math.cos(a1) * rad, cy + Math.sin(a1) * rad,
      cx + Math.cos(a2) * rad, cy + Math.sin(a2) * rad,
      r, g, b
    ));
  }
  return o;
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No adapter");
  const device = await adapter.requestDevice();

  const ctx = canvas.getContext("webgpu");
  const fmt = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format: fmt, alphaMode: "opaque" });

  const shader = `
struct O{ @builtin(position) p:vec4f,@location(0)c:vec3f }
@vertex fn v(@location(0)p:vec2f,@location(1)c:vec3f)->O{
  var o:O;
  o.p=vec4f(p.x,-p.y,0,1);
  o.c=c;
  return o;
}
@fragment fn f(@location(0)c:vec3f)->@location(0)vec4f{ return vec4f(c,1); }
`;

  const pipe = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "v",
      buffers: [{
        arrayStride: 20,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x2" },
          { shaderLocation: 1, offset: 8, format: "float32x3" }
        ]
      }]
    },
    fragment: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "f",
      targets: [{ format: fmt }]
    },
    primitive: { topology: "triangle-list" }
  });

  const staticV = [];

  staticV.push(...rect(-1, -1, 1, 0.15, 0.02, 0.2, 0.35));
  staticV.push(...rect(-1, 0.15, 1, 1, 0.08, 0.45, 0.2));

  staticV.push(...rect(-0.15, 0.15, 0.35, 0.55, 0.55, 0.33, 0.18));
  staticV.push(...tri(-0.22, 0.15, 0.42, 0.15, 0.1, -0.1, 0.35, 0.16, 0.1));
  staticV.push(...rect(0.02, 0.3, 0.12, 0.55, 0.2, 0.12, 0.08));
  staticV.push(...rect(0.2, 0.28, 0.32, 0.4, 0.65, 0.85, 1));

  const tree = (x) => {
    staticV.push(...rect(x - 0.03, 0.35, x + 0.03, 0.6, 0.3, 0.18, 0.1));
    staticV.push(...tri(x - 0.14, 0.4, x + 0.14, 0.4, x, 0.1, 0.05, 0.3, 0.12));
    staticV.push(...tri(x - 0.12, 0.28, x + 0.12, 0.28, x, 0.02, 0.06, 0.35, 0.14));
  };
  tree(-0.6);
  tree(0.7);

  const staticBuf = device.createBuffer({
    size: staticV.length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(staticBuf, 0, new Float32Array(staticV));

  const maxDynFloats = 4096;
  const dynBuf = device.createBuffer({
    size: maxDynFloats * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });

  const daySky = [0.45, 0.75, 1.0];
  const nightSky = [0.02, 0.03, 0.08];

  const t0 = performance.now();

  function frame() {
    const t = (performance.now() - t0) / 1000;

    const cycle = 12;
    const p = (t % cycle) / cycle;

    const isDay = p < 0.5;
    const local = isDay ? (p / 0.5) : ((p - 0.5) / 0.5);

    const x = mix(-1.2, 1.2, local);
    const y = -0.65;

    const skyBlend = isDay
      ? smoothstep(0.0, 0.25, local) * (1 - smoothstep(0.85, 1.0, local))
      : 0;

    const sky = isDay ? mix3(nightSky, daySky, skyBlend) : nightSky;

    const dynV = [];

    if (isDay) {
      dynV.push(...circle(x, y, 0.12, 28, 1.0, 0.88, 0.18));
      const rayCount = 10;
      for (let i = 0; i < rayCount; i++) {
        const a = Math.PI * 2 * i / rayCount + t * 0.1;
        dynV.push(...tri(
          x + Math.cos(a) * 0.15, y + Math.sin(a) * 0.15,
          x + Math.cos(a + 0.18) * 0.15, y + Math.sin(a + 0.18) * 0.15,
          x + Math.cos(a + 0.09) * 0.24, y + Math.sin(a + 0.09) * 0.24,
          1.0, 0.78, 0.12
        ));
      }
    } else {
      dynV.push(...circle(x, y, 0.11, 32, 0.92, 0.92, 0.98));
      dynV.push(...circle(x + 0.05, y + 0.02, 0.095, 32, nightSky[0], nightSky[1], nightSky[2]));
    }

    device.queue.writeBuffer(dynBuf, 0, new Float32Array(dynV));

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: sky[0], g: sky[1], b: sky[2], a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }]
    });

    pass.setPipeline(pipe);

    pass.setVertexBuffer(0, staticBuf);
    pass.draw(staticV.length / 5);

    pass.setVertexBuffer(0, dynBuf);
    pass.draw(dynV.length / 5);

    pass.end();
    device.queue.submit([enc.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
