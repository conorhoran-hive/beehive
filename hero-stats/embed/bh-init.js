function (el) {
  if (!el || !el.classList || !el.classList.contains('bh')) return;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var counts = el.querySelectorAll('[data-bh-count]'), counted = false;

  /* numbers count up from zero the first time the graphic is on screen */
  function show(n, t) {
    var to = parseFloat(n.getAttribute('data-bh-count')), dec = +(n.getAttribute('data-bh-dec') || 0);
    n.textContent = (to * t).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
      (n.getAttribute('data-bh-suffix') || '');
  }
  function count() {
    if (counted || !counts.length || still) return;
    counted = true;
    counts.forEach(function (n) { show(n, 0); });
    setTimeout(function () {
      var t0 = performance.now();
      (function step(now) {
        var t = Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - t, 3);
        counts.forEach(function (n) { show(n, e); });
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    }, +(el.getAttribute('data-bh-count-delay') || 0));
  }
  el.addEventListener('bh:replay', function () { counted = false; count(); });

  /* hold motion until the graphic is on screen, and pause it again offscreen */
  if ('IntersectionObserver' in window) {
    el.setAttribute('data-paused', '');
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.toggleAttribute('data-paused', !e.isIntersecting);
        if (e.isIntersecting) count();
      });
    }).observe(el);
  } else count();

  /* gentle tilt toward the cursor, desktop only */
  if (still || !el.hasAttribute('data-bh-tilt')) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
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
}
