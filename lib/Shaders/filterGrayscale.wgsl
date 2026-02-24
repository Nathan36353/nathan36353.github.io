@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let c = textureLoad(inTexture, uv, 0);
  let gray = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  textureStore(outTexture, uv, vec4f(gray, gray, gray, c.a));
}
