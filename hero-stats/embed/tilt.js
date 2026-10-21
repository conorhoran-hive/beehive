(function () {
  var el = document.currentScript && document.currentScript.previousElementSibling;
  if (!el || !el.classList.contains('bh')) return;
  /* pause all motion while the graphic is offscreen */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.toggleAttribute('data-paused', !e.isIntersecting); });
    }).observe(el);
  }
  /* gentle tilt toward the cursor, desktop only */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var raf = 0, x = 0, y = 0;
  el.addEventListener('pointermove', function (ev) {
    var r = el.getBoundingClientRect();
    x = (ev.clientX - r.left) / r.width - .5;
    y = (ev.clientY - r.top) / r.height - .5;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      el.style.setProperty('--tx', (x * 10).toFixed(2) + 'deg');
      el.style.setProperty('--ty', (y * -8).toFixed(2) + 'deg');
    });
  });
  el.addEventListener('pointerleave', function () {
    el.style.setProperty('--tx', '0deg');
    el.style.setProperty('--ty', '0deg');
  });
})();
