function deepExtend(target = {}, ...sources) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] = deepExtend(target[key] || {}, value);
      } else {
        target[key] = value;
      }
    }
  }
  return target;
}

const DEFAULTS = {
  minSpeedX: 0.1,
  maxSpeedX: 0.7,
  minSpeedY: 0.1,
  maxSpeedY: 0.7,
  directionX: "center",
  directionY: "center",
  density: 10000,
  dotColor: "#666666",
  lineColor: "#666666",
  particleRadius: 7,
  lineWidth: 1,
  curvedLines: false,
  proximity: 100,
  parallax: true,
  parallaxMultiplier: 5,
};

export function initParticleground(element, options = {}) {
  if (!element || !document.createElement("canvas").getContext) {
    return { destroy() {}, pause() {}, start() {} };
  }

  const settings = deepExtend({}, DEFAULTS, options);
  let canvas = document.createElement("canvas");
  canvas.className = "pg-canvas";
  canvas.style.display = "block";
  element.insertBefore(canvas, element.firstChild);

  const context = canvas.getContext("2d");
  const particles = [];
  let screenWidth = window.innerWidth;
  let screenHeight = window.innerHeight;
  let mouseX = 0;
  let mouseY = 0;
  const isMobile = /(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i.test(
    navigator.userAgent,
  );
  const hasOrientation = Boolean(window.DeviceOrientationEvent);
  let tiltX = 0;
  let tiltY = 0;
  let paused = false;
  let animationFrame = null;

  function sizeCanvas() {
    canvas.width = element.offsetWidth;
    canvas.height = element.offsetHeight;
    context.fillStyle = settings.dotColor;
    context.strokeStyle = settings.lineColor;
    context.lineWidth = settings.lineWidth;
  }

  function randomSpeed(direction, min, max) {
    if (direction === "left" || direction === "up") {
      return +(-max + Math.random() * max - min).toFixed(2);
    }
    if (direction === "right" || direction === "down") {
      return +(Math.random() * max + min).toFixed(2);
    }
    let speed = +(-max / 2 + Math.random() * max).toFixed(2);
    speed += speed > 0 ? min : -min;
    return speed;
  }

  function Particle() {
    this.stackPos = 0;
    this.active = true;
    this.layer = Math.ceil(3 * Math.random());
    this.parallaxOffsetX = 0;
    this.parallaxOffsetY = 0;
    this.position = {
      x: Math.ceil(Math.random() * canvas.width),
      y: Math.ceil(Math.random() * canvas.height),
    };
    this.speed = {
      x: randomSpeed(settings.directionX, settings.minSpeedX, settings.maxSpeedX),
      y: randomSpeed(settings.directionY, settings.minSpeedY, settings.maxSpeedY),
    };
  }

  Particle.prototype.setStackPos = function setStackPos(index) {
    this.stackPos = index;
  };

  Particle.prototype.draw = function draw() {
    context.beginPath();
    context.arc(
      this.position.x + this.parallaxOffsetX,
      this.position.y + this.parallaxOffsetY,
      settings.particleRadius / 2,
      0,
      Math.PI * 2,
      true,
    );
    context.closePath();
    context.fill();

    context.beginPath();
    for (let i = particles.length - 1; i > this.stackPos; i -= 1) {
      const other = particles[i];
      const deltaX = this.position.x - other.position.x;
      const deltaY = this.position.y - other.position.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY).toFixed(2);
      if (distance < settings.proximity) {
        context.moveTo(this.position.x + this.parallaxOffsetX, this.position.y + this.parallaxOffsetY);
        if (settings.curvedLines) {
          context.quadraticCurveTo(
            Math.max(other.position.x, other.position.x),
            Math.min(other.position.y, other.position.y),
            other.position.x + other.parallaxOffsetX,
            other.position.y + other.parallaxOffsetY,
          );
        } else {
          context.lineTo(other.position.x + other.parallaxOffsetX, other.position.y + other.parallaxOffsetY);
        }
      }
    }
    context.stroke();
    context.closePath();
  };

  Particle.prototype.updatePosition = function updatePosition() {
    if (settings.parallax) {
      let targetX;
      let targetY;

      if (hasOrientation && !isMobile) {
        const xScale = screenWidth / 60;
        const yScale = screenHeight / 60;
        targetX = (tiltY + 30) * xScale;
        targetY = (tiltX + 30) * yScale;
      } else {
        targetX = mouseX;
        targetY = mouseY;
      }

      this.parallaxTargX = (targetX - screenWidth / 2) / (settings.parallaxMultiplier * this.layer);
      this.parallaxOffsetX += (this.parallaxTargX - this.parallaxOffsetX) / 10;
      this.parallaxTargY = (targetY - screenHeight / 2) / (settings.parallaxMultiplier * this.layer);
      this.parallaxOffsetY += (this.parallaxTargY - this.parallaxOffsetY) / 10;
    }

    const width = element.offsetWidth;
    const height = element.offsetHeight;

    switch (settings.directionX) {
      case "left":
        if (this.position.x + this.speed.x + this.parallaxOffsetX < 0) {
          this.position.x = width - this.parallaxOffsetX;
        }
        break;
      case "right":
        if (this.position.x + this.speed.x + this.parallaxOffsetX > width) {
          this.position.x = -this.parallaxOffsetX;
        }
        break;
      default:
        if (this.position.x + this.speed.x + this.parallaxOffsetX > width || this.position.x + this.speed.x + this.parallaxOffsetX < 0) {
          this.speed.x = -this.speed.x;
        }
    }

    switch (settings.directionY) {
      case "up":
        if (this.position.y + this.speed.y + this.parallaxOffsetY < 0) {
          this.position.y = height - this.parallaxOffsetY;
        }
        break;
      case "down":
        if (this.position.y + this.speed.y + this.parallaxOffsetY > height) {
          this.position.y = -this.parallaxOffsetY;
        }
        break;
      default:
        if (this.position.y + this.speed.y + this.parallaxOffsetY > height || this.position.y + this.speed.y + this.parallaxOffsetY < 0) {
          this.speed.y = -this.speed.y;
        }
    }

    this.position.x += this.speed.x;
    this.position.y += this.speed.y;
  };

  function syncParticleCount() {
    sizeCanvas();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].position.x > element.offsetWidth || particles[i].position.y > element.offsetHeight) {
        particles.splice(i, 1);
      }
    }
    const targetCount = Math.round((canvas.width * canvas.height) / settings.density);
    while (particles.length < targetCount) {
      const particle = new Particle();
      particle.setStackPos(particles.length);
      particles.push(particle);
    }
    if (targetCount < particles.length) {
      particles.splice(targetCount);
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      particles[i].setStackPos(i);
    }
  }

  function drawFrame() {
    if (paused) return;
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const particle of particles) particle.updatePosition();
    for (const particle of particles) particle.draw();
    animationFrame = window.requestAnimationFrame(drawFrame);
  }

  function handleResize() {
    syncParticleCount();
  }

  function handleMouseMove(event) {
    mouseX = event.pageX;
    mouseY = event.pageY;
  }

  function handleOrientation(event) {
    tiltX = Math.min(Math.max(-event.beta, -30), 30);
    tiltY = Math.min(Math.max(-event.gamma, -30), 30);
  }

  sizeCanvas();
  syncParticleCount();
  window.addEventListener("resize", handleResize, false);
  document.addEventListener("mousemove", handleMouseMove, false);
  if (hasOrientation && !isMobile) {
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
  drawFrame();

  return {
    destroy() {
      paused = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("resize", handleResize, false);
      document.removeEventListener("mousemove", handleMouseMove, false);
      if (hasOrientation && !isMobile) {
        window.removeEventListener("deviceorientation", handleOrientation, true);
      }
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
    },
    pause() {
      paused = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    },
    start() {
      if (!paused) return;
      paused = false;
      drawFrame();
    },
  };
}
