// =====================================================================
// ANAS TECHNICAL WORLD — 3D / 4K THEME: animated particle-network
// background canvas. Purely visual/additive — does not touch any
// existing app state, storage, or logic in script.js.
// =====================================================================
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function init(){
    const canvas = document.createElement('canvas');
    canvas.id = 'theme3d-canvas';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let w, h, dpr;
    let points = [];
    const isMobile = window.innerWidth < 640;
    const COUNT = isMobile ? 34 : 70;
    const LINK_DIST = isMobile ? 110 : 150;

    function resize(){
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed(){
      points = [];
      for(let i = 0; i < COUNT; i++){
        points.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random() * 0.8 + 0.2, // depth 0.2 - 1.0 (for 3D-ish parallax size/speed)
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    }

    let mouseX = -9999, mouseY = -9999;
    window.addEventListener('mousemove', function(e){ mouseX = e.clientX; mouseY = e.clientY; });
    window.addEventListener('mouseleave', function(){ mouseX = -9999; mouseY = -9999; });

    function step(){
      ctx.clearRect(0, 0, w, h);
      // move
      for(const p of points){
        p.x += p.vx * p.z;
        p.y += p.vy * p.z;
        if(p.x < 0) p.x = w; if(p.x > w) p.x = 0;
        if(p.y < 0) p.y = h; if(p.y > h) p.y = 0;
      }
      // links
      for(let i = 0; i < points.length; i++){
        for(let j = i + 1; j < points.length; j++){
          const a = points[i], b = points[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(dist < LINK_DIST){
            const alpha = (1 - dist / LINK_DIST) * 0.22 * Math.min(a.z, b.z);
            ctx.strokeStyle = 'rgba(61,243,255,' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // link to mouse for a subtle interactive feel
        const dxm = points[i].x - mouseX, dym = points[i].y - mouseY;
        const dm = Math.sqrt(dxm*dxm + dym*dym);
        if(dm < LINK_DIST * 1.3){
          const alpha = (1 - dm / (LINK_DIST * 1.3)) * 0.3;
          ctx.strokeStyle = 'rgba(61,255,154,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.stroke();
        }
      }
      // nodes
      for(const p of points){
        const r = 1.1 + p.z * 1.6;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(61,243,255,' + (0.35 + p.z * 0.4).toFixed(3) + ')';
        ctx.shadowBlur = 6 * p.z;
        ctx.shadowColor = 'rgba(61,243,255,0.8)';
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(step);
    }

    resize();
    seed();
    step();
    window.addEventListener('resize', function(){ resize(); seed(); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
