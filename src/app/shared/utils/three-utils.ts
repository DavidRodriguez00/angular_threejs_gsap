export function handleResize(camera: any, renderer: any, canvas: HTMLCanvasElement) {
  const resize = () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  };
  window.addEventListener('resize', resize);
  // Initial resize
  resize();
}