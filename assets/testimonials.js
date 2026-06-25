/* Testimonials mobile carousel: arrows + auto-scroll.
   Active only at phone widths (<=640px). Injects its own arrow
   buttons so no per-page markup is needed. */
(function () {
  "use strict";

  var MOBILE = window.matchMedia("(max-width: 640px)");

  function setup() {
    var section = document.querySelector(".testimonials");
    if (!section) return;
    var grid = section.querySelector(".grid");
    if (!grid || grid.dataset.carousel === "ready") return;
    grid.dataset.carousel = "ready";

    // Wrap the grid so arrows can be positioned over its edges.
    var wrap = document.createElement("div");
    wrap.className = "tcarousel";
    grid.parentNode.insertBefore(wrap, grid);
    wrap.appendChild(grid);

    var prev = makeArrow("prev", "Previous testimonial", "‹");
    var next = makeArrow("next", "Next testimonial", "›");
    wrap.appendChild(prev);
    wrap.appendChild(next);

    function cardStep() {
      var card = grid.querySelector(".testimonial");
      if (!card) return grid.clientWidth;
      var gap = parseFloat(getComputedStyle(grid).columnGap) || 14;
      return card.getBoundingClientRect().width + gap;
    }

    function atEnd() {
      return grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4;
    }

    function go(dir) {
      if (dir > 0 && atEnd()) {
        grid.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        grid.scrollBy({ left: dir * cardStep(), behavior: "smooth" });
      }
    }

    prev.addEventListener("click", function () { go(-1); pause(); });
    next.addEventListener("click", function () { go(1); pause(); });

    // Auto-scroll.
    var timer = null;
    function start() {
      if (timer || !MOBILE.matches) return;
      timer = setInterval(function () { go(1); }, 3500);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    var resume = null;
    function pause() {
      stop();
      clearTimeout(resume);
      resume = setTimeout(start, 6000);
    }

    ["touchstart", "pointerdown", "wheel"].forEach(function (ev) {
      grid.addEventListener(ev, pause, { passive: true });
    });

    function sync() {
      if (MOBILE.matches) { start(); }
      else { stop(); }
    }
    if (MOBILE.addEventListener) MOBILE.addEventListener("change", sync);
    else if (MOBILE.addListener) MOBILE.addListener(sync);
    sync();
  }

  function makeArrow(kind, label, glyph) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tcarousel-arrow tcarousel-" + kind;
    b.setAttribute("aria-label", label);
    b.innerHTML = "<span aria-hidden='true'>" + glyph + "</span>";
    return b;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
