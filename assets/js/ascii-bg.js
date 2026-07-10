/**
 * ascii-bg.js — v16 — subtle dusty film, dithered dust (no worms)
 *
 * Signal: #A3B8A8 dusty sage, desaturated, much quieter.
 * Particles: no velocity trails. Pure dithered points with bayer threshold,
 * size <1.6px, additive sparkle only near cursor, deep fade (alpha 0.38-0.48).
 * Motion: slow fbm drift, almost still. Contours: very faint, sparse.
 */

(function(){
  var reduced = false;
  try{ reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{}
  var fine=false; try{ fine=matchMedia('(pointer: fine)').matches; }catch{}

  var FPS = reduced?0:24;
  var COUNT_BASE = (typeof innerWidth!=='undefined' && innerWidth<720)?70:140;
  var COUNT = reduced?0:COUNT_BASE;

  var canvas, ctx, w=0, h=0, dpr=1;
  var frame=0, last=0, stepMs=1000/Math.max(1,FPS);
  var mx=-9999,my=-9999, tx=-9999,ty=-9999, mvx=0,mvy=0, active=false, idle=0;
  var sys=null, intens=1, hidden=false;

  // 8x8 bayer matrix for dithering/thresholding dust visibility
  var BAYER = [
    [0,48,12,60,3,51,15,63],
    [32,16,44,28,35,19,47,31],
    [8,56,4,52,11,59,7,55],
    [40,24,36,20,43,27,39,23],
    [2,50,14,62,1,49,13,61],
    [34,18,46,30,33,17,45,29],
    [10,58,6,54,9,57,5,53],
    [42,26,38,22,41,25,37,21]
  ];

  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function n2(x,y){ var s=Math.sin(x*12.9898+y*78.233)*43758.5453; return (s-Math.floor(s))*2-1; }
  function fbm(x,y){
    var v=0,a=0.5,f=1;
    for(var i=0;i<3;i++){ v+=a*n2(x*f,y*f); a*=0.5; f*=2.07; }
    return v;
  }

  // very gentle flow — slow, low amplitude, no dominant direction to avoid worm lines
  function flowAt(x,y,t){
    var e=12;
    var n0=fbm(x*0.0011+t*0.012,y*0.0011+Math.sin(t*0.01)*0.22);
    var nx=fbm((x+e)*0.0011+t*0.012,y*0.0011+Math.sin(t*0.01)*0.22);
    var ny=fbm(x*0.0011+t*0.012,(y+e)*0.0011+Math.sin(t*0.01)*0.22);
    var dfx=(nx-n0)/e, dfy=(ny-n0)/e;
    var fx=-dfy*14, fy=dfx*14; // much weaker than before (was 72)

    // micro radial bias — barely perceptible
    var cx=w*0.68, cy=h*0.42, dx=x-cx, dy=y-cy;
    var rad=Math.exp(-(dx*dx+dy*dy)/(Math.pow(Math.min(w,h)*0.78,2)));
    fx+=-dy*0.018*rad; fy+=dx*0.018*rad;

    if(active){
      var pdx=x-mx, pdy=y-my, d2=pdx*pdx+pdy*pdy;
      var r=fine?240:160, r2=r*r;
      if(d2<r2){
        var d=Math.sqrt(d2)+1e-4;
        var inf=Math.exp(-d2/r2); // smooth falloff
        // gentle curl + very soft attraction — no harsh twist
        var ang=Math.atan2(pdy,pdx)+Math.PI*0.5;
        fx+=Math.cos(ang)*inf*22 - (pdx/d)*inf*8 + mvx*inf*0.8;
        fy+=Math.sin(ang)*inf*22 - (pdy/d)*inf*8 + mvy*inf*0.8;
      }
    }
    if(sys){
      var k=sys==='fractal'?0.18:sys==='spatial'?-0.12:0.06;
      fx+=Math.sin(y*0.0012+t*0.12)*5*k;
      fy+=Math.cos(x*0.0010+t*0.10)*4*k;
    }
    return [fx*intens, fy*intens, n0];
  }

  function mkP(){
    return {
      x:Math.random()*w, y:Math.random()*h,
      vx:0, vy:0,
      life:Math.random()*0.8+0.2,
      sz:Math.random()*0.9+0.28, // tiny
      seed:(Math.random()*1000)|0,
      d:Math.random()
    };
  }
  var ps=[];

  function resize(){
    dpr=Math.min(typeof devicePixelRatio!=='undefined'?devicePixelRatio:1, 2);
    w=typeof innerWidth!=='undefined'?innerWidth:1280;
    h=typeof innerHeight!=='undefined'?innerHeight:800;
    if(!canvas) return;
    canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function staticField(){
    var c=document.createElement('canvas'); c.id='field-canvas'; c.setAttribute('aria-hidden','true');
    c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;background:#080C0A';
    document.body.prepend(c);
    var g=c.getContext('2d',{alpha:false}); if(!g) return;
    var dd=Math.min(typeof devicePixelRatio!=='undefined'?devicePixelRatio:1,2), ww=innerWidth, hh=innerHeight;
    c.width=Math.floor(ww*dd); c.height=Math.floor(hh*dd); g.setTransform(dd,0,0,dd,0,0);
    g.fillStyle='#080C0A'; g.fillRect(0,0,ww,hh);
    // single faint contour
    g.strokeStyle='rgba(163,184,168,.05)'; g.lineWidth=0.6; g.setLineDash([6,18]);
    g.beginPath(); g.ellipse(ww*.70,hh*.42,Math.min(ww,hh)*.28,Math.min(ww,hh)*.24,-.08,0,Math.PI*2); g.stroke();
    g.setLineDash([]);
    var vg=g.createRadialGradient(ww*.6,hh*.44,0,ww*.6,hh*.44,Math.max(ww,hh)*.92);
    vg.addColorStop(0,'rgba(8,12,10,0)'); vg.addColorStop(1,'rgba(8,12,10,.78)');
    g.fillStyle=vg; g.fillRect(0,0,ww,hh);
  }

  function init(){
    if(reduced){ staticField(); return; }
    canvas=document.createElement('canvas'); canvas.id='field-canvas';
    canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;background:#080C0A';
    document.body.prepend(canvas);
    var c=canvas.getContext('2d',{alpha:false}); if(!c) return; ctx=c;
    resize();
    for(var i=0;i<COUNT;i++) ps.push(mkP());

    addEventListener('resize',resize,{passive:true});
    addEventListener('mousemove',function(e){
      var dx=e.clientX-mx, dy=e.clientY-my;
      mvx=mvx*0.72+dx*0.28; mvy=mvy*0.72+dy*0.28;
      tx=e.clientX; ty=e.clientY; active=true;
    },{passive:true});
    addEventListener('mouseleave',function(){ idle=0; },{passive:true});
    addEventListener('pointerdown',function(){active=true},{passive:true});
    addEventListener('touchstart',function(){active=true},{passive:true});
    addEventListener('touchend',function(){ setTimeout(function(){active=false;},1200); },{passive:true});

    window.__field={
      setIntensity:function(v){ intens=clamp(v,0.06,2.2); },
      setSystem:function(id){ sys=id||null; },
      clearSystem:function(){ sys=null; },
      setPointer:function(x,y){ tx=x; ty=y; active=true; }
    };
    last=performance.now(); requestAnimationFrame(tick);
    document.addEventListener('visibilitychange',function(){
      hidden=document.hidden;
      if(!hidden){ last=performance.now(); requestAnimationFrame(tick); }
    });
  }

  function tick(ts){
    if(hidden) return; if(!ctx){ requestAnimationFrame(tick); return; }
    requestAnimationFrame(tick);
    if(ts-last<stepMs) return;
    var dt=Math.min((ts-last)/16.666,2.2); last=ts; frame+=1;

    if(tx>-9000){ mx+=(tx-mx)*0.12; my+=(ty-my)*0.12; }
    else{ idle+=0.003; mx=w*.62+Math.sin(idle*.5)*w*.06; my=h*.42+Math.cos(idle*.38)*h*.08; active=false; }
    mvx*=0.94; mvy*=0.94;
    var t=frame*0.008; // slower

    // deep fade — much stronger clear so particles become sparse dust, not slime trails
    ctx.globalCompositeOperation='source-over';
    // slight sepia toward void, never bright
    ctx.fillStyle=active?'rgba(8,12,10,0.31)':'rgba(8,12,10,0.44)';
    ctx.fillRect(0,0,w,h);

    // contours — fewer, very faint, shorter — not worms
    ctx.save();
    ctx.strokeStyle='rgba(245,241,230,.018)';
    ctx.lineWidth=0.5;
    var steps=Math.max(2, Math.floor(h/96)); // fewer lines
    for(var i=0;i<steps;i++){
      var y0=(i/steps)*h*1.15 + Math.sin(t*0.6+i)*2;
      ctx.beginPath();
      var broken=false;
      for(var x=0;x<=w;x+=18){
        var _f=flowAt(x,y0,t), nn=_f[2];
        var off=(nn-0.5)*12; // smaller amplitude
        if(x===0){ ctx.moveTo(x,y0+off); }
        else{
          // occasional break to avoid long worm
          if(Math.random()<0.006){ ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y0+off); broken=true; }
          else ctx.lineTo(x,y0+off);
        }
      }
      if(!broken) ctx.stroke();
    }
    ctx.restore();

    // dithered dust — NO trails. Tiny circles with bayer threshold gating visibility.
    var cell = 3; // bayer sampling
    for(var j=0;j<ps.length;j++){
      var p=ps[j];
      var fl=flowAt(p.x,p.y,t); var fx=fl[0], fy=fl[1];
      // low-pass velocities — sluggish, dusty drift
      p.vx=p.vx*0.90+fx*0.020;
      p.vy=p.vy*0.90+fy*0.020;
      var sp=Math.hypot(p.vx,p.vy), cap=0.9; // much lower cap — no worms
      if(sp>cap){ p.vx*=cap/sp; p.vy*=cap/sp; }

      p.x+=p.vx*dt*0.55;
      p.y+=p.vy*dt*0.55;
      p.life-=0.0010*dt;

      if(p.life<=0||p.x<-16||p.x>w+16||p.y<-16||p.y>h+16){
        if(Math.random()<0.72){ p.x=Math.random()*w; p.y=-10; }
        else{ p.x=w*0.68+(Math.random()-0.5)*w*0.85; p.y=Math.random()*h; }
        p.vx=0; p.vy=0; p.life=Math.random()*0.85+0.15;
      }

      // bayer dither gate — only render some particles each frame
      var bx=((p.x/cell)|0)&7, by=((p.y/cell)|0)&7;
      var thresh=BAYER[by][bx]/64; // 0..1
      // combine bayer with life + noise for dithered sparsity
      var gate = (p.life*0.6 + (Math.sin(p.seed + t*2.1)*0.5+0.5)*0.25 + Math.random()*0.18);
      if(gate < thresh*0.88) continue; // dithered cull — creates dust, not smear

      var a=0.06 + p.life*0.22; // much lower base alpha — film grain
      var sz=p.sz;
      var near=false;
      if(active){
        var dx=p.x-mx, dy=p.y-my, d2=dx*dx+dy*dy;
        var r2=(fine?190:130)*(fine?190:130);
        if(d2<r2){
          var k=1-d2/r2;
          a+=k*0.36;
          sz+=k*0.9;
          near=true;
        }
      }
      a=clamp(a,0,0.70)*intens;
      if(a<0.02) continue;

      // pure point, no line
      ctx.beginPath();
      ctx.arc(p.x,p.y, sz*(0.55+p.d*0.22), 0, Math.PI*2);
      // dusty sage near pointer, warm bone otherwise — both very desaturated
      ctx.fillStyle=near
        ? 'rgba(163,184,168,'+a.toFixed(3)+')'
        : 'rgba(245,241,230,'+(a*0.32).toFixed(3)+')';
      ctx.fill();
    }

    // cursor lens — quieter, sage film, no harsh screen blend
    if(active&&fine){
      ctx.save();
      // soft sage wash — multiply, not screen
      var grd=ctx.createRadialGradient(mx,my,0,mx,my,160);
      grd.addColorStop(0,'rgba(163,184,168,.07)');
      grd.addColorStop(0.36,'rgba(163,184,168,.022)');
      grd.addColorStop(1,'rgba(163,184,168,0)');
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(mx,my,160,0,Math.PI*2); ctx.fill();

      ctx.strokeStyle='rgba(163,184,168,.16)'; ctx.lineWidth=0.6;
      ctx.setLineDash([4,12]); ctx.lineDashOffset=-t*10;
      ctx.beginPath(); ctx.arc(mx,my,48+Math.sin(t*1.0)*3,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle='rgba(245,241,230,.18)'; ctx.lineWidth=0.5;
      ctx.beginPath();
      ctx.moveTo(mx-9,my); ctx.lineTo(mx-3,my); ctx.moveTo(mx+3,my); ctx.lineTo(mx+9,my);
      ctx.moveTo(mx,my-9); ctx.lineTo(mx,my-3); ctx.moveTo(mx,my+3); ctx.lineTo(mx,my+9);
      ctx.stroke();
      ctx.restore();
    }

    // final vignette — keep hero readable, much softer now
    ctx.save();
    var vig=ctx.createRadialGradient(w*0.36,h*0.44,0,w*0.36,h*0.44,Math.max(w,h)*0.96);
    vig.addColorStop(0,'rgba(8,12,10,0)');
    vig.addColorStop(0.58,'rgba(8,12,10,.03)');
    vig.addColorStop(1,'rgba(8,12,10,.56)');
    ctx.globalCompositeOperation='multiply';
    ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
