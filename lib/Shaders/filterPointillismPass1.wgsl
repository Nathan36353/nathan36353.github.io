@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> randomIndices: array<u32>;
@group(0) @binding(2) var<storage, read> randomRadii: array<f32>;
@group(0) @binding(3) var<storage, read_write> circleData: array<vec4f>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let i = global_id.x;
  let dims = textureDimensions(inTexture);
  let w = dims.x;
  let h = dims.y;
  let idx = randomIndices[i];
  let x = idx % w;
  let y = idx / w;
  let color = textureLoad(inTexture, vec2i(i32(x), i32(y)), 0);
  let maxDim = max(f32(w), f32(h));
  let radius = randomRadii[i] * maxDim;
  circleData[i * 2u] = vec4f(f32(x), f32(y), radius, 0.0);
  circleData[i * 2u + 1u] = color;
}
