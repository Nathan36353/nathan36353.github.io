@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> circleData: array<vec4f>;
@group(0) @binding(2) var outTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2f(f32(global_id.x), f32(global_id.y));
  let baseColor = textureLoad(inTexture, vec2i(global_id.xy), 0);
  let numCircles = arrayLength(&circleData) / 2u;
  var outColor = baseColor;
  for (var i = 0u; i < numCircles; i++) {
    let center = circleData[i * 2u].xy;
    let radius = circleData[i * 2u].z;
    let dist = distance(uv, center);
    if (dist <= radius) {
      outColor = circleData[i * 2u + 1u];
      break;
    }
  }
  textureStore(outTexture, vec2i(global_id.xy), outColor);
}
