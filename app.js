const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });

if (!gl) {
  document.body.innerHTML = "WebGL2 not supported on this device.";
  throw new Error("WebGL2 not supported");
}

const vertexSrc = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragSrc = `#version 300 es
precision highp float;
out vec4 outColor;
in vec2 vUv;

uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.1;

  vec2 q = p * 2.5;
  q += vec2(sin(t * 0.8), cos(t * 0.6)) * 0.2;

  float n1 = fbm(q + t * 0.6);
  float n2 = fbm(q * 1.6 - t * 0.4);
  float n3 = fbm(q * 2.4 + t * 0.2);

  float caustic = pow(max(0.0, sin((n1 + n2) * 5.0 + n3 * 2.2)), 2.2);
  float ripples = pow(max(0.0, sin(length(p) * 6.0 - t * 1.1 + n2 * 1.4)), 1.5);

  vec3 shallow = vec3(0.62, 0.78, 0.9);
  vec3 mid = vec3(0.38, 0.6, 0.78);
  vec3 deep = vec3(0.14, 0.32, 0.52);

  float depth = smoothstep(0.0, 1.1, length(p));
  vec3 color = mix(shallow, deep, depth);
  color = mix(color, mid, n1 * 0.4);
  color += caustic * vec3(0.9, 0.98, 1.0);
  color += ripples * vec3(0.25, 0.36, 0.45);

  float vignette = smoothstep(1.25, 0.45, length(p));
  color *= vignette;

  outColor = vec4(color, 1.0);
}`;

function compile(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

const uRes = gl.getUniformLocation(program, "uRes");
const uTime = gl.getUniformLocation(program, "uTime");

let paused = false;
let lastTime = performance.now();
let t = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uRes, canvas.width, canvas.height);
}

function render(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!paused) t += dt;

  resize();
  gl.uniform1f(uTime, t);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(render);
}

canvas.addEventListener("click", () => {
  paused = !paused;
});

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(render);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        entry.target.classList.add("pop");
        const fills = entry.target.querySelectorAll(".fill");
        fills.forEach((fill) => {
          fill.style.transform = "scaleX(1)";
        });
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));

const panel = document.getElementById("info-panel");
const openPanel = document.getElementById("open-panel");
const closePanel = document.getElementById("close-panel");

openPanel.addEventListener("click", () => {
  panel.classList.add("open");
});

closePanel.addEventListener("click", () => {
  panel.classList.remove("open");
});

const audio = document.getElementById("bg-audio");
const audioBtn = document.getElementById("audio-toggle");
let isPlaying = false;

audioBtn.addEventListener("click", async () => {
  if (!audio) return;
  try {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      audioBtn.textContent = "Play Music";
    } else {
      await audio.play();
      isPlaying = true;
      audioBtn.textContent = "Pause Music";
    }
  } catch (err) {
    audioBtn.textContent = "Tap to Play";
  }
});

const loader = document.getElementById("page-loader");
if (loader) {
  loader.classList.add("active");
  setTimeout(() => {
    loader.classList.add("success");
    const label = loader.querySelector(".loader-text");
    if (label) label.textContent = "Loaded Successfully";
    setTimeout(() => {
      loader.classList.remove("active");
      loader.classList.remove("success");
    }, 900);
  }, 1200);
}
