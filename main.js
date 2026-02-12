import Renderer from '/lib/Viz/2DRenderer.js';
import Triangle1 from '/lib/Scene/Triangle1.js';
import Triangle2 from '/lib/Scene/Triangle2.js';

async function init() {
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new Renderer(canvasTag);
  await renderer.init();

  await renderer.appendSceneObject(new Triangle1(renderer._device, renderer._canvasFormat));
  await renderer.appendSceneObject(new Triangle2(renderer._device, renderer._canvasFormat));

  renderer.render();
  return renderer;
}

init().then(ret => {
  console.log(ret);
}).catch(error => {
  const pTag = document.createElement('p');
  pTag.innerHTML = navigator.userAgent + "</br>" + error.message;
  document.body.appendChild(pTag);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) canvas.remove();
});
