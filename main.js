import Matter from "matter-js";

const Engine = Matter.Engine,
  Render = Matter.Render,
  Runner = Matter.Runner,
  Bodies = Matter.Bodies,
  Composite = Matter.Composite,
  Constraint = Matter.Constraint,
  Mouse = Matter.Mouse,
  MouseConstraint = Matter.MouseConstraint,
  Events = Matter.Events,
  Body = Matter.Body;

const engine = Engine.create({
  positionIterations: 20,
  velocityIterations: 20,
  constraintIterations: 10,
});
const container = document.getElementById("canvas-container");

const render = Render.create({
  element: container,
  engine: engine,
  options: {
    width: container.clientWidth,
    height: container.clientHeight,
    background: "transparent",
    wireframes: false,
    pixelRatio: window.devicePixelRatio,
  },
});

let bolaAzul, bolaRoja, bolaAmarilla;
let pivoteX, pivoteY;
let estaPausado = false;
let simulationTime = 0;
const stopwatchEl = document.getElementById("stopwatch");

let parametrosMat = {
  theta0: 0,
  omegaSimple: 0,
  omegaLegendre: 0,
  length: 0,
};

const GRAVITY = 0.001;
// 1 cm = 10 pixeles
const PIXELS_PER_CM = 10;
const categoryReal = 0x0004;

function formatTime(ms) {
  const secTotales = Math.floor(ms / 1000);
  const mins = Math.floor(secTotales / 60)
    .toString()
    .padStart(2, "0");
  const secs = (secTotales % 60).toString().padStart(2, "0");
  const mili = Math.floor(ms % 1000)
    .toString()
    .padStart(3, "0");
  return `${mins}:${secs}.${mili}`;
}

function setupSimulation() {
  Composite.clear(engine.world);
  Engine.clear(engine);
  simulationTime = 0;
  stopwatchEl.innerText = "00:00.000";

  // input
  const anguloDeg =
    parseFloat(document.getElementById("input-angle").value) || 45;
  const longitudCm =
    parseFloat(document.getElementById("input-length").value) || 30;
  const masaGramos =
    parseFloat(document.getElementById("input-mass").value) || 50;
  const friccion = parseFloat(document.getElementById("input-friction").value);

  // conversiones
  const longitudPx = longitudCm * PIXELS_PER_CM;
  const anguloRad = anguloDeg * (Math.PI / 180);

  pivoteX = render.options.width / 2;
  pivoteY = 100;

  // 1- simple: w = sqrt(g / L)
  const omegaSimple = Math.sqrt(GRAVITY / longitudPx);
  // en matter js en realidad es vel-nueva = vel * (1-fricción) por ej con 0.1 pierde el 10% de su velocidad y con 0 en el vacío

  // 2. legendre
  const theta2 = anguloRad * anguloRad;
  const theta4 = theta2 * theta2;
  // serie de taylor para corrección
  const factorLegendre = 1 + theta2 / 16 + (11 * theta4) / 3072;
  const omegaLegendre = omegaSimple / factorLegendre;

  parametrosMat = {
    theta0: anguloRad,
    omegaSimple: omegaSimple,
    omegaLegendre: omegaLegendre,
    length: longitudPx,
  };

  const inicioX = pivoteX + longitudPx * Math.sin(anguloRad);
  const inicioY = pivoteY + longitudPx * Math.cos(anguloRad);

  // COMIENZO BODIES
  const techo = Bodies.rectangle(pivoteX, pivoteY, 20, 10, {
    isStatic: true,
    render: { visible: false },
  });

  bolaAmarilla = Bodies.circle(inicioX, inicioY, 20, {
    isStatic: true,
    isSensor: true,
    render: { fillStyle: "#facc15", opacity: 0.6 },
  });
  const cuerdaAmarilla = Constraint.create({
    bodyA: null,
    pointA: { x: pivoteX, y: pivoteY },
    bodyB: bolaAmarilla,
    render: { strokeStyle: "#fef08a", lineWidth: 1 },
  });

  bolaRoja = Bodies.circle(inicioX, inicioY, 20, {
    isStatic: true,
    isSensor: true,
    render: { fillStyle: "#ef4444", opacity: 0.6 },
  });
  const cuerdaRoja = Constraint.create({
    bodyA: null,
    pointA: { x: pivoteX, y: pivoteY },
    bodyB: bolaRoja,
    render: { strokeStyle: "#fca5a5", lineWidth: 1 },
  });

  bolaAzul = Bodies.circle(inicioX, inicioY, 20, {
    frictionAir: friccion,
    collisionFilter: { category: categoryReal, mask: categoryReal },
    render: { fillStyle: "#2563eb" },
  });

  Body.setMass(bolaAzul, masaGramos);

  const cuerdaAzul = Constraint.create({
    bodyA: techo,
    bodyB: bolaAzul,
    length: longitudPx,
    stiffness: 1,
    render: { strokeStyle: "#93c5fd", lineWidth: 3 },
  });

  Composite.add(engine.world, [
    bolaAmarilla,
    cuerdaAmarilla,
    bolaRoja,
    cuerdaRoja,
    techo,
    bolaAzul,
    cuerdaAzul,
  ]);

  if (estaPausado) togglePause();
}

// engine propio
Events.on(engine, "beforeUpdate", function (event) {
  if (estaPausado) return;

  simulationTime += event.delta;

  // actualizar cronómetro
  stopwatchEl.innerText = formatTime(simulationTime);

  const titaAmarillo =
    parametrosMat.theta0 * Math.cos(parametrosMat.omegaSimple * simulationTime);
  Body.setPosition(bolaAmarilla, {
    x: pivoteX + parametrosMat.length * Math.sin(titaAmarillo),
    y: pivoteY + parametrosMat.length * Math.cos(titaAmarillo),
  });

  const titaRojo =
    parametrosMat.theta0 *
    Math.cos(parametrosMat.omegaLegendre * simulationTime);
  Body.setPosition(bolaRoja, {
    x: pivoteX + parametrosMat.length * Math.sin(titaRojo),
    y: pivoteY + parametrosMat.length * Math.cos(titaRojo),
  });
});

function dibujarArco(
  ctx,
  cuerpo,
  colorStroke,
  colorFill,
  radioVisual,
  offsetTexto,
) {
  if (!cuerpo) return;
  const dx = cuerpo.position.x - pivoteX;
  const dy = cuerpo.position.y - pivoteY;
  const angleFromVertical = Math.atan2(dx, dy);
  const angleDegree = Math.round(angleFromVertical * (180 / Math.PI));
  const verticalAngle = Math.PI / 2;
  const currentAngleCanvas = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.moveTo(pivoteX, pivoteY);
  const isRightSide = dx > 0;
  ctx.arc(
    pivoteX,
    pivoteY,
    radioVisual,
    verticalAngle,
    currentAngleCanvas,
    isRightSide,
  );
  ctx.lineTo(pivoteX, pivoteY);

  ctx.fillStyle = colorFill;
  ctx.fill();
  ctx.strokeStyle = colorStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = colorStroke;
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";

  const textDist = radioVisual + offsetTexto;
  const textX = pivoteX + Math.sin(angleFromVertical / 2) * textDist;
  const textY = pivoteY + Math.cos(angleFromVertical / 2) * textDist;
  ctx.fillText(`${angleDegree}°`, textX, textY);
}

Events.on(render, "afterRender", function () {
  const ctx = render.context;

  dibujarArco(ctx, bolaAmarilla, "#ca8a04", "rgba(250, 204, 21, 0.1)", 50, 20);
  dibujarArco(ctx, bolaRoja, "#dc2626", "rgba(239, 68, 68, 0.1)", 80, 25);
  dibujarArco(ctx, bolaAzul, "#2563eb", "rgba(37, 99, 235, 0.1)", 110, 30);
});

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse: mouse,
  constraint: { render: { visible: false } },
  collisionFilter: { category: categoryReal },
});
Composite.add(engine.world, mouseConstraint);

render.canvas.removeEventListener("mousewheel", mouse.mousewheel);
render.canvas.removeEventListener("DOMMouseScroll", mouse.mousewheel);

document
  .getElementById("btn-restart")
  .addEventListener("click", setupSimulation);

const btnPausa = document.getElementById("btn-pause");
const runner = Runner.create();

function togglePause() {
  estaPausado = !estaPausado;
  runner.enabled = !estaPausado;
  btnPausa.innerText = estaPausado ? "Reanudar" : "Pausar";
  btnPausa.className = estaPausado
    ? "flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow text-sm transition-all"
    : "flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow text-sm transition-all";
}
btnPausa.addEventListener("click", togglePause);

const inputFriction = document.getElementById("input-friction");

inputFriction.addEventListener("input", (e) => {
  const valor = parseFloat(e.target.value);
  if (bolaAzul) {
    bolaAzul.frictionAir = valor;
  }
});

window.addEventListener("resize", () => {
  render.canvas.width = container.clientWidth;
  render.canvas.height = container.clientHeight;
  render.options.width = container.clientWidth;
  render.options.height = container.clientHeight;
  setupSimulation();
});

setupSimulation();
Render.run(render);
Runner.run(runner, engine);
