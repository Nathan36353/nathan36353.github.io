@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var inSampler: sampler;

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) texCoords: vec2f
}

@vertex
fn vertexMain(@builtin(vertex_index) vIdx: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
    vec2f(1, -1), vec2f(1, 1), vec2f(-1, 1)
  );
  var texCoords = array<vec2f, 6>(
    vec2f(0, 1), vec2f(1, 1), vec2f(0, 0),
    vec2f(1, 1), vec2f(1, 0), vec2f(0, 0)
  );
  var out: VertexOutput;
  out.pos = vec4f(pos[vIdx], 0, 1);
  out.texCoords = texCoords[vIdx];
  return out;
}

@fragment
fn fragmentMain(@location(0) texCoords: vec2f) -> @location(0) vec4f {
  return textureSample(inTexture, inSampler, texCoords);
}
