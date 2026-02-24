@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> randValues: array<f32>;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let color = textureLoad(inTexture, uv, 0);
  let size = textureDimensions(inTexture);
  let i = uv.y * i32(size.x) + uv.x;
  var out = color;
  if (abs(randValues[i]) < 0.3) {
    out.r = max(min(color.r + randValues[i], 1.0), 0.0);
    out.g = max(min(color.g + randValues[i], 1.0), 0.0);
    out.b = max(min(color.b + randValues[i], 1.0), 0.0);
  }
  out.a = color.a;
  textureStore(outTexture, uv, out);
}
