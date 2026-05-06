// ===== LOGIN.JS =====

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pwd   = document.getElementById('loginPassword').value;
  const msg   = document.getElementById('loginMsg');
  const btn   = document.querySelector('.btn-primary');

  msg.className = 'login-msg';
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const data = await loginUser(email, pwd);
    setCurrentUser(data.user);

    msg.className = 'login-msg success';
    msg.textContent = '✓ Login successful! Redirecting…';

    setTimeout(() => {
      window.location.href = data.user.role + '.html';
    }, 700);
  } catch (err) {
    msg.className = 'login-msg error';
    msg.textContent = '✗ ' + (err.message || 'Invalid email or password.');
    btn.disabled = false;
    btn.innerHTML = 'Sign In <span>→</span>';
  }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('fade-out');
  }, 1800);
});

// =====================================================================
//  SPLASH SCREEN — NERVE CANVAS ANIMATION
// =====================================================================
(function initSplash(){
  const splash = document.getElementById('splash');
  if(!splash) return;

  // Prevent splash from showing when navigating via browser back/forward button
  const navEntries = window.performance.getEntriesByType("navigation");
  if (navEntries.length > 0 && navEntries[0].type === "back_forward") {
    splash.style.display = 'none';
    return;
  }

  const canvas = document.getElementById('nerveCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, nodes=[], RAF;

  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Node {
    constructor(){
      this.x = Math.random()*W;
      this.y = Math.random()*H;
      this.vx = (Math.random()-.5)*.6;
      this.vy = (Math.random()-.5)*.6;
      this.r = Math.random()*2.5+1;
      this.pulse = Math.random()*Math.PI*2;
      this.pulseSpeed = .02+Math.random()*.03;
    }
    update(){
      this.x+=this.vx; this.y+=this.vy;
      this.pulse+=this.pulseSpeed;
      if(this.x<0||this.x>W) this.vx*=-1;
      if(this.y<0||this.y>H) this.vy*=-1;
    }
    draw(){
      const glow = (Math.sin(this.pulse)+1)/2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r*(1+glow*.4), 0, Math.PI*2);
      ctx.fillStyle = `rgba(76,175,80,${.4+glow*.5})`;
      ctx.fill();
    }
  }

  for(let i=0;i<90;i++) nodes.push(new Node());

  let signalNodes=[];
  function spawnSignal(a,b){
    signalNodes.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,t:0,speed:.025+Math.random()*.02});
  }
  let signalTimer=0;

  function draw(){
    ctx.clearRect(0,0,W,H);
    nodes.forEach(n=>n.update());

    for(let i=0;i<nodes.length;i++){
      for(let j=i+1;j<nodes.length;j++){
        const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<160){
          const alpha=(1-dist/160)*.25;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          const mx=(nodes[i].x+nodes[j].x)/2+(Math.random()-.5)*10;
          const my=(nodes[i].y+nodes[j].y)/2+(Math.random()-.5)*10;
          ctx.quadraticCurveTo(mx, my, nodes[j].x, nodes[j].y);
          ctx.strokeStyle=`rgba(76,175,80,${alpha})`;
          ctx.lineWidth=.7;
          ctx.stroke();
        }
      }
    }

    signalTimer++;
    if(signalTimer%18===0){
      const a=nodes[Math.floor(Math.random()*nodes.length)];
      const b=nodes[Math.floor(Math.random()*nodes.length)];
      if(a!==b) spawnSignal(a,b);
    }

    signalNodes=signalNodes.filter(s=>{
      s.t+=s.speed;
      if(s.t>1) return false;
      const x=s.ax+(s.bx-s.ax)*s.t;
      const y=s.ay+(s.by-s.ay)*s.t;
      const g=ctx.createRadialGradient(x,y,0,x,y,8);
      g.addColorStop(0,'rgba(139,195,74,.9)');
      g.addColorStop(1,'rgba(76,175,80,0)');
      ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      return true;
    });

    nodes.forEach(n=>n.draw());
    RAF=requestAnimationFrame(draw);
  }
  draw();

  setTimeout(()=>{
    const splash=document.getElementById('splash');
    if(splash) {
      splash.classList.add('hide');
      cancelAnimationFrame(RAF);
      setTimeout(()=>{ splash.style.display='none'; }, 1000);
    }
  }, 3000);
})();

// =====================================================================
//  ABOUT US MODAL
// =====================================================================
function openAbout(){
  const modal=document.getElementById('aboutModal');
  if(!modal) return;
  modal.style.display='flex';
  requestAnimationFrame(()=>{ modal.classList.add('open'); });

  const c=document.getElementById('aboutCanvas');
  if(!c||c._running) return;
  c._running=true;
  const ctx=c.getContext('2d');
  const card=c.parentElement;

  function resizeC(){
    c.width=card.offsetWidth; c.height=card.offsetHeight;
  }
  resizeC();

  const pts=[];
  for(let i=0;i<40;i++) pts.push({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4});

  function animC(){
    if(!c._running) return;
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>c.width) p.vx*=-1;
      if(p.y<0||p.y>c.height) p.vy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,1.5,0,Math.PI*2);
      ctx.fillStyle='rgba(76,175,80,.5)'; ctx.fill();
    });
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<100){ ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.strokeStyle=`rgba(76,175,80,${(1-d/100)*.18})`; ctx.lineWidth=.6; ctx.stroke(); }
    }
    requestAnimationFrame(animC);
  }
  animC();

  document.querySelectorAll('.pillar').forEach((el,i)=>{
    el.style.opacity='0'; el.style.transform='translateY(24px)';
    setTimeout(()=>{ el.style.transition='all .5s ease'; el.style.opacity='1'; el.style.transform='translateY(0)'; }, 200+i*100);
  });
  const devCard = document.querySelector('.dev-card');
  if(devCard) {
    devCard.style.opacity='0';
    setTimeout(()=>{ devCard.style.transition='all .6s ease'; devCard.style.opacity='1'; }, 700);
  }
}

function closeAbout(){
  const modal=document.getElementById('aboutModal');
  if(modal) modal.classList.remove('open');
  const c=document.getElementById('aboutCanvas');
  if(c) c._running=false;
  setTimeout(()=>{ if(modal) modal.style.display='none'; }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('aboutModal');
  if(modal) {
    modal.addEventListener('click', function(e){ if(e.target===this) closeAbout(); });
  }
});
