import FilteredRenderer from './lib/Viz/FilteredRenderer.js';
import ImageFilterObject from './lib/Scene/ImageFilterObject.js';
import Standard2DFullScreenObject from './lib/Scene/Standard2DFullScreenObject.js';
import PosedCircleObject from './lib/Scene/PosedCircleObject.js';
import OrbitPathObject from './lib/Scene/OrbitPathObject.js';
import PointillismFilterObject from './lib/Scene/PointillismFilterObject.js';

function LinearInterpolate(A, B, t) {
  return A * (1 - t) + B * t;
}

function easeInEaseOut(t) {
  if (t > 0.5) return t * (4 - 2 * t) - 1;
  return 2 * t * t;
}

async function init() {
  const canvasTag = document.createElement('canvas');
  canvasTag.id = "renderCanvas";
  document.body.appendChild(canvasTag);

  const renderer = new FilteredRenderer(canvasTag);
  await renderer.init();

  const sceneFormat = renderer._sceneTargetFormat || renderer._canvasFormat;

  try {
    await renderer.appendSceneObject(new Standard2DFullScreenObject(renderer._device, sceneFormat, "/assets/space.png"));
  } catch (_) {}

  const orbitRadii = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92];
  const planetSizes = [0.025, 0.02, 0.022, 0.02, 0.035, 0.03, 0.025, 0.024];
  const planetColors = [
    [0.7, 0.6, 0.5], [0.8, 0.5, 0.2], [0.2, 0.5, 0.8], [0.9, 0.3, 0.2],
    [0.85, 0.6, 0.2], [0.9, 0.85, 0.5], [0.5, 0.7, 0.95], [0.4, 0.5, 0.9]
  ];
  const speeds = [0.4, 0.32, 0.26, 0.22, 0.18, 0.15, 0.12, 0.1];
  const orbits = [];
  const planets = [];

  for (let i = 0; i < 8; i++) {
    const a = orbitRadii[i];
    const b = i === 2 ? a * 0.92 : a;
    const orbit = new OrbitPathObject(renderer._device, sceneFormat, a, b);
    await renderer.appendSceneObject(orbit);
    orbits.push(orbit);
    const [r, g, blue] = planetColors[i];
    const planet = new PosedCircleObject(renderer._device, sceneFormat, planetSizes[i], r, g, blue);
    planet.setPose(1, 0, a, 0, planetSizes[i], planetSizes[i], 0, 0);
    await renderer.appendSceneObject(planet);
    planets.push({ obj: planet, angle: Math.random() * 6, speed: speeds[i], a, b, elliptical: i === 2 });
  }

  const sun = new PosedCircleObject(renderer._device, sceneFormat, 0.06, 1, 0.95, 0.4);
  sun.setPose(1, 0, 0, 0, 0.06, 0.06, 0, 0);
  await renderer.appendSceneObject(sun);

  const moonOrbitRadius = 0.06;
  const moonAngle = 0;
  const moonSpeed = 1.2;
  const moon = new PosedCircleObject(renderer._device, sceneFormat, 0.012, 0.75, 0.75, 0.75);
  await renderer.appendSceneObject(moon);

  await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "./lib/Shaders/filterCopy.wgsl"));
  // Uncomment to apply image-processing filters (grayscale, blur, pointillism):
  // await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "/lib/Shaders/filterGrayscale.wgsl"));
  // await renderer.appendFilterObject(new ImageFilterObject(renderer._device, renderer._canvasFormat, "./lib/Shaders/filterGaussianBlur.wgsl"));
  // await renderer.appendFilterObject(new PointillismFilterObject(renderer._device, renderer._canvasFormat));

  let time = 0;
  function animate() {
    time += 0.016;

    for (let i = 0; i < 8; i++) {
      const p = planets[i];
      p.angle += p.speed * 0.016;
      const px = p.elliptical ? p.a * Math.cos(p.angle) : p.a * Math.cos(p.angle);
      const py = p.elliptical ? p.b * Math.sin(p.angle) : p.a * Math.sin(p.angle);
      p.obj.setTranslation(px, py);
      if (i === 0) p.obj.setRotation(time * 0.8);
    }

    const planet0 = planets[0];
    const px0 = planet0.a * Math.cos(planet0.angle);
    const py0 = planet0.a * Math.sin(planet0.angle);
    const moonAng = planet0.angle * 5 + time * moonSpeed;
    moon.setTranslation(px0 + moonOrbitRadius * Math.cos(moonAng), py0 + moonOrbitRadius * Math.sin(moonAng));

    renderer.render();
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  console.log("Quest: Solar system + filters (grayscale, blur, pointillism)");
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
