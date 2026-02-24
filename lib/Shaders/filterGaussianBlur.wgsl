@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let dims = textureDimensions(inTexture);
  let uv = vec2i(global_id.xy);
  var acc = vec4f(0.0, 0.0, 0.0, 0.0);
  var sumW = 0.0;
  let sigma = 1.5;
  let r = 2;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let x = clamp(i32(uv.x) + dx, 0, i32(dims.x) - 1);
      let y = clamp(i32(uv.y) + dy, 0, i32(dims.y) - 1);
      let d = f32(dx*dx + dy*dy);
      let w = exp(-d / (2.0 * sigma * sigma));
      sumW += w;
      acc += textureLoad(inTexture, vec2i(x, y), 0) * w;
    }
  }
  acc /= sumW;
  textureStore(outTexture, uv, acc);
}
