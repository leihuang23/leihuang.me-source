import List from "./list.js";
import { dft } from "./dft.js";
import { helloPath } from "./path.js";

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("home-canvas");
  const ctx = canvas.getContext("2d");
  const canvasContainer = document.getElementById("canvas-container");
  const fullScreenBtn = document.getElementById("fullScreenBtn");
  const exitFullScreenIcon = document.getElementById("exit-fullscreen-icon");
  const enterFullScreenIcon = document.getElementById("enter-fullscreen-icon");

  fullScreenBtn.addEventListener("click", function () {
    exitFullScreenIcon.classList.toggle("hidden");
    enterFullScreenIcon.classList.toggle("hidden");
    canvasContainer.classList.toggle("fullscreen");
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
  });

  // Calculate bounds of the original coordinates
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  helloPath.forEach((pt) => {
    if (pt[0] < minX) minX = pt[0];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  });

  const designWidth = maxX - minX;
  const designHeight = maxY - minY;
  // Calculate the center of the original drawing
  const designCenterX = minX + designWidth / 2;
  const designCenterY = minY + designHeight / 2;

  // Create complex points from raw coordinates (no initial scaling)
  const complexPoints = helloPath.map((pt) => ({
    re: pt[0],
    im: pt[1],
  }));

  // Compute Fourier coefficients and sort by amplitude (largest first)
  const fourier = dft(complexPoints).sort((a, b) => b.amp - a.amp);

  // Animation state variables
  let time = 0;
  const dt = (2 * Math.PI) / fourier.length; // Time step per frame
  let path = List(fourier.length);
  const animationSpeed = 1; // Lower = slower, 1.0 = original speed
  let lastFrameTime = 0;
  let animationFrameId = null; // To manage the animation loop

  // Function to resize the canvas and handle DPI scaling
  function resizeCanvas() {
    // Stop previous animation frame request if any
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    // Use parent width for responsiveness (minus padding)
    // const containerPadding = 28; // Match your CSS padding * 2 or desired spacing
    const newWidth = canvasContainer.clientWidth;

    const newHeight = Math.min(newWidth * (2 / 3), window.innerHeight);

    // Set the CSS size for the element's layout
    canvas.style.width = newWidth + "px";
    canvas.style.height = newHeight + "px";

    // Set the drawing surface resolution (important!)
    // Use devicePixelRatio for sharper rendering on high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;

    // Scale the context once here to compensate for devicePixelRatio
    // This ensures 1 CSS pixel corresponds to 1 drawing unit before our dynamic scaling
    ctx.resetTransform(); // Clear previous transforms before scaling
    ctx.scale(dpr, dpr);

    // Reset drawing state
    path.clear();
    time = 0;
    lastFrameTime = 0; // Reset last frame time for smooth start

    // Restart the animation loop
    animationFrameId = requestAnimationFrame(draw);
  }

  // Function to draw the set of vectors and update the traced path
  function draw(currentTime) {
    // Control frame rate based on timing (optional, remove if full speed is okay)
    if (lastFrameTime === 0) lastFrameTime = currentTime;
    const elapsed = currentTime - lastFrameTime;

    // Only update if enough time has passed (for slower animation)
    if (elapsed > 1000 / 60 / animationSpeed) {
      lastFrameTime = currentTime; // Uncomment if using frame rate limiting

      // Use CSS dimensions for drawing logic before DPR scaling
      const cssWidth = parseFloat(canvas.style.width) || canvas.width;
      const cssHeight = parseFloat(canvas.style.height) || canvas.height;

      // Clear the canvas (considering the DPR scaling applied in resizeCanvas)
      // We need to clear the *physical* pixel area
      ctx.save();
      ctx.resetTransform(); // Temporarily remove DPR scaling for clearRect
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore(); // Restore DPR scaling

      ctx.save(); // Save the DPR-scaled state

      // --- Scaling Logic ---
      // Calculate scale factors to fit the design within the CSS dimensions
      const scaleX = cssWidth / designWidth;
      const scaleY = cssHeight / designHeight;
      // Use the smaller scale factor to maintain aspect ratio and fit entirely
      // Multiply by a factor (e.g., 0.9) to add some padding
      const scale = Math.min(scaleX, scaleY) * 0.9;

      // Translate to the center of the CSS canvas dimensions
      ctx.translate(cssWidth / 2, cssHeight / 2);
      // Apply the calculated scale
      ctx.scale(scale, scale);
      // Translate the drawing's origin so its original center aligns with the canvas center
      ctx.translate(-designCenterX, -designCenterY);
      // --- End Scaling Logic ---

      let x = 0; // Start epicycles from the (now transformed) origin
      let y = 0;
      const baseLineWidth = 1; // Base line width in design coordinates

      // Draw each Fourier vector (each as a rotating circle and its arrow)
      for (let i = 0; i < fourier.length; i++) {
        let prevX = x;
        let prevY = y;
        const freq = fourier[i].freq;
        const radius = fourier[i].amp; // These amps are now relative to the design size
        const phase = fourier[i].phase;
        x += radius * Math.cos(freq * time + phase);
        y += radius * Math.sin(freq * time + phase);

        // Draw the circle (vector path)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        // Adjust line width based on scale so it looks consistent
        ctx.lineWidth = baseLineWidth / scale;
        ctx.beginPath();
        ctx.arc(prevX, prevY, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw the vector line
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = baseLineWidth / scale; // Keep line width visually consistent
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Add the final tip to the path (relative to the transformed origin)
      path.prepend({ x, y });
      // Optional: Limit path length for performance
      // if (path.length > 700) {
      // // Limit path length slightly longer than points
      // path.pop();
      // }

      // Draw the traced path
      ctx.beginPath();
      if (path.length > 0) {
        // Check if path has points
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.strokeStyle = "#ff4081"; // Pink color
        ctx.lineWidth = (baseLineWidth * 2) / scale; // Make path slightly thicker
        ctx.stroke();
      }

      ctx.restore(); // Restore the state before transformations for this frame

      // Increment time and loop if needed
      time += dt;
      if (time >= 2 * Math.PI) {
        time = time % (2 * Math.PI); // More robust loop than just setting to 0
        path.clear(); // Keep the last point for continuity instead of clearing fully
      }
    }

    animationFrameId = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
});
