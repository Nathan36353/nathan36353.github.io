@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> circles: array<vec4f>;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let dims = textureDimensions(inTexture);
  let uv = vec2f(f32(global_id.x), f32(global_id.y));
  let baseColor = textureLoad(inTexture, vec2i(global_id.xy), 0);
  let maxDim = max(f32(dims.x), f32(dims.y));
  var outColor = baseColor;
  for (var i = 0u; i < arrayLength(&circles); i++) {
    let c = circles[i];
    let center = c.xy * vec2f(f32(dims.x), f32(dims.y));
    let radius = c.z * maxDim;
    let dist = distance(uv, center);
    if (dist <= radius) {
      outColor = vec4f(c.w, c.w, c.w, 1.0);
      break;
    }
  }
  textureStore(outTexture, vec2i(global_id.xy), outColor);
}
