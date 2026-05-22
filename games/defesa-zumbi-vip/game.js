const worlds = [
  { name: 'Floresta Sombria', theme: ['#1f4d2c', '#0f2a16'], path: '#9ec06b' },
  { name: 'Caverna Tóxica', theme: ['#485b2a', '#1f2a12'], path: '#b1ce70' },
  { name: 'Vila Assombrada', theme: ['#5b3f4c', '#251822'], path: '#c89eac' }
];

const towerTypes = [
  { id: 'gelo', name: 'Torre de Gelo', cost: 90, color: '#91f1ff', dmg: 11, rate: 58, range: 120 },
  { id: 'veneno', name: 'Torre de Veneno', cost: 100, color: '#7dff6f', dmg: 8, rate: 45, range: 115, dot: 1.5 },
  { id: 'vento', name: 'Torre de Vento', cost: 95, color: '#d9f4ff', dmg: 7, rate: 30, range: 130 },
  { id: 'eletrica', name: 'Torre Elétrica', cost: 130, color: '#bd9dff', dmg: 13, rate: 52, range: 125, chain: true },
  { id: 'fogo', name: 'Torre de Fogo', cost: 120, color: '#ff8d5b', dmg: 14, rate: 55, range: 110, burn: 1.7 },
  { id: 'agua', name: 'Torre de Água', cost: 110, color: '#63b8ff', dmg: 10, rate: 35, range: 130 },
  { id: 'explosiva', name: 'Torre Explosiva', cost: 150, color: '#ffd45f', dmg: 24, rate: 75, range: 118, splash: 45 }
];

const el = id => document.getElementById(id);
const canvas = el('gameCanvas'), ctx = canvas.getContext('2d');
let W=0,H=0,selected=null,state;
const audio = new (window.AudioContext||window.webkitAudioContext)();
function beep(f=220,t=0.08,v=0.03){ const o=audio.createOscillator(),g=audio.createGain(); o.connect(g);g.connect(audio.destination);o.frequency.value=f;o.type='triangle';g.gain.value=v;o.start();g.gain.exponentialRampToValueAtTime(0.0001,audio.currentTime+t);o.stop(audio.currentTime+t); }

function initMenu(){
  const w = el('worlds');
  w.innerHTML='';
  worlds.forEach((world,i)=>{
    const b=document.createElement('button'); b.className='world-btn';
    b.innerHTML=`<h3>${world.name}</h3><small>Mundo ${i+1}</small>`;
    b.onclick=()=>start(world);
    w.appendChild(b);
  });
}
function resize(){ W=canvas.width=canvas.clientWidth*devicePixelRatio; H=canvas.height=canvas.clientHeight*devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
addEventListener('resize',resize);

function start(world){
  el('menu').classList.add('hidden'); el('gameSection').classList.remove('hidden');
  state={world,life:100,money:300,wave:1,maxWave:8,gameOver:false,towers:[],shots:[],zombies:[],particles:[],ticks:0,path:[],spawn:0,boss:false};
  buildPath(); buildShop(); resize(); loop();
}
function buildPath(){
  const p=[[20,90],[200,90],[200,220],[420,220],[420,120],[680,120],[680,310],[140,310],[140,430],[860,430]];
  state.path=p;
}
function spawnZombie(boss=false){
  const hp = boss?420+state.wave*45:45+state.wave*13;
  state.zombies.push({x:state.path[0][0],y:state.path[0][1],i:1,speed: boss?0.42:0.58+state.wave*0.04,hp,max:hp,size:boss?34:20,poison:0,burn:0,shadow:boss?0.55:0.35,boss});
}
function buildShop(){
  const shop=el('shop'); shop.innerHTML='';
  towerTypes.forEach(t=>{const c=document.createElement('div');c.className='card'; c.innerHTML=`<strong>${t.name}</strong><small>💰 ${t.cost}</small>`; c.onclick=()=>{selected=t.id; [...shop.children].forEach(k=>k.classList.remove('active')); c.classList.add('active'); beep(440);}; shop.appendChild(c);});
}
canvas?.addEventListener('click',e=>{
  if(!state||state.gameOver||!selected) return;
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const t= towerTypes.find(v=>v.id===selected);
  if(state.money<t.cost) return;
  if(state.path.some(([px,py])=>Math.hypot(px-x,py-y)<50)) return;
  state.money-=t.cost; state.towers.push({x,y,lvl:1,cool:0,type:t}); beep(250,0.1,0.05);
});
canvas?.addEventListener('contextmenu',e=>{
  e.preventDefault(); if(!state)return;
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const t=state.towers.find(tt=>Math.hypot(tt.x-x,tt.y-y)<24); if(!t)return;
  state.money+=Math.floor(t.type.cost*0.6); state.towers=state.towers.filter(v=>v!==t); beep(180);
});

function update(){
  state.ticks++; if(state.gameOver) return;
  if(state.spawn--<=0){ if(state.wave<state.maxWave||state.zombies.length){ spawnZombie(false); state.spawn=90-state.wave*5; } }
  if(state.wave===state.maxWave && !state.boss && state.zombies.length<4){ spawnZombie(true); state.boss=true; }

  state.zombies.forEach(z=>{
    const t=state.path[z.i]; if(!t){ state.life-=z.boss?18:8; z.hp=0; return; }
    const dx=t[0]-z.x,dy=t[1]-z.y,d=Math.hypot(dx,dy); if(d<3)z.i++; else { z.x += dx/d*z.speed; z.y += dy/d*z.speed; }
    if(z.poison>0){z.hp-=0.2;z.poison--;}
    if(z.burn>0){z.hp-=0.35;z.burn--;}
  });

  state.towers.forEach(t=>{
    if(t.cool-->0) return;
    const z=state.zombies.find(v=>Math.hypot(v.x-t.x,v.y-t.y)<t.type.range && v.hp>0); if(!z) return;
    t.cool=t.type.rate-((t.lvl-1)*3);
    state.shots.push({x:t.x,y:t.y,target:z,speed:4.2,color:t.type.color,tower:t});
    beep(520,0.04,0.02);
  });

  state.shots.forEach(s=>{
    if(!s.target||s.target.hp<=0) return s.dead=true;
    const dx=s.target.x-s.x,dy=s.target.y-s.y,d=Math.hypot(dx,dy);
    if(d<8){
      let dmg=s.tower.type.dmg+s.tower.lvl*2;
      s.target.hp-=dmg;
      if(s.tower.type.dot) s.target.poison=80;
      if(s.tower.type.burn) s.target.burn=55;
      if(s.tower.type.splash){state.zombies.forEach(z=>{if(Math.hypot(z.x-s.target.x,z.y-s.target.y)<s.tower.type.splash)z.hp-=dmg*0.55;});}
      if(s.tower.type.chain){state.zombies.slice(0,2).forEach(z=>z.hp-=dmg*0.33);}
      for(let i=0;i<10;i++) state.particles.push({x:s.target.x,y:s.target.y,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:25,c:s.color});
      beep(130,0.07,0.03); s.dead=true;
    } else { s.x+=dx/d*s.speed; s.y+=dy/d*s.speed; }
  });

  state.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;});
  state.particles=state.particles.filter(p=>p.life>0);
  state.shots=state.shots.filter(s=>!s.dead);
  state.zombies=state.zombies.filter(z=>z.hp>0);
  if(state.life<=0){ state.gameOver=true; el('restartBtn').classList.remove('hidden'); }
  if(state.wave<state.maxWave && state.ticks%900===0) state.wave++;
  if(state.wave===state.maxWave && state.boss && !state.zombies.some(z=>z.boss)){ state.gameOver=true; el('restartBtn').classList.remove('hidden'); }
}

function draw(){
  const g=ctx.createLinearGradient(0,0,0,canvas.clientHeight); g.addColorStop(0,state.world.theme[0]); g.addColorStop(1,state.world.theme[1]); ctx.fillStyle=g; ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
  ctx.lineWidth=32; ctx.strokeStyle=state.world.path; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=14;
  ctx.beginPath(); state.path.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke();
  ctx.shadowBlur=0;
  state.towers.forEach(t=>{ ctx.fillStyle='rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(t.x+6,t.y+18,14,7,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=t.type.color; ctx.beginPath(); ctx.arc(t.x,t.y,16,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#fff'; ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillText('★'.repeat(t.lvl),t.x-9,t.y+4); });
  state.shots.forEach(s=>{ctx.fillStyle=s.color; ctx.shadowColor=s.color; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(s.x,s.y,5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;});
  state.zombies.forEach(z=>{ ctx.fillStyle=`rgba(0,0,0,${z.shadow})`; ctx.beginPath(); ctx.ellipse(z.x+5,z.y+z.size*.8,z.size*.5,z.size*.2,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=z.boss?'#8a1b1b':'#5abf62'; ctx.beginPath(); ctx.arc(z.x,z.y,z.size/2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillRect(z.x-z.size/2,z.y-z.size/2-10,z.size,5); ctx.fillStyle=z.boss?'#ff4466':'#5dff95'; ctx.fillRect(z.x-z.size/2,z.y-z.size/2-10,(z.hp/z.max)*z.size,5); });
  state.particles.forEach(p=>{ctx.fillStyle=p.c;ctx.globalAlpha=p.life/25;ctx.fillRect(p.x,p.y,3,3);ctx.globalAlpha=1;});
  if(state.boss){ const b=state.zombies.find(z=>z.boss); if(b){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(20,20,320,18); ctx.fillStyle='#ff5d7f'; ctx.fillRect(20,20,(b.hp/b.max)*320,18); ctx.strokeStyle='#fff'; ctx.strokeRect(20,20,320,18);} }
}

function ui(){
  el('life').textContent=Math.max(0,Math.floor(state.life)); el('money').textContent=Math.floor(state.money); el('wave').textContent=`${state.wave}/${state.maxWave}`;
  const panel=el('towerPanel'); panel.innerHTML='<h3>Upgrades e Venda</h3><p>Toque em uma torre: upgrade (custo 70). Clique direito: vender.</p>';
}
canvas.addEventListener('dblclick',e=>{if(!state)return; const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top; const t=state.towers.find(tt=>Math.hypot(tt.x-x,tt.y-y)<24); if(!t||state.money<70||t.lvl>=4)return; state.money-=70; t.lvl++; beep(620,.08,.05);});
el('restartBtn').onclick=()=>location.reload();

function loop(){ if(!state) return; update(); draw(); ui(); requestAnimationFrame(loop); }
initMenu();
