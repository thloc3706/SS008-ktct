/* ==========================================================================
  Bàn tay vô hình — Bàn tay hữu hình
  main.js — điều hướng, hoạt ảnh, và mô hình tương tác
  ========================================================================== */
(function () {
 'use strict';
 
 var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var SECTION_ORDER = ['hero', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
 var currentSectionId = 'hero';
 
 function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
 function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
 
 /* ------------------------------------------------------------------ *
  * 1. Thanh tiến trình đọc
  * ------------------------------------------------------------------ */
 function initProgress() {
   var fill = qs('.progress-fill');
   if (!fill) return;
   function update() {
     var doc = document.documentElement;
     var scrollTop = window.scrollY || doc.scrollTop || 0;
     var height = doc.scrollHeight - doc.clientHeight;
     var pct = height > 0 ? (scrollTop / height) * 100 : 0;
     fill.style.width = pct.toFixed(2) + '%';
   }
   update();
   window.addEventListener('scroll', update, { passive: true });
   window.addEventListener('resize', update);
 }
 
 /* ------------------------------------------------------------------ *
  * 2. Theo dõi mục đang xem (scrollspy) — cập nhật dotnav + menu di động
  * ------------------------------------------------------------------ */
 function initScrollSpy() {
   var navLinks = qsa('[data-target]');
   var counter = qs('.menu-btn__count');
 
   function setActive(id) {
     currentSectionId = id;
     navLinks.forEach(function (a) {
       a.classList.toggle('is-active', a.getAttribute('data-target') === id);
     });
     if (counter) {
       var idx = SECTION_ORDER.indexOf(id);
       counter.textContent = idx <= 0 ? '\u00A0' : idx + ' / 8';
     }
   }
 
   var sections = SECTION_ORDER.map(function (id) { return document.getElementById(id); }).filter(Boolean);
   if ('IntersectionObserver' in window) {
     var io = new IntersectionObserver(function (entries) {
       entries.forEach(function (entry) {
         if (entry.isIntersecting) setActive(entry.target.id);
       });
     }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
     sections.forEach(function (s) { io.observe(s); });
   }
   setActive('hero');
 }
 
 /* ------------------------------------------------------------------ *
  * 3. Điều hướng bằng bàn phím (phục vụ thuyết trình)
  * ------------------------------------------------------------------ */
 function scrollToSection(id) {
   var el = document.getElementById(id);
   if (!el) return;
   el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
 }
 
 function initKeyboardNav() {
   window.addEventListener('keydown', function (e) {
     if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
     var active = document.activeElement;
     if (active) {
       var tag = active.tagName;
       if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(tag) !== -1) return;
       if (active.closest && active.closest('.sd-widget')) return;
     }
     var idx = SECTION_ORDER.indexOf(currentSectionId);
     if (idx === -1) idx = 0;
     if (e.key === 'ArrowDown' || e.key === 'PageDown') {
       e.preventDefault();
       scrollToSection(SECTION_ORDER[Math.min(idx + 1, SECTION_ORDER.length - 1)]);
     } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
       e.preventDefault();
       scrollToSection(SECTION_ORDER[Math.max(idx - 1, 0)]);
     }
   });
 }
 
 /* ------------------------------------------------------------------ *
  * 4. Menu di động (bottom sheet)
  * ------------------------------------------------------------------ */
 function initMobileSheet() {
   var btn = qs('.menu-btn');
   var sheet = qs('.mobile-sheet');
   var closeBtn = qs('.mobile-sheet__close');
   if (!btn || !sheet) return;
 
   function open() { sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false'); }
   function close() { sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true'); }
 
   btn.addEventListener('click', open);
   if (closeBtn) closeBtn.addEventListener('click', close);
   sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
   qsa('a', sheet).forEach(function (a) { a.addEventListener('click', close); });
 }
 
 /* ------------------------------------------------------------------ *
  * 6. Hiện dần nội dung khi cuộn tới
  * ------------------------------------------------------------------ */
 function initReveal() {
   var els = qsa('.reveal');
   if (!els.length) return;
   if (!('IntersectionObserver' in window) || reduceMotion) {
     els.forEach(function (el) { el.classList.add('is-visible'); });
     return;
   }
   var io = new IntersectionObserver(function (entries, obs) {
     entries.forEach(function (entry) {
       if (entry.isIntersecting) {
         entry.target.classList.add('is-visible');
         obs.unobserve(entry.target);
       }
     });
   }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
   els.forEach(function (el) { io.observe(el); });
 }

 /* ------------------------------------------------------------------ *
  * 6a. Draw the supply and demand chart when it enters view
  * ------------------------------------------------------------------ */
 function initChartMotion() {
   qsa('.sd-demand, .sd-supply').forEach(function (path) {
     if (!path.getTotalLength) return;
     try { path.style.setProperty('--chart-length', path.getTotalLength()); } catch (err) { /* SVG fallback */ }
   });
 }

 /* ------------------------------------------------------------------ *
  * 6a. Add pointer-reactive glow and tilt to content cards
  * ------------------------------------------------------------------ */
 function initMotionCards() {
   var cards = qsa('.pillar, .actor, .policy, .rebuttal, .formula, .sd-widget, .trait-list li, .verdict__item, .discussion li, .scope-list li');
   var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
   cards.forEach(function (card) {
     card.classList.add('motion-card');
     if (card.matches('.policy--steel, .rebuttal:nth-child(2), .sd-widget')) {
       card.style.setProperty('--motion-rgb', '159 198 232');
     }
     if (reduceMotion || !finePointer) return;

     var pointerX = 0, pointerY = 0, frame = 0, active = false;
     card.addEventListener('pointermove', function (event) {
       pointerX = event.clientX;
       pointerY = event.clientY;
       active = true;
       if (frame) return;
       frame = window.requestAnimationFrame(function () {
         frame = 0;
         if (!active) return;
         var rect = card.getBoundingClientRect();
         var x = Math.max(0, Math.min(1, (pointerX - rect.left) / (rect.width || 1)));
         var y = Math.max(0, Math.min(1, (pointerY - rect.top) / (rect.height || 1)));
         card.style.setProperty('--motion-x', (x * 100).toFixed(1) + '%');
         card.style.setProperty('--motion-y', (y * 100).toFixed(1) + '%');
         card.style.setProperty('--motion-tilt', ((x - .5) * 1.1 + (.5 - y) * .35).toFixed(2) + 'deg');
       });
     }, { passive: true });
     card.addEventListener('pointerleave', function () {
       active = false;
       card.style.setProperty('--motion-tilt', '0deg');
     }, { passive: true });
   });
 }

 /* ------------------------------------------------------------------ *
  * 6b. Nhịp cuộn toàn trang — Lenis + GSAP ScrollTrigger
  * ------------------------------------------------------------------ */
 function initScrollMotion() {
   var gsap = window.gsap;
   var ScrollTrigger = window.ScrollTrigger;
   if (!gsap || !ScrollTrigger || reduceMotion) return;
   gsap.registerPlugin(ScrollTrigger);

   if (window.Lenis) {
     var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
     lenis.on('scroll', ScrollTrigger.update);
     gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
     gsap.ticker.lagSmoothing(500, 33);
     window.__cqLenis = lenis;
   }

   qsa('.section').forEach(function (section, index) {
     var head = qs('.section__head', section);
     var title = qs('.section__title', section);
     if (head) {
       gsap.fromTo(head, { y: 28, opacity: 0 }, {
         y: 0, opacity: 1, duration: .85, ease: 'power3.out',
         scrollTrigger: { trigger: section, start: 'top 82%', once: true }
       });
     }
     if (title) {
       gsap.fromTo(title, { clipPath: 'inset(0 0 100% 0)', y: 18 }, {
         clipPath: 'inset(0 0 0% 0)', y: 0, duration: .95, delay: .08,
         ease: 'power3.out', scrollTrigger: { trigger: section, start: 'top 78%', once: true }
       });
     }
     qsa('.prose, .lede, .pillars, .story__grid, .duality-headline, .verdict', section).forEach(function (element) {
       gsap.fromTo(element, { y: 22, opacity: 0 }, {
         y: 0, opacity: 1, duration: .8, delay: .12,
         ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true }
       });
     });
     qsa('.story__panel, .scene, .pillar, .verdict__item', section).forEach(function (element, itemIndex) {
       gsap.fromTo(element, { x: itemIndex % 2 ? 20 : -20, y: 12, opacity: 0 }, {
         x: 0, y: 0, opacity: 1, duration: .75, delay: Math.min(itemIndex * .07, .28),
         ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true }
       });
     });
     if (index % 2 === 0) {
       gsap.to(section, { '--section-drift': '18px', ease: 'none', scrollTrigger: {
         trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.2
       }});
     }
   });
 }

 /* ------------------------------------------------------------------ *
  * 6c. Bụi vũ trụ xuyên suốt nội dung — trôi độc lập với tốc độ scroll
  * ------------------------------------------------------------------ */
 function initCosmicDust() {
   var canvas = document.createElement('canvas');
   canvas.className = 'cosmic-dust';
   canvas.setAttribute('aria-hidden', 'true');
   document.body.appendChild(canvas);
   var ctx = canvas.getContext('2d');
   if (!ctx) { canvas.remove(); return; }
   var particles = [];
   var motionScale = reduceMotion ? 0 : 1;
   var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
   var width = 0, height = 0;
   var scrollTarget = 0, scrollPosition = 0, renderedScrollPosition = 0;
   function resize() {
     width = innerWidth; height = innerHeight;
     canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
     canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
   }
   function seed() {
     particles = [];
     var count = 36;
     var colors = ['240, 214, 154', '174, 204, 232', '230, 235, 244'];
     for (var index = 0; index < count; index++) {
       var angle = Math.random() * Math.PI * 2;
       var speed = .36 + Math.random() * .24;
       particles.push({
         x: Math.random() * width,
         y: Math.random() * height,
         r: 1.4 + Math.random() * 1.5,
         a: .62 + Math.random() * .3,
         color: colors[Math.floor(Math.random() * colors.length)],
         vx: Math.cos(angle) * speed * motionScale,
         vy: Math.sin(angle) * speed * motionScale,
         depth: .45 + Math.random() * .55,
         phase: Math.random() * Math.PI * 2,
         twinkleSpeed: .0013 + Math.random() * .0011,
         sparkle: index % 4 === 0
       });
     }
   }
   function trackScroll() {
     if (reduceMotion) return;
     var doc = document.documentElement;
     var maxScroll = Math.max(0, doc.scrollHeight - innerHeight);
     var currentScrollY = window.scrollY || doc.scrollTop || 0;
     var progress = maxScroll ? Math.max(0, Math.min(1, currentScrollY / maxScroll)) : 0;
     // Keep the background parallax gentle and under 100px across the whole page.
     scrollTarget = progress * 72;
   }
   function draw(time) {
     ctx.clearRect(0, 0, width, height);
     scrollPosition += (scrollTarget - scrollPosition) * .18;
     if (Math.abs(scrollTarget - scrollPosition) < .01) scrollPosition = scrollTarget;
     var scrollDelta = scrollPosition - renderedScrollPosition;
     renderedScrollPosition = scrollPosition;
     particles.forEach(function (particle) {
       particle.x = (particle.x + particle.vx + width) % width;
       particle.y = ((particle.y + particle.vy + scrollDelta * particle.depth) % height + height) % height;
       var pulse = .68 + Math.sin(time * particle.twinkleSpeed + particle.phase) * .22;
       var twinkle = particle.sparkle
         ? Math.pow(Math.max(0, Math.sin(time * .0018 + particle.phase)), 12)
         : 0;
       var alpha = Math.min(1, particle.a * (pulse + twinkle * .8));
       var glowSize = particle.r * 6;
       var glow = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, glowSize);
       glow.addColorStop(0, 'rgba(' + particle.color + ', ' + alpha.toFixed(3) + ')');
       glow.addColorStop(.3, 'rgba(' + particle.color + ', ' + (alpha * .62).toFixed(3) + ')');
       glow.addColorStop(1, 'rgba(' + particle.color + ', 0)');
       ctx.fillStyle = glow;
       ctx.fillRect(particle.x - glowSize, particle.y - glowSize, glowSize * 2, glowSize * 2);
       ctx.fillStyle = 'rgba(' + particle.color + ', ' + alpha.toFixed(3) + ')';
       ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r * 1.15, 0, Math.PI * 2); ctx.fill();
       ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.min(1, alpha * 1.3).toFixed(3) + ')';
       ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.r * .48, 0, Math.PI * 2); ctx.fill();
       if (twinkle > .08) {
         var rayLength = particle.r * (2.5 + twinkle * 1.5);
         ctx.strokeStyle = 'rgba(255, 255, 255, ' + Math.min(1, alpha * twinkle * 1.8).toFixed(3) + ')';
         ctx.lineWidth = .7 + twinkle * .65;
         ctx.beginPath();
         ctx.moveTo(particle.x - rayLength, particle.y);
         ctx.lineTo(particle.x + rayLength, particle.y);
         ctx.moveTo(particle.x, particle.y - rayLength);
         ctx.lineTo(particle.x, particle.y + rayLength);
         ctx.stroke();
       }
     });
     if (!reduceMotion) requestAnimationFrame(draw);
   }
   resize(); seed(); trackScroll();
   scrollPosition = scrollTarget;
   renderedScrollPosition = scrollTarget;
   draw(performance.now());
   window.addEventListener('resize', function () { resize(); seed(); trackScroll(); }, { passive: true });
   if (!reduceMotion) window.addEventListener('scroll', trackScroll, { passive: true });
 }
 
 /* ------------------------------------------------------------------ *
  * 7. Sân khấu ba hồi — chuyển cảnh câu chuyện phiên chợ
  * ------------------------------------------------------------------ */
 function initStory() {
   var story = qs('.story');
   if (!story) return;
   var tabs = qsa('.story__tab', story);
   var texts = qsa('.story__text', story);
 
   tabs.forEach(function (tab) {
     tab.addEventListener('click', function () {
       var act = tab.getAttribute('data-act');
       story.setAttribute('data-act', act);
       tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
       texts.forEach(function (tx) { tx.classList.toggle('is-active', tx.getAttribute('data-act') === act); });
     });
   });
 }
 
 /* ------------------------------------------------------------------ *
  * 8. Mô hình cung – cầu tương tác (mục 5.1 — ấn định giá bánh)
  * ------------------------------------------------------------------ */
 function initSupplyDemand() {
   var root = qs('.sd-widget');
   if (!root) return;
   var svg = qs('svg', root);
   var handle = qs('.sd-handle', root);
   var handleLine = qs('.sd-handle-line', root);
   var gapLine = qs('.sd-gap', root);
   var readout = qs('.sd-readout', root);
   var resetBtn = qs('.sd-reset', root);
   if (!svg || !handle || !handleLine || !gapLine || !readout) return;
 
   var PAD = { l: 44, t: 16, b: 34 };
   var VB_W = 420, VB_H = 300;
   var plotW = VB_W - PAD.l - 16;
   var plotH = VB_H - PAD.t - PAD.b;
   var QMAX = 200, PMAX = 100;
   var P_EQ = 200 / 4.5; // ~44.44
   var curP = P_EQ;
 
   function xScale(q) { return PAD.l + (q / QMAX) * plotW; }
   function yScale(p) { return PAD.t + (1 - p / PMAX) * plotH; }
   function yInvert(y) { return PMAX * (1 - (y - PAD.t) / plotH); }
 
   function render(p) {
     curP = p;
     var y = yScale(p);
     handle.setAttribute('cy', y.toFixed(1));
     handleLine.setAttribute('y1', y.toFixed(1));
     handleLine.setAttribute('y2', y.toFixed(1));
     handle.setAttribute('aria-valuenow', Math.round(p));
 
     var qd = Math.max(0, Math.min(QMAX, 200 - 2 * p));
     var qs_ = Math.max(0, Math.min(QMAX, 2.5 * p));
     var lo = Math.min(qd, qs_), hi = Math.max(qd, qs_);
     var axisY = yScale(0);
     gapLine.setAttribute('x1', xScale(lo).toFixed(1));
     gapLine.setAttribute('x2', xScale(hi).toFixed(1));
     gapLine.setAttribute('y1', axisY.toFixed(1));
     gapLine.setAttribute('y2', axisY.toFixed(1));
 
     var diff = Math.abs(qd - qs_);
     if (diff < 3) {
       gapLine.style.opacity = 0;
       readout.classList.remove('is-shortage');
       readout.innerHTML = 'Ở mức giá này, <b>lượng cung khớp lượng cầu</b> quanh điểm cân bằng — chợ tự thanh toán mà không cần ai can thiệp, đúng như Hồi 1 của câu chuyện.';
     } else if (qd > qs_) {
       gapLine.classList.remove('is-surplus');
       gapLine.style.opacity = 1;
       readout.classList.add('is-shortage');
       readout.innerHTML = 'Giá bị ấn định <b>thấp hơn</b> mức cân bằng: lượng cầu vượt lượng cung khoảng <b class="num">' + Math.round(diff) + '</b> đơn vị bánh. Đây chính là "bánh khan" — hệ quả khi trưởng làng ấn định giá ở cuối Hồi 3.';
     } else {
       gapLine.classList.add('is-surplus');
       gapLine.style.opacity = 1;
       readout.classList.remove('is-shortage');
       readout.innerHTML = 'Giá bị ấn định <b>cao hơn</b> mức cân bằng: lượng cung vượt lượng cầu khoảng <b class="num">' + Math.round(diff) + '</b> đơn vị bánh — làm ra nhiều hơn mức chợ cần, hàng tồn chất lại.';
     }
   }
 
   function svgY(evt) {
     var rect = svg.getBoundingClientRect();
     var scaleY = VB_H / rect.height;
     return (evt.clientY - rect.top) * scaleY;
   }
 
   function setFromY(y) {
     y = Math.max(PAD.t + 2, Math.min(PAD.t + plotH - 2, y));
     var p = yInvert(y);
     p = Math.max(3, Math.min(97, p));
     render(p);
   }
 
   var dragging = false;
   function startDrag(e) {
     dragging = true;
     if (e.pointerId !== undefined && handle.setPointerCapture) {
       try { handle.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
     }
     setFromY(svgY(e));
   }
   function moveDrag(e) { if (dragging) setFromY(svgY(e)); }
   function endDrag() { dragging = false; }
 
   handle.addEventListener('pointerdown', startDrag);
   handleLine.addEventListener('pointerdown', startDrag);
   svg.addEventListener('pointermove', moveDrag);
   window.addEventListener('pointerup', endDrag);
   window.addEventListener('pointercancel', endDrag);
 
   handle.setAttribute('tabindex', '0');
   handle.setAttribute('role', 'slider');
   handle.setAttribute('aria-label', 'Kéo để thay đổi mức giá bánh do trưởng làng ấn định');
   handle.setAttribute('aria-valuemin', '3');
   handle.setAttribute('aria-valuemax', '97');
   handle.addEventListener('keydown', function (e) {
     if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); render(Math.min(97, curP + 2)); }
     else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); render(Math.max(3, curP - 2)); }
   });
 
   if (resetBtn) {
     resetBtn.addEventListener('click', function () { render(P_EQ); });
   }
 
   render(P_EQ);
 }
 
 /* ------------------------------------------------------------------ *
  * 9. Hoạt ảnh nền hero — đàn hạt tự tổ chức (mô phỏng "bàn tay vô hình")
  *    Thuật toán boid cổ điển: tách đàn, thẳng hàng, tụ đàn.
  * ------------------------------------------------------------------ */
 function initHeroCanvas() {
   var canvas = document.getElementById('hero-canvas');
   var heroEl = document.getElementById('hero');
   if (!canvas || !heroEl || !canvas.getContext) return;
   var ctx = canvas.getContext('2d');
   var dpr = Math.min(window.devicePixelRatio || 1, 2);
   var W = 0, H = 0;
   var boids = [];
   var mouse = { x: -9999, y: -9999, active: false };
   var rafId = null;
   var running = false;
 
   var CFG = {
     neighbor: 68,
     sep: 24,
     maxSpeed: 0.85,
     minSpeed: 0.22,
     margin: 55,
     linkDist: 92
   };
 
   function countFor(w) {
     if (w < 620) return 40;
     if (w < 1100) return 60;
     return 84;
   }
 
   function resize() {
     var rect = canvas.getBoundingClientRect();
     W = rect.width; H = rect.height;
     canvas.width = Math.max(1, Math.round(W * dpr));
     canvas.height = Math.max(1, Math.round(H * dpr));
     ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
   }
 
   function seed() {
     var n = countFor(W);
     boids = [];
     for (var i = 0; i < n; i++) {
       boids.push({
         x: Math.random() * W,
         y: Math.random() * H,
         vx: (Math.random() - 0.5) * 0.5,
         vy: (Math.random() - 0.5) * 0.5,
         r: 1.3 + Math.random() * 1.5
       });
     }
   }
 
   function step() {
     for (var i = 0; i < boids.length; i++) {
       var b = boids[i];
       var ax = 0, ay = 0, cx = 0, cy = 0, avx = 0, avy = 0, sx = 0, sy = 0;
       var count = 0, sepCount = 0;
       for (var j = 0; j < boids.length; j++) {
         if (i === j) continue;
         var o = boids[j];
         var dx = o.x - b.x, dy = o.y - b.y;
         var d2 = dx * dx + dy * dy;
         if (d2 < CFG.neighbor * CFG.neighbor) {
           cx += o.x; cy += o.y;
           avx += o.vx; avy += o.vy;
           count++;
           if (d2 < CFG.sep * CFG.sep && d2 > 0.0001) {
             sx -= dx / d2; sy -= dy / d2;
             sepCount++;
           }
         }
       }
       if (count > 0) {
         cx /= count; cy /= count;
         ax += (cx - b.x) * 0.0009;
         ay += (cy - b.y) * 0.0009;
         avx /= count; avy /= count;
         ax += (avx - b.vx) * 0.045;
         ay += (avy - b.vy) * 0.045;
       }
       if (sepCount > 0) { ax += sx * 0.6; ay += sy * 0.6; }
 
       if (b.x < CFG.margin) ax += (CFG.margin - b.x) * 0.004;
       if (b.x > W - CFG.margin) ax -= (b.x - (W - CFG.margin)) * 0.004;
       if (b.y < CFG.margin) ay += (CFG.margin - b.y) * 0.004;
       if (b.y > H - CFG.margin) ay -= (b.y - (H - CFG.margin)) * 0.004;
 
       if (mouse.active) {
         var mdx = b.x - mouse.x, mdy = b.y - mouse.y;
         var md2 = mdx * mdx + mdy * mdy;
         var R = 120;
         if (md2 < R * R && md2 > 1) {
           var f = (R * R - md2) / (R * R) * 0.028;
           var md = Math.sqrt(md2);
           ax += (mdx / md) * f;
           ay += (mdy / md) * f;
         }
       }
 
       b.vx += ax; b.vy += ay;
       var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
       if (sp > CFG.maxSpeed) { b.vx = (b.vx / sp) * CFG.maxSpeed; b.vy = (b.vy / sp) * CFG.maxSpeed; }
       else if (sp < CFG.minSpeed && sp > 0.0001) { b.vx = (b.vx / sp) * CFG.minSpeed; b.vy = (b.vy / sp) * CFG.minSpeed; }
       b.x += b.vx; b.y += b.vy;
     }
   }
 
   function draw() {
     ctx.clearRect(0, 0, W, H);
     ctx.lineWidth = 1;
     for (var i = 0; i < boids.length; i++) {
       for (var j = i + 1; j < boids.length; j++) {
         var dx = boids[j].x - boids[i].x, dy = boids[j].y - boids[i].y;
         var d = Math.sqrt(dx * dx + dy * dy);
         if (d < CFG.linkDist) {
           var a = (1 - d / CFG.linkDist) * 0.15;
           ctx.strokeStyle = 'rgba(215,168,76,' + a.toFixed(3) + ')';
           ctx.beginPath();
           ctx.moveTo(boids[i].x, boids[i].y);
           ctx.lineTo(boids[j].x, boids[j].y);
           ctx.stroke();
         }
       }
     }
     for (i = 0; i < boids.length; i++) {
       var b = boids[i];
       ctx.beginPath();
       ctx.fillStyle = 'rgba(233,205,143,0.92)';
       ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
       ctx.fill();
     }
   }
 
   function loop() {
     step();
     draw();
     rafId = requestAnimationFrame(loop);
   }
 
   function start() {
     if (running) return;
     running = true;
     rafId = requestAnimationFrame(loop);
   }
   function stop() {
     running = false;
     if (rafId) cancelAnimationFrame(rafId);
     rafId = null;
   }
 
   resize();
   seed();
 
   if (reduceMotion) {
     for (var s = 0; s < 140; s++) step();
     draw();
   } else {
     if ('IntersectionObserver' in window) {
       var io = new IntersectionObserver(function (entries) {
         entries.forEach(function (entry) {
           if (entry.isIntersecting) start(); else stop();
         });
       }, { threshold: 0.01 });
       io.observe(heroEl);
     } else {
       start();
     }
     heroEl.addEventListener('mousemove', function (e) {
       var rect = canvas.getBoundingClientRect();
       mouse.x = e.clientX - rect.left;
       mouse.y = e.clientY - rect.top;
       mouse.active = true;
       heroEl.style.setProperty('--hx', mouse.x.toFixed(0) + 'px');
       heroEl.style.setProperty('--hy', mouse.y.toFixed(0) + 'px');
     });
     heroEl.addEventListener('mouseleave', function () { mouse.active = false; });
   }
 
   var resizeTimer = null;
   window.addEventListener('resize', function () {
     window.clearTimeout(resizeTimer);
     resizeTimer = window.setTimeout(function () {
       resize();
       if (reduceMotion) draw();
     }, 180);
   });
 }
 
 /* ------------------------------------------------------------------ *
   * 10. Tiêu đề hero — tách từng ký tự để chữ trồi lên lần lượt khi tải trang
  *     (chỉ bọc chữ trong thẻ span, không đổi nội dung)
  * ------------------------------------------------------------------ */
 function initHeroTitle() {
   var h1 = qs('.hero__title');
   if (!h1 || reduceMotion) return;
   var n = 0;
   function wrap(node) {
     Array.prototype.slice.call(node.childNodes).forEach(function (child) {
       if (child.nodeType === 3) {
         var parts = child.textContent.split(/(\s+)/);
         var frag = document.createDocumentFragment();
         parts.forEach(function (p) {
           if (!p) return;
           if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
           var outer = document.createElement('span');
           outer.className = 'w';
           Array.prototype.slice.call(p).forEach(function (character) {
             var inner = document.createElement('span');
             inner.className = 'w__in';
             inner.style.setProperty('--i', n++);
             inner.textContent = character;
             outer.appendChild(inner);
           });
           frag.appendChild(outer);
         });
         node.replaceChild(frag, child);
       } else if (child.nodeType === 1) {
         wrap(child);
       }
     });
   }
   h1.setAttribute('aria-label', h1.textContent);
   wrap(h1);
   h1.classList.add('is-split');
 }
 
 /* ------------------------------------------------------------------ *
  * 11. Vệt sáng theo con trỏ (chỉ trên thiết bị có chuột)
  * ------------------------------------------------------------------ */
 function initSpotlight() {
   if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
   var root = document.documentElement;
   var x = 0, y = 0, queued = false;
   window.addEventListener('pointermove', function (e) {
     x = e.clientX; y = e.clientY;
     if (queued) return;
     queued = true;
     window.requestAnimationFrame(function () {
       root.style.setProperty('--mx', x + 'px');
       root.style.setProperty('--my', y + 'px');
       root.classList.add('has-pointer');
       queued = false;
     });
   }, { passive: true });
   document.addEventListener('mouseleave', function () { root.classList.remove('has-pointer'); });
 }
 
 /* ------------------------------------------------------------------ *
  * Khởi động
  * ------------------------------------------------------------------ */
 document.addEventListener('DOMContentLoaded', function () {
   function safe(fn) { try { fn(); } catch (err) { if (window.console) console.error(err); } }
   safe(initHeroTitle);
   safe(initProgress);
   safe(initScrollSpy);
   safe(initKeyboardNav);
   safe(initMobileSheet);
   safe(initChartMotion);
   safe(initMotionCards);
   safe(initReveal);
   safe(initScrollMotion);
   safe(initCosmicDust);
   safe(initStory);
   safe(initSupplyDemand);
   safe(initHeroCanvas);
   safe(initSpotlight);
 });
})();
