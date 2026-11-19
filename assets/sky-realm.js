// The Storm Throne: a 1-bit dithered 3D sky palace above the meadow.
// Loaded on demand (after three.js r128) when you click the thundercloud in the meadow sky.
// window.SkyRealm.create({ canvas, getAudio, toast, onExit }) returns
// { frame(dt), start(), stop(), drop(), setRotate(on), destroy() }.
(function(){
'use strict';
window.SkyRealm = { create: function(opts){
const rand = (a,b) => a + Math.random()*(b-a);
const TAU = Math.PI*2;
const ACC = 0x00ff00; // pure green marks "accent" pixels for the dither pass

/* ---------------- AUDIO: plays through the site's own audio graph, so its Sound button rules ---------------- */
const AU = { ctx:null, master:null, send:null, on:false };
function syncAudio(){
  const a = opts.getAudio && opts.getAudio();
  if (!a){ AU.on=false; return; }
  if (AU.ctx !== a.ctx){
    const ctx=a.ctx, master=ctx.createGain(); master.gain.value=.8; master.connect(a.out);
    const conv=ctx.createConvolver(), len=ctx.sampleRate*3.2, ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for (let ch=0; ch<2; ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
    conv.buffer=ir; const send=ctx.createGain(); send.gain.value=.55; send.connect(conv); conv.connect(master);
    const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), nd=nb.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
    Object.assign(AU,{ctx,master,send,noise:nb}); padStop=null; droneStop=null;
  }
  AU.on=true;
}
function out(node, wet=0.5){ node.connect(AU.master); if (wet>0){ const g=AU.ctx.createGain(); g.gain.value=wet; node.connect(g); g.connect(AU.send);} }
function tone(f,{type='sine',dur=1.5,gain=0.15,attack=0.005,at=0,wet=0.5,glide=null,vib=0}={}){
  if (!AU.on) return; const c=AU.ctx, t=c.currentTime+at;
  const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,t);
  if (glide) glide.forEach(([ff,tt])=>o.frequency.exponentialRampToValueAtTime(ff,t+tt));
  if (vib){ const l=c.createOscillator(), lg=c.createGain(); l.frequency.value=5.5; lg.gain.value=vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+dur+.1); }
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+attack); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); out(g,wet); o.start(t); o.stop(t+dur+.05);
}
function noise({dur=1,gain=.3,type='lowpass',f0=800,f1=100,q=0.7,at=0,attack=0.005,wet=0.4}={}){
  if (!AU.on) return; const c=AU.ctx, t=c.currentTime+at;
  const s=c.createBufferSource(); s.buffer=AU.noise; s.loop=true;
  const fl=c.createBiquadFilter(); fl.type=type; fl.Q.value=q; fl.frequency.setValueAtTime(f0,t); fl.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+attack); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(fl); fl.connect(g); out(g,wet); s.start(t, Math.random()); s.stop(t+dur+.05);
}
const bell = (f,g=.12,at=0) => { tone(f,{dur:3.5,gain:g,at}); tone(f*2.756,{dur:1.6,gain:g*.45,at}); tone(f*5.404,{dur:.7,gain:g*.25,at}); tone(f*.5,{dur:4,gain:g*.35,at,type:'triangle'}); };
const gong = (f,g=.16) => { [1,1.48,2.13,2.92,3.9].forEach((m,i)=>tone(f*m,{dur:5-i*.7,gain:g/(1+i*.6),attack:.01})); noise({dur:.3,gain:.06,type:'bandpass',f0:2400,f1:900,q:2}); };
function thunder(dist){
  const d = Math.min(1.2, dist/40);
  noise({dur:.18,gain:.35*(1-d*.5),type:'highpass',f0:3000,f1:1200,at:d*.3});
  noise({dur:3.2,gain:.55,type:'lowpass',f0:900,f1:60,at:d*.6+.05,attack:.08,wet:.6});
  noise({dur:2.2,gain:.35,type:'lowpass',f0:200,f1:40,at:d*.6+.4,attack:.2,wet:.6});
}
function choir(root, g=.05){
  if (!AU.on) return; const c=AU.ctx, t=c.currentTime;
  [1,1.25,1.5,2,2.5].forEach((m,i)=>{
    const bus=c.createGain(); bus.gain.setValueAtTime(0.0001,t); bus.gain.exponentialRampToValueAtTime(g,t+1.2+i*.15); bus.gain.exponentialRampToValueAtTime(0.0001,t+6);
    const f1=c.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=650; f1.Q.value=3;
    const f2=c.createBiquadFilter(); f2.type='bandpass'; f2.frequency.value=1100; f2.Q.value=4;
    f1.connect(bus); f2.connect(bus); out(bus,.9);
    for (const det of [-7,0,7]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=root*m; o.detune.value=det+rand(-3,3); o.connect(f1); o.connect(f2); o.start(t); o.stop(t+6.2); }
  });
}
let padStop = null, padWind = null, droneStop = null;
const PADS = {
  storm: () => ({ notes:[130.8,196,261.6,329.6], type:'sine', cut:1400, wind:.02, windF:500, vol:.012 }),
};
function startPad(){
  if (!AU.on) return; stopPad();
  const c=AU.ctx, t=c.currentTime, p=PADS.storm();
  const bus=c.createGain(); bus.gain.setValueAtTime(0.0001,t); bus.gain.exponentialRampToValueAtTime(p.vol||.05,t+2.5);
  const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=p.cut; lp.connect(bus); out(bus,.8);
  const nodes=[];
  p.notes.forEach(f=>{ for(const det of [-5,5]){ const o=c.createOscillator(); o.type=p.type; o.frequency.value=f; o.detune.value=det; o.connect(lp); o.start(t); nodes.push(o);} });
  // wind
  const ws=c.createBufferSource(); ws.buffer=AU.noise; ws.loop=true;
  const wf=c.createBiquadFilter(); wf.type='bandpass'; wf.Q.value=1.2; wf.frequency.value=p.windF;
  const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=.09; lg.gain.value=p.windF*.5; lfo.connect(lg); lg.connect(wf.frequency); lfo.start(t);
  const wg=c.createGain(); wg.gain.setValueAtTime(0.0001,t); wg.gain.exponentialRampToValueAtTime(p.wind,t+3);
  ws.connect(wf); wf.connect(wg); out(wg,.3); ws.start(t); nodes.push(ws,lfo);
  padWind = wg;
  padStop = () => { const n=c.currentTime; bus.gain.setTargetAtTime(0.0001,n,.6); wg.gain.setTargetAtTime(0.0001,n,.6); nodes.forEach(o=>o.stop(n+3)); padStop=null; padWind=null; };
}
function stopPad(){ if (padStop) padStop(); }
/* ---------------- RENDERER + DITHER ---------------- */
const canvas = opts.canvas;
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'});
const PX = 2;
const rt = new THREE.WebGLRenderTarget(4,4,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
rt.depthTexture = new THREE.DepthTexture(); rt.depthTexture.type = THREE.UnsignedIntType;
const post = new THREE.ShaderMaterial({
  uniforms:{ tD:{value:rt.texture}, tZ:{value:rt.depthTexture}, texel:{value:new THREE.Vector2(1,1)}, ink:{value:1}, near:{value:.1}, far:{value:400}, cA:{value:new THREE.Color()}, cB:{value:new THREE.Color()}, cC:{value:new THREE.Color()}, cD:{value:new THREE.Color()}, cE:{value:new THREE.Color(0x3f7fb8)}, cF:{value:new THREE.Color(0xa9d8f0)}, flash:{value:0}, contrast:{value:1.25}, bias:{value:0} },
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader:`
    uniform sampler2D tD, tZ; uniform vec2 texel; uniform float ink, near, far; uniform vec3 cA,cB,cC,cD,cE,cF; uniform float flash,contrast,bias; varying vec2 vUv;
    float b2(vec2 a){ a=floor(a); return fract(dot(a, vec2(0.5, a.y*0.75))); }
    float b4(vec2 a){ return b2(0.5*a)*0.25 + b2(a); }
    float b8(vec2 a){ return b4(0.5*a)*0.25 + b2(a); }
    float lin(vec2 uv){ float z = texture2D(tZ, uv).x*2.0-1.0; return 2.0*near*far/(far+near-z*(far-near)); }
    void main(){
      vec3 col = texture2D(tD, vUv).rgb;
      float d0 = lin(vUv);
      float dm = max(max(lin(vUv+vec2(texel.x,0.)), lin(vUv-vec2(texel.x,0.))), max(lin(vUv+vec2(0.,texel.y)), lin(vUv-vec2(0.,texel.y))));
      float edge = ink * step(0.12, (dm-d0)/d0) * step(d0, 150.0);
      float acc = step(0.22, col.g - max(col.r, col.b));
      float racc = step(0.22, col.r - max(col.g, col.b)) * (1.0 - acc);
      float lum = dot(col, vec3(.299,.587,.114));
      lum = mix(lum, col.g, acc); lum = mix(lum, col.r, racc);
      float bacc = step(0.22, col.b - max(col.r, col.g)) * (1.0 - acc) * (1.0 - racc);
      lum = mix(lum, col.b, bacc);
      float anyA = max(acc, racc);
      lum = mix((lum-0.5)*contrast + 0.5 + bias, lum*1.6, anyA) + flash*0.35;
      float th = b8(gl_FragCoord.xy) * mix(1.0, 0.6, anyA);
      float bit = step(th, lum);
      if (flash > 0.6) bit = 1.0 - bit;
      vec3 hi = mix(mix(cB, cC, acc), cD, racc);
      vec3 c = mix(cA, hi, bit);
      c = mix(c, mix(cE, cF, bit), bacc);
      c = mix(c, vec3(0.02), edge);
      gl_FragColor = vec4(c, 1.0);
    }`
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), post));
const camera = new THREE.PerspectiveCamera(50,1,.1,400);
let cw=0, ch=0;
function resize(){
  const w = canvas.clientWidth||1, h = canvas.clientHeight||1; if (w===cw && h===ch) return; cw=w; ch=h;
  renderer.setPixelRatio(1/PX); renderer.setSize(w,h,false);
  const rw=Math.max(1,Math.floor(w/PX)), rh=Math.max(1,Math.floor(h/PX)); rt.setSize(rw,rh); post.uniforms.texel.value.set(1/rw,1/rh);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
let camRide = null;
const rideLook = {yaw:0, pitch:0};
function toast(msg, secs=2.6){ if (opts.toast) opts.toast(msg, secs); }

/* ---------------- SHARED BUILDERS ---------------- */
const geoBall = new THREE.IcosahedronGeometry(1,2);
function lam(c, e=0){ return new THREE.MeshLambertMaterial({color:c, emissive:e}); }
function cloud(mat, n=7, w=4, r=1.6){
  const g = new THREE.Group();
  for (let i=0;i<n;i++){ const m=new THREE.Mesh(geoBall,mat); const s=r*rand(.6,1.15)*(1-Math.abs(i/n-.5)*.7);
    m.scale.setScalar(s); m.position.set((i/(n-1)-.5)*w*2+rand(-.4,.4), rand(0,.6)*s, rand(-1,1)*r*.6); g.add(m); }
  return g;
}
function sky(top, horizon, bottom){
  const geo = new THREE.SphereGeometry(300,24,16), cols=[], p=geo.attributes.position;
  const a=new THREE.Color(top), b=new THREE.Color(horizon), c=new THREE.Color(bottom);
  for (let i=0;i<p.count;i++){ const y=p.getY(i)/300; const col = y>0 ? b.clone().lerp(a, Math.pow(y,.7)) : b.clone().lerp(c, Math.min(1,-y*3)); cols.push(col.r,col.g,col.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false}));
}
function pickable(obj, kind, data={}){ obj.userData.kind=kind; Object.assign(obj.userData,data); return obj; }
const puffs = []; // generic expanding puff/mote effects, per scene
function puff(scene, pos, {color=0xffffff, size=.6, life=1.2, vel=null, basic=false}={}){
  const m = new THREE.Mesh(geoBall, basic? new THREE.MeshBasicMaterial({color}) : lam(color));
  m.position.copy(pos); m.scale.setScalar(.01); scene.add(m);
  puffs.push({m, scene, t:0, life, size, vel: vel || new THREE.Vector3(rand(-1,1),rand(.5,1.5),rand(-1,1))});
}
function tickPuffs(dt){
  for (let i=puffs.length-1;i>=0;i--){ const p=puffs[i]; p.t+=dt; const k=p.t/p.life;
    p.m.position.addScaledVector(p.vel, dt); p.m.scale.setScalar(p.size*Math.sin(Math.min(1,k)*Math.PI));
    if (k>=1){ p.scene.remove(p.m); p.m.material.dispose(); puffs.splice(i,1);} }
}

/* =========================================================
   THE STORM THRONE
   ========================================================= */
function buildStorm(){
  const S = new THREE.Scene(); const pick=[];
  const fogDay=new THREE.Color(0xe4e4e4), fogNight=new THREE.Color(0x2e2e2e);
  S.fog = new THREE.Fog(0xe4e4e4, 45, 170);
  // sky that blends between a sunny day and the storm
  const skyGeo=new THREE.SphereGeometry(300,24,16), sp=skyGeo.attributes.position, dayC=[], nightC=[];
  const grad=(top,hor,bot,arr)=>{ const a=new THREE.Color(top),b=new THREE.Color(hor),c=new THREE.Color(bot);
    for (let i=0;i<sp.count;i++){ const y=sp.getY(i)/300; const col=y>0?b.clone().lerp(a,Math.pow(y,.7)):b.clone().lerp(c,Math.min(1,-y*3)); arr.push(col.r,col.g,col.b);} };
  grad(0x000060,0x0000f0,0x0000c0,dayC); grad(0x050505,0x3e3e3e,0x262626,nightC);
  const skyCol=new Float32Array(dayC); skyGeo.setAttribute('color',new THREE.BufferAttribute(skyCol,3));
  S.add(new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false})));
  const hemi=new THREE.HemisphereLight(0xffffff,0x303030,.85); S.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,1.0); sun.position.set(-20,30,10); S.add(sun);
  const kLight=new THREE.DirectionalLight(0xffffff,.35); kLight.position.set(10,15,40); S.add(kLight);
  const sunDisc=new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:ACC,fog:false})); sunDisc.scale.setScalar(9); sunDisc.position.set(-55,48,-160); S.add(sunDisc);
  const stone = lam(0x8c8c8c), cloudM = lam(0xe6e6e6), dark = lam(0x4c4c4c);
  // cloud sea + storm clouds that roll in from above
  const sea=[]; for (let i=0;i<70;i++){ const c=cloud(cloudM,6,rand(3,6),rand(1.6,3)); const a=rand(0,TAU), r=rand(14,90);
    c.position.set(Math.cos(a)*r, rand(-6,-2.5), Math.sin(a)*r); c.rotation.y=rand(0,TAU); c.userData.ph=rand(0,TAU); S.add(c); sea.push(c); }
  const storm=[]; for (let i=0;i<26;i++){ const c=cloud(dark,8,rand(5,9),rand(2.5,4)); const a=rand(0,TAU), r=rand(30,90); c.position.set(Math.cos(a)*r, rand(14,28), Math.sin(a)*r); c.lookAt(0,c.position.y,0); c.userData.y=c.position.y; S.add(c); storm.push(c); }
  // arena
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(10,7,2.2,28), stone); plat.position.y=-1.1; S.add(plat); pickable(plat,'floor'); pick.push(plat);
  const under = new THREE.Mesh(new THREE.ConeGeometry(7,8,20), dark); under.rotation.x=Math.PI; under.position.y=-6.2; S.add(under);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2,.12,6,40), lam(0xb8b8b8)); ring.rotation.x=Math.PI/2; ring.position.y=.02; S.add(ring);
  const sigil = new THREE.Mesh(new THREE.TorusGeometry(2.2,.08,6,5), lam(0x000000, 0x003300)); sigil.rotation.x=Math.PI/2; sigil.position.y=.04; S.add(sigil);
  // pillars with round shields
  // the Storm Song: the boss hits the shields in this order (evil version); copy it to play the heroic one
  const ORDER=[4,0,6,2,8,3,7,1,5];
  const SONG=[220,293.7,370,440,392,329.6,554.4,493.9,587.3];          // A3 D4 F#4 A4 G4 E4 C#5 B4 D5
  const EVIL=[207.7,277.2,329.6,415.3,370,311.1,523.3,466.2,554.4];   // the same tune bent minor and flat
  const notes=[], evil=[], kinds=[]; ORDER.forEach((sh,k)=>{ notes[sh]=SONG[k]; evil[sh]=EVIL[k]; });
  for (let i=0;i<9;i++) kinds[i]=['bell','gong','chime'][i%3];
  const shields=[];
  for (let i=0;i<9;i++){
    const a = Math.PI*.15 + i/8*Math.PI*1.7 + Math.PI/2; const r=8.4; const h=rand(4,7.5);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,h,10), stone); col.position.set(Math.cos(a)*r, h/2, Math.sin(a)*r); S.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6,.4,1.6), stone); cap.position.set(col.position.x,h+.2,col.position.z); S.add(cap);
    const sh=new THREE.Group(); sh.position.set(col.position.x*.9, Math.min(h*.62,4), col.position.z*.9); sh.lookAt(0,sh.position.y,0); S.add(sh);
    const faceM=lam(0x9a9a9a), trimM=lam(0x000000,0x003800);
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.14,20), faceM); disc.rotation.x=Math.PI/2; sh.add(disc);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.85,.08,6,24), trimM); rim.position.z=.05; sh.add(rim);
    const boss=new THREE.Mesh(geoBall, trimM); boss.scale.set(.22,.22,.14); boss.position.z=.1; sh.add(boss);
    // zigzag bolt painted across the face
    [[-.2,.25,.6],[.15,0,-.7],[-.12,-.25,.6]].forEach(([x,y,rz])=>{ const z=new THREE.Mesh(new THREE.BoxGeometry(.08,.32,.04),trimM); z.position.set(x,y,.09); z.rotation.z=rz; sh.add(z); });
    sh.userData={note:notes[i], evil:evil[i], kind:kinds[i], idx:i, ring:0, faceM, trimM};
    sh.children.forEach(k=>{ pickable(k,'shield',{sh}); pick.push(k); });
    shields.push(sh);
  }
  // throne
  const throne = new THREE.Group(); throne.position.set(0,0,-6.4);
  const add=(geo,x,y,z,m=stone)=>{ const k=new THREE.Mesh(geo,m); k.position.set(x,y,z); throne.add(k); return k; };
  add(new THREE.BoxGeometry(5,1,3.4),0,.5,0); add(new THREE.BoxGeometry(3.6,1.2,2.6),0,1.6,.2);
  add(new THREE.BoxGeometry(4,8,.8),0,5,-1.1); add(new THREE.BoxGeometry(.7,2.2,2.6),-2,2.2,.2); add(new THREE.BoxGeometry(.7,2.2,2.6),2,2.2,.2);
  add(new THREE.ConeGeometry(.6,2,4),-1.6,9.8,-1.1); add(new THREE.ConeGeometry(.9,3,4),0,10.4,-1.1); add(new THREE.ConeGeometry(.6,2,4),1.6,9.8,-1.1);
  throne.children.forEach(k=>{ pickable(k,'throne'); pick.push(k); });
  S.add(throne);
  // crown
  const crownM = lam(0x000000, 0x004400);
  const crown = new THREE.Group(); const CROWN_HOME=new THREE.Vector3(0,4.4,-5.8); crown.position.copy(CROWN_HOME);
  crown.add(new THREE.Mesh(new THREE.TorusGeometry(.9,.16,6,24), crownM)); crown.children[0].rotation.x=Math.PI/2;
  for (let i=0;i<7;i++){ const s=new THREE.Mesh(new THREE.ConeGeometry(.16,.8,4), crownM); const a=i/7*TAU; s.position.set(Math.cos(a)*.9,.4,Math.sin(a)*.9); crown.add(s); }
  const inkM=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.BackSide,fog:false});
  crown.children.slice().forEach(k=>{ const o=new THREE.Mesh(k.geometry,inkM); o.position.copy(k.position); o.rotation.copy(k.rotation); o.scale.copy(k.scale).multiplyScalar(1.0); o.userData.hull=true; crown.add(o); });
  { const torusO=crown.children.find(o=>o.userData.hull && o.geometry.type==='TorusGeometry'); torusO.geometry=new THREE.TorusGeometry(.9,.26,6,24); }
  crown.children.filter(o=>o.userData.hull && o.geometry.type==='ConeGeometry').forEach(o=>{ o.geometry=new THREE.ConeGeometry(.27,1.05,4); o.position.y+=.05; });
  crown.children.forEach(k=>{ pickable(k,'crown'); pick.push(k); });
  S.add(crown);

  /* ---- the Storm King: a throne-sized knight ---- */
  const SEAT=new THREE.Vector3(0,2.2,-6.0);
  const knight=new THREE.Group(); knight.position.copy(SEAT); knight.visible=false; S.add(knight);
  const steel=lam(0xe2e2e2), steelD=lam(0xa4a4a4), gold=lam(0x000000,0x00c000), redM=lam(0x000000,0xa00000);
  const P=(geo,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>{ const k=new THREE.Mesh(geo,m); k.position.set(x,y,z); k.scale.set(sx,sy,sz); k.rotation.set(rx,ry,rz); knight.add(k); return k; };
  const bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  P(bx(2.0,.8,1.6),steelD,0,.4,.1);
  for (const s of [-1,1]){
    P(bx(.75,.75,1.9),steel,s*.5,.45,1.0); P(geoBall,steel,s*.5,.5,1.95,.42,.42,.42);
    P(bx(.65,2.0,.7),steelD,s*.5,-.6,2.05); P(bx(.7,.35,1.0),steel,s*.5,-1.65,2.3);
    P(geoBall,steel,s*1.25,2.95,0,.62,.5,.66); P(new THREE.TorusGeometry(.58,.06,6,14),gold,s*1.25,2.78,0,1,1,1,Math.PI/2);
    P(bx(.5,1.3,.5),steelD,s*1.45,2.2,.1); P(bx(.45,.45,1.3),steel,s*1.7,1.45,.65); P(geoBall,steelD,s*1.7,1.45,1.35,.3,.3,.3);
  }
  P(new THREE.CylinderGeometry(1.2,.9,2.2,8),steel,0,2.0,0,1,1,.8,0,Math.PI/8,0);
  P(new THREE.TorusGeometry(.95,.09,6,8),gold,0,1.0,0,1,.85,1,Math.PI/2);
  [[-.18,2.6,.5],[.15,2.25,-.6],[-.12,1.9,.5],[.12,1.55,-.6]].forEach(([x,y,rz])=>P(bx(.14,.55,.12),gold,x,y,.92,1,1,1,0,0,rz));
  P(new THREE.CylinderGeometry(.5,.65,.4,8),steelD,0,3.25,0);
  P(new THREE.TorusGeometry(.58,.05,6,8),gold,0,3.42,0,1,1,1,Math.PI/2);
  P(new THREE.CylinderGeometry(.5,.55,.8,10),steel,0,3.75,0); P(geoBall,steel,0,4.15,0,.5,.38,.5);
  const visorM=new THREE.MeshBasicMaterial({color:0x003000}); P(bx(.65,.1,.08),visorM,0,3.82,.53);
  P(bx(.08,.5,.08),steelD,0,3.62,.56);
  const plume=[]; for (let i=0;i<5;i++) plume.push(P(geoBall,redM,0,4.55+Math.sin(i/4*Math.PI)*.25,.35-i*.3,.14,.16,.22));
  const capeG=new THREE.PlaneGeometry(2.6,3.4,4,6); const cape=new THREE.Mesh(capeG,new THREE.MeshLambertMaterial({color:0x000000,emissive:0x8a0000,side:THREE.DoubleSide}));
  cape.position.set(0,1.5,-.85); knight.add(cape); const capeBase=capeG.attributes.position.array.slice();
  // lightning spear in his right hand
  const spear=new THREE.Group(); spear.position.set(1.7,1.45,1.35); knight.add(spear);
  const segGeo=new THREE.CylinderGeometry(.07,.07,1,4); const segs=[]; const SEG=12, LEN=8.4, BASE=-3.2;
  for (let i=0;i<SEG;i++){ const m=new THREE.Mesh(segGeo,gold); spear.add(m); segs.push(m); }
  const head=new THREE.Mesh(new THREE.ConeGeometry(.24,1.1,4),gold); spear.add(head);
  const prongs=[-1,1].map(s=>{ const p=new THREE.Mesh(new THREE.ConeGeometry(.1,.6,4),gold); p.rotation.z=s*.7; spear.add(p); return p; });
  const UPV=new THREE.Vector3(0,1,0);
  function jag(amp){ let prev=new THREE.Vector3(0,BASE,0);
    for (let i=0;i<SEG;i++){ const nx=new THREE.Vector3(i===SEG-1?0:rand(-amp,amp), BASE+(i+1)/SEG*LEN, i===SEG-1?0:rand(-amp,amp));
      const m=segs[i]; m.position.copy(prev).add(nx).multiplyScalar(.5); m.scale.set(1,prev.distanceTo(nx),1);
      m.quaternion.setFromUnitVectors(UPV, nx.clone().sub(prev).normalize()); prev=nx; }
    head.position.set(0,BASE+LEN+.5,0); prongs.forEach((p,k)=>p.position.set((k?1:-1)*.22,BASE+LEN,0)); }
  jag(.08);
  const auraM=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.BackSide,depthWrite:false});
  const aura=new THREE.Mesh(geoBall,auraM); aura.position.set(0,2,0); aura.scale.setScalar(2.4); knight.add(aura);
  knight.traverse(o=>{ if(o.isMesh && o!==aura){ pickable(o,'knight'); pick.push(o);} });
  // the living bolt
  const ball=new THREE.Group(); ball.visible=false; S.add(ball);
  ball.add(new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:ACC})));
  const ballGlow=new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:0x003a00,side:THREE.BackSide,depthWrite:false})); ballGlow.scale.setScalar(2.2); ball.add(ballGlow);
  // rain
  const rainN=1400, rp=new Float32Array(rainN*6);
  for (let i=0;i<rainN;i++){ const x=rand(-40,40), y=rand(-5,40), z=rand(-40,40); rp.set([x,y,z,x-.3,y-1.6,z],i*6); }
  const rainG=new THREE.BufferGeometry(); rainG.setAttribute('position',new THREE.BufferAttribute(rp,3));
  const rain=new THREE.LineSegments(rainG,new THREE.LineBasicMaterial({color:0x9a9a9a})); rain.visible=false; S.add(rain);

  /* ---- electricity helpers ---- */
  const arcs=[]; const arcMat=new THREE.LineBasicMaterial({color:ACC});
  function zap(a,b,amp=.5,life=.15,n=8,thick=true){
    const pts=[]; for (let i=0;i<=n;i++){ const p=a.clone().lerp(b,i/n); if(i>0&&i<n) p.add(new THREE.Vector3(rand(-amp,amp),rand(-amp,amp),rand(-amp,amp))); pts.push(p); }
    const g=new THREE.BufferGeometry().setFromPoints(pts); const ls=[new THREE.Line(g,arcMat)];
    if (thick) for (const o of [[.06,0,0],[0,.06,0],[0,0,.06]]){ const c=new THREE.Line(g,arcMat); c.position.set(o[0],o[1],o[2]); ls.push(c); }
    ls.forEach(l=>S.add(l)); arcs.push({ls,g,t:0,life});
  }
  const rv=(r)=>new THREE.Vector3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(r);
  const starGeo=(()=>{ const g=new THREE.BufferGeometry(); const v=[]; const a=1, b=.16;
    [[0,a],[b,b],[a,0],[b,-b],[0,-a],[-b,-b],[-a,0],[-b,b]].forEach((q,i,arr)=>{ const n=arr[(i+1)%8]; v.push(0,0,0, q[0],q[1],0, n[0],n[1],0); });
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3)); return g; })();
  const stars=[]; const starM=new THREE.MeshBasicMaterial({color:0x0000ff,side:THREE.DoubleSide,fog:false});
  function star(p,size=1){ const m=new THREE.Mesh(starGeo,starM); m.position.copy(p).add(rv(rand(.5,2.5))); m.rotation.z=rand(0,TAU); S.add(m); stars.push({m,t:0,life:rand(.35,.6),size:size*rand(.5,1.3)}); }
  function sparks(p,n=8,spd=5){ for (let k=0;k<Math.ceil(n/5);k++) star(p, n>15?1.6:.9); for (let k=0;k<n;k++) puff(S,p,{color:ACC,basic:true,size:rand(.07,.16),life:rand(.4,1),vel:rv(spd).add(new THREE.Vector3(0,spd*.4,0))}); }
  let flashT=0;
  function bolt(target, from, quiet=false){
    const start = from ? from.clone() : target.clone().add(new THREE.Vector3(rand(-8,8), 42, rand(-8,8)));
    zap(start,target,1.4,.35,16); const mid=start.clone().lerp(target,rand(.3,.6));
    zap(mid, mid.clone().add(new THREE.Vector3(rand(-4,4),-rand(4,8),rand(-4,4))),.8,.3,6);
    if (!quiet) flashT=.16; sparks(target,6);
    thunder(camera.position.distanceTo(target));
  }
  function ringShield(sh){ const u=sh.userData, f=u.note;
    if (u.kind==='bell') bell(f,.11); else if (u.kind==='gong') gong(f*.5,.15); else { tone(f,{dur:2.2,gain:.1}); tone(f*2,{dur:1.4,gain:.05,type:'triangle'}); tone(f*3.01,{dur:.6,gain:.025}); } }
  function evilShield(sh,hop){ const f=sh.userData.evil*.5;
    tone(f,{type:'sawtooth',dur:1.6,gain:.07,attack:.005,wet:.6}); tone(f*Math.pow(2,-6/12),{type:'sawtooth',dur:1.6,gain:.05,wet:.6});
    tone(f*.5,{type:'square',dur:1.2,gain:.04,wet:.5}); noise({dur:.25,gain:.1,type:'bandpass',f0:2400,f1:800,q:2}); }
  let songP=0;
  function songStep(sh){ const i=sh.userData.idx;
    if (i===ORDER[songP]) songP++; else songP = (i===ORDER[0]) ? 1 : 0;
    if (songP>=3) shields[ORDER[songP-1]].userData.ring=1.2;
    if (songP===ORDER.length){ songP=0; toast('You played the Storm Song!',3);
      [587.3,740,880,1174.7].forEach((f,k)=>{ bell(f,.08,.25+k*.12); }); tone(293.7,{type:'triangle',dur:4,gain:.06,attack:.3,at:.2,wet:.9});
      shields.forEach((s2,k)=>setTimeout(()=>{ s2.userData.ring=1.4; sparks(s2.position,12,4); }, k*90));
      crown.userData.pulse=1; sparks(crown.position,25,5); } }
  const crack=(g=.25)=>{ noise({dur:.18,gain:g,type:'highpass',f0:5000,f1:1500,wet:.3}); tone(rand(900,1300),{type:'sawtooth',dur:.12,gain:g*.15,wet:.2}); };
  function drone(){ if (!AU.on || droneStop) return; const c=AU.ctx, t=c.currentTime; const bus=c.createGain(); bus.gain.setValueAtTime(.0001,t); bus.gain.exponentialRampToValueAtTime(.025,t+3);
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280; lp.connect(bus); out(bus,.8); const os=[];
    [55,82.4,110].forEach(f=>{ for (const d of [-6,6]){ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=d; o.connect(lp); o.start(t); os.push(o);} });
    droneStop=()=>{ const n=c.currentTime; bus.gain.setTargetAtTime(.0001,n,.8); os.forEach(o=>o.stop(n+4)); droneStop=null; }; }

  /* ---- Chinese sky dragon chasing its pearl through the clouds ---- */
  const DP=72, RS=10, dragon={s:0, close:0, flee:0, H:new THREE.Vector3(31,9,-14), V:new THREE.Vector3(0,0,-6), trail:[], N0:new THREE.Vector3(1,0,0), W:new THREE.Vector3()};
  for (let k=0;k<700;k++) dragon.trail.push(new THREE.Vector3(31,9,-14-k*.12));
  const dGeo=new THREE.BufferGeometry(); const dPos=new Float32Array(DP*RS*3), dCol=new Float32Array(DP*RS*3); const idx=[];
  for (let i=0;i<DP-1;i++) for (let j=0;j<RS;j++){ const a=i*RS+j, b=i*RS+(j+1)%RS, c=(i+1)*RS+j, d=(i+1)*RS+(j+1)%RS; idx.push(a,b,c, b,d,c); }
  dGeo.setIndex(idx); dGeo.setAttribute('position',new THREE.BufferAttribute(dPos,3)); dGeo.setAttribute('color',new THREE.BufferAttribute(dCol,3));
  const dBody=new THREE.Mesh(dGeo,new THREE.MeshLambertMaterial({vertexColors:true})); dBody.frustumCulled=false; S.add(dBody); pickable(dBody,'dragon'); pick.push(dBody);
  const dRad=i=>{ const u=i/(DP-1); return 1.55*(u<.06? .7+u*5 : 1)*(1-Math.pow(u,1.5)*.85); };
  const dRed=lam(0x000000,0xa00000), dDark=lam(0x4e4e4e), dLight=lam(0xdedede), dGold=lam(0x000000,0x00b000), dWhite=new THREE.MeshBasicMaterial({color:0xffffff});
  const parts=[]; const addPart=(m,i,place)=>{ S.add(m); parts.push({m,i,place}); m.traverse(o=>{ if(o.isMesh){ pickable(o,'dragon'); pick.push(o);} }); return m; };
  // dorsal spines and red mane
  for (let i=5;i<DP-6;i+=3){ const c=new THREE.Mesh(new THREE.ConeGeometry(.22,.9,4),dGold); const g=new THREE.Group(); c.position.y=.45; c.rotation.x=-.6; g.add(c); addPart(g,i,'top'); }
  for (let i=1;i<9;i++){ const g=new THREE.Group(); for (let k=0;k<2;k++){ const t=new THREE.Mesh(geoBall,dRed); t.scale.set(.18,.55,.35); t.position.set((k?1:-1)*.25,.35,-.1); t.rotation.set(-.8,0,(k?1:-1)*.5); g.add(t);} addPart(g,i,'top'); }
  // four legs with gold claws
  [[11,1],[11,-1],[40,1],[40,-1]].forEach(([i,s])=>{ const g=new THREE.Group();
    const th=new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,1.3,6),dDark); th.position.set(s*.35,-.55,0); th.rotation.z=s*.6; g.add(th);
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,1,6),dDark); sh.position.set(s*.75,-1.3,.25); sh.rotation.x=.6; g.add(sh);
    for (let k=-1;k<=1;k++){ const cl=new THREE.Mesh(new THREE.ConeGeometry(.08,.45,4),dGold); cl.position.set(s*.8+k*.13,-1.75,.55); cl.rotation.x=1.6; g.add(cl); }
    const tuft=new THREE.Mesh(geoBall,dRed); tuft.scale.set(.15,.3,.4); tuft.position.set(s*.45,-.9,-.35); g.add(tuft);
    g.userData.side=s; addPart(g,i,'side'); });
  // tail tuft
  { const g=new THREE.Group(); for (let k=-2;k<=2;k++){ const f=new THREE.Mesh(new THREE.ConeGeometry(.22,1.6,4),dRed); f.position.set(k*.15,0,-.7); f.rotation.set(-Math.PI/2+.1*Math.abs(k),0,k*.25); g.add(f);} addPart(g,DP-1,'center'); }
  // head
  const dHead=new THREE.Group(); S.add(dHead);
  const H=(geo,m,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{ const k=new THREE.Mesh(geo,m); k.position.set(x,y,z); k.scale.set(sx,sy,sz); k.rotation.set(rx,ry,rz); dHead.add(k); return k; };
  H(geoBall,dDark,0,0,0,1.0,.8,1.1);
  H(geoBall,dDark,0,-.05,1.2,.62,.48,1.3);
  H(geoBall,dDark,0,.08,2.35,.42,.36,.4);
  for (const s of [-1,1]){
    H(geoBall,dWhite,s*.5,.38,.65,.2,.2,.2); H(geoBall,new THREE.MeshBasicMaterial({color:0x000000}),s*.58,.4,.75,.1,.12,.1);
    H(new THREE.BoxGeometry(.5,.12,.3),dGold,s*.48,.6,.6,1,1,1,0,s*.3,s*-.3);
    // antlers
    const a1=H(new THREE.CylinderGeometry(.06,.12,2.2,5),dGold,s*.45,1.1,-.6,1,1,1,-.9,0,s*-.35);
    H(new THREE.ConeGeometry(.07,.8,4),dGold,s*.7,1.4,-.5,1,1,1,-.2,0,s*-.9);
    H(new THREE.ConeGeometry(.07,.7,4),dGold,s*.55,1.85,-1.2,1,1,1,-1.6,0,s*-.3);
    // fangs
    H(new THREE.ConeGeometry(.06,.3,4),dWhite,s*.3,-.38,2.1,1,1,1,Math.PI,0,0);
  }
  const jaw=H(geoBall,dLight,0,-.45,1.1,.52,.2,1.2);
  for (let k=0;k<5;k++) H(geoBall,dRed,(k-2)*.12,-.75,.5-k*.08,.1,.35,.12,.4,0,0);   // beard
  for (let k=0;k<6;k++) H(geoBall,dRed,(k%2?1:-1)*.35,.45+k*.05,-.9-k*.18,.16,.5,.32,-1,0,(k%2?1:-1)*.5); // mane
  dHead.traverse(o=>{ if(o.isMesh){ pickable(o,'dragon'); pick.push(o);} });
  // long whiskers from the nose
  const whisk=[-1,1].map(s=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(14*3),3));
    const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:ACC})); l.frustumCulled=false; dHead.add(l); return {l,g,s}; });
  // the flaming pearl it chases
  const pearl=new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:0xffffff})); pearl.scale.setScalar(.55); S.add(pearl); pickable(pearl,'pearl'); pick.push(pearl);
  const pearlGlow=new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:0x006000,side:THREE.BackSide,depthWrite:false})); pearlGlow.scale.setScalar(1.8); pearl.add(pearlGlow);
  const dPath=(s,close,flee)=>{ const R=(31+6*Math.sin(s*1.7))*(1-close*.45);
    return new THREE.Vector3(Math.cos(s)*R, 8+4*Math.sin(s*2.3)+1.5*Math.sin(s*5.1)+flee*70, Math.sin(s)*R-4); };
  function dragonRoar(){ tone(150,{type:'sawtooth',dur:1.8,gain:.12,attack:.08,glide:[[95,1.6]],vib:12,wet:.7}); tone(225,{type:'square',dur:1.4,gain:.03,attack:.1,glide:[[140,1.3]],wet:.7}); noise({dur:1.6,gain:.14,type:'bandpass',f0:1400,f1:500,q:1.2,attack:.08}); }
  const PTS=[...Array(DP)].map(()=>new THREE.Vector3()), TT=[...Array(DP)].map(()=>new THREE.Vector3()), NN=[...Array(DP)].map(()=>new THREE.Vector3()), BB=[...Array(DP)].map(()=>new THREE.Vector3());
  const UPW=new THREE.Vector3(0,1,0), M4=new THREE.Matrix4();
  let roarT=0, dFade=1;
  const dMats=[dBody.material,dRed,dDark,dLight,dGold,dWhite,pearl.material,...whisk.map(w=>w.l.material)];
  dHead.traverse(o=>{ if(o.isMesh && !dMats.includes(o.material)) dMats.push(o.material); });
  dMats.forEach(m=>{ m.transparent=true; });
  const FWD=new THREE.Vector3();
  function updDragon(t,dt){
    const want = (st==='day') ? 0 : 1; dragon.flee += (want-dragon.flee)*Math.min(1,dt*(want?.8:.3));
    dragon.close=Math.max(0,dragon.close-dt*.18); roarT=Math.max(0,roarT-dt);
    dragon.s += dt*(.16 + dragon.close*.12 + dragon.flee*.1);
    // pearl wanders on a slow looping path ahead of the dragon
    { const q=dragon.s+.35, Rx=(32+4*Math.sin(q*1.6))*(1-dragon.close*.25), Rz=13+3*Math.sin(q*1.3);
      dragon.W.set(Math.cos(q)*Rx, 15+3*Math.sin(q*2.1)+1.2*Math.sin(q*4.3+1)+dragon.flee*70, -20+Math.sin(q)*Rz+dragon.close*6); }
    // head steers toward a point just behind the pearl
    const toP=dragon.W.clone().sub(dragon.H); const dist=toP.length(); toP.normalize();
    const goal=dragon.W.clone();
    const want_v=goal.sub(dragon.H); const gd=want_v.length();
    // smooth, wide turns (capped turn rate, never stalls) so the body can't coil up
    const curDir=dragon.V.clone().normalize(), wantDir=want_v.normalize();
    const ang=curDir.angleTo(wantDir), maxA=dt*1.1;
    if (ang>1e-4){ const ax=new THREE.Vector3().crossVectors(curDir,wantDir); if (ax.lengthSq()<1e-8) ax.set(0,1,0); ax.normalize(); curDir.applyAxisAngle(ax, Math.min(ang,maxA)); }
    const spd=Math.max(4.5, Math.min(12, 3+gd*.7)); const curS=dragon.V.length(); const ns=curS+(spd-curS)*Math.min(1,dt*1.5);
    dragon.V.copy(curDir).multiplyScalar(ns);
    { const vl=dragon.V.length(), lim=vl*.35; dragon.V.y=Math.max(-lim,Math.min(lim,dragon.V.y)); if (dragon.flee<.3){ if (dragon.H.y<11) dragon.V.y+=(11-dragon.H.y)*dt*4; if (dragon.H.y>21) dragon.V.y-=(dragon.H.y-21)*dt*4; } }
    dragon.H.addScaledVector(dragon.V, dt);
    const last=dragon.trail[0]; if (!last || last.distanceTo(dragon.H)>.12) dragon.trail.unshift(dragon.H.clone()); if (dragon.trail.length>900) dragon.trail.length=900;
    // body points spaced along the trail
    { const SEGL=.9, tr=dragon.trail; const cx=tr[0].clone(); let idx=0; PTS[0].copy(dragon.H);
      for (let i=1;i<DP;i++){ let need=SEGL;
        while (need>1e-6){ if (idx>=tr.length-1){ cx.z-=need; need=0; break; } const nx=tr[idx+1], d=cx.distanceTo(nx);
          if (d>=need){ cx.lerp(nx, need/d); need=0; } else { need-=d; cx.copy(nx); idx++; } }
        PTS[i].copy(cx); PTS[i].y += Math.sin(t*2.2 - i*.22)*.3*(i/DP); }
      if (tr.length>idx+40) tr.length=idx+40; }
    for (let i=0;i<DP;i++){ const a=PTS[Math.max(0,i-1)], b=PTS[Math.min(DP-1,i+1)]; TT[i].copy(a).sub(b).normalize(); }
    // parallel-transport frames: each ring keeps the previous ring's orientation, so the body never flips or twists
    { const side=new THREE.Vector3().crossVectors(TT[0],UPW); const prev=dragon.N0.clone().addScaledVector(TT[0],-TT[0].dot(dragon.N0));
      if (side.lengthSq()>1e-4) prev.lerp(side.normalize(), .08); if (prev.lengthSq()<1e-6) prev.set(1,0,0); NN[0].copy(prev.normalize()); dragon.N0.copy(NN[0]); }
    for (let i=0;i<DP;i++){ if (i>0){ NN[i].copy(NN[i-1]).addScaledVector(TT[i],-TT[i].dot(NN[i-1])); if (NN[i].lengthSq()<1e-6) NN[i].copy(NN[i-1]); NN[i].normalize(); }
      BB[i].crossVectors(NN[i],TT[i]).normalize(); }
    for (let i=0;i<DP;i++){ const r=dRad(i); const stripe = (i%4<2)? .36 : .44;
      for (let j=0;j<RS;j++){ const a=j/RS*TAU; const c=Math.cos(a), sn=Math.sin(a); const k=(i*RS+j)*3;
        dPos[k]=PTS[i].x+r*(c*NN[i].x+sn*BB[i].x); dPos[k+1]=PTS[i].y+r*(c*NN[i].y+sn*BB[i].y); dPos[k+2]=PTS[i].z+r*(c*NN[i].z+sn*BB[i].z);
        if (sn<-.35){ dCol[k]=0; dCol[k+1]=.55+.1*((i%2)); dCol[k+2]=0; } else { dCol[k]=dCol[k+1]=dCol[k+2]=stripe*(1-(sn>.5?.15:0)); } } }
    dGeo.attributes.position.needsUpdate=true; dGeo.attributes.color.needsUpdate=true; dGeo.computeVertexNormals(); dGeo.computeBoundingSphere();
    parts.forEach(({m,i,place})=>{ const r=dRad(i); M4.makeBasis(NN[i].clone().negate(),BB[i],TT[i]); m.setRotationFromMatrix(M4); m.scale.setScalar(Math.max(.35,r));
      m.position.copy(PTS[i]); if (place==='top') m.position.addScaledVector(BB[i],r*.9); if (place==='side') m.position.addScaledVector(NN[i],-r*.8*m.userData.side).addScaledVector(BB[i],-r*.2);
      if (place==='side') m.rotation.x += Math.sin(t*3+i)*.35; });
    dHead.position.copy(PTS[0]).addScaledVector(TT[0],.6); dHead.scale.setScalar(1.9);
    { M4.makeBasis(NN[0].clone().negate(),BB[0],TT[0]); const tq=new THREE.Quaternion().setFromRotationMatrix(M4); dHead.quaternion.slerp(tq, Math.min(1,dt*6)); }
    { const fwd=new THREE.Vector3(0,0,1).applyQuaternion(dHead.quaternion); pearl.position.copy(dHead.position).addScaledVector(fwd,9.5).add(new THREE.Vector3(0,Math.sin(t*2)*.35,0)); }
    jaw.rotation.x = .15 + Math.sin(t*1.3)*.08 + roarT*.5;
    whisk.forEach(({g,s})=>{ const a=g.attributes.position.array; for (let k=0;k<14;k++){ const u=k/13; a[k*3]=s*(.3+u*1.6+Math.sin(t*3-u*4)*.3*u); a[k*3+1]=-.05-u*.6+Math.sin(t*2.4-u*5)*.5*u; a[k*3+2]=2.3-u*4.2; } g.attributes.position.needsUpdate=true; });
    camera.getWorldDirection(FWD); let occ=1e9;
    for (let i=0;i<DP;i+=2){ const v=PTS[i].clone().sub(camera.position); const along=v.dot(FWD); if (v.length()<14) occ=0; else if (along>0 && along<20 && v.addScaledVector(FWD,-along).length()<along*.35) occ=0; }
    const ft = occ<3 ? .12 : 1; dFade += (ft-dFade)*Math.min(1,dt*4);
    dMats.forEach(m=>{ m.opacity=dFade; m.depthWrite=dFade>.95; });
    pearlGlow.material.color.setRGB(0,.3+.15*Math.sin(t*6),0);
    if (Math.random()<dt*6 && dragon.flee<.5) puff(S,pearl.position.clone().add(rv(.5)),{color:ACC,basic:true,size:rand(.06,.14),life:.7,vel:rv(.6)});
  }

  /* ---- the nimbus: a little golden cloud. Click to ride; drag to look; click again to hop off ---- */
  const rideM=lam(0x000000,0x00a000);
  const rideC=new THREE.Group(); S.add(rideC);
  [[0,0,0,.95],[.85,.08,.15,.75],[-.85,.05,-.1,.8],[.35,.55,-.1,.72],[-.4,.48,.25,.66],[0,.18,.8,.62],[0,.12,-.8,.66],[1.45,-.05,0,.52],[-1.4,0,.1,.56],[.6,-.25,-.5,.55],[-.5,-.25,.5,.52],[.15,.85,.1,.45]]
    .forEach(([x,y,z,r])=>{ const m=new THREE.Mesh(geoBall,rideM); m.position.set(x,y,z); m.scale.setScalar(r); rideC.add(m); });
  for (let k=0;k<7;k++){ const r=.48*(1-k/8); const m=new THREE.Mesh(geoBall,rideM); m.position.set(Math.sin(k*.9)*.45, -.05+k*.07, -1.25-k*.42); m.scale.setScalar(r); rideC.add(m); }
  rideC.traverse(o=>{ if(o.isMesh){ pickable(o,'ride'); pick.push(o);} });
  let rideS=0, riding=false, rideFlee=0;
  const ridePath=(s,r)=>new THREE.Vector3(Math.cos(s)*r, 10+Math.sin(s*3)*1.2 - r*.12, Math.sin(s)*r-4);
  function dismount(msg){ riding=false; camRide=null; rideC.visible=true; if (msg){ toast(msg,1.4); tone(392,{dur:.3,gain:.04,glide:[[262,.25]],wet:.4}); } }
  function updRide(t,dt){
    const want = st==='day'?0:1; rideFlee += (want-rideFlee)*Math.min(1,dt*.8);
    if (riding && st!=='day') dismount();
    const R = riding ? 13 : 17;
    rideS += dt*(riding ? TAU/16 : .35);
    const p=ridePath(rideS,R); p.y += rideFlee*60;
    rideC.position.lerp(p, Math.min(1,dt*(riding?8:3))); rideC.lookAt(ridePath(rideS+.1,R).setY(rideC.position.y));
    rideC.children.forEach((m,k)=>{ m.position.y += Math.sin(t*2+k)*.002; });
    if (!riding && Math.random()<dt*14 && rideFlee<.5) puff(S,rideC.position.clone().add(rv(.5)).add(new THREE.Vector3(0,-.3,0)),{color:ACC,basic:true,size:rand(.05,.12),life:rand(.4,.9),vel:new THREE.Vector3(0,-.3,0)});
    if (riding){ const pos=rideC.position.clone().add(new THREE.Vector3(0,1.2,0));
      const base=new THREE.Vector3(0,3,-4).sub(pos); base.y=0; base.normalize();
      const yaw=Math.atan2(base.x,base.z)+rideLook.yaw, cp=Math.cos(rideLook.pitch);
      const dir=new THREE.Vector3(Math.sin(yaw)*cp, Math.sin(rideLook.pitch)-.12, Math.cos(yaw)*cp);
      camRide={pos, look:pos.clone().add(dir), dismount:()=>dismount('Hopped off')}; }
  }


  /* ---- the way down: an anvil tied to a balloon. Click it and ride the anvil down ---- */
  const anvil=new THREE.Group(); const ANV_HOME=new THREE.Vector3(16,6.5,8); anvil.position.copy(ANV_HOME); S.add(anvil);
  const iron=lam(0x3c3c3c), ironL=lam(0x6a6a6a);
  { const A=(geo,m,x,y,z,rx=0,rz=0)=>{ const k=new THREE.Mesh(geo,m); k.position.set(x,y,z); k.rotation.set(rx,0,rz); anvil.add(k); return k; };
    A(new THREE.BoxGeometry(1.1,.35,.8),iron,0,-.55,0); A(new THREE.BoxGeometry(.6,.45,.45),iron,0,-.2,0);
    A(new THREE.BoxGeometry(1.5,.38,.7),ironL,.1,.2,0); A(new THREE.ConeGeometry(.33,.9,4),ironL,1.25,.2,0,0,-Math.PI/2).rotation.y=Math.PI/4;
    A(new THREE.BoxGeometry(.25,.25,.5),iron,-.75,.2,0); }
  const balloon=new THREE.Group(); S.add(balloon);
  { const bm=lam(0x000000,0xb00000); const b=new THREE.Mesh(geoBall,bm); b.scale.set(1.1,1.3,1.1); balloon.add(b);
    const knot=new THREE.Mesh(new THREE.ConeGeometry(.15,.3,6),bm); knot.position.y=-1.35; balloon.add(knot);
    const shine=new THREE.Mesh(geoBall,new THREE.MeshBasicMaterial({color:0xffffff})); shine.scale.set(.15,.28,.1); shine.position.set(-.45,.45,.9); balloon.add(shine); }
  const strG=new THREE.BufferGeometry(); strG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(10*3),3));
  const str=new THREE.Line(strG,new THREE.LineBasicMaterial({color:0x202020})); str.frustumCulled=false; S.add(str);
  [anvil,balloon].forEach(g=>g.traverse(o=>{ if(o.isMesh){ pickable(o,'anvil'); pick.push(o);} }));
  const anv={mode:'float', t:0, v:0, bal:new THREE.Vector3(), away:0};
  function dropAnvil(){
    if (anv.mode!=='float' || anv.away>.2) return; anv.mode='fall'; anv.t=0; anv.v=0; anv.bal.copy(balloon.position);
    if (riding) dismount(); toast('Down you go!',1.6);
    tone(880,{type:'triangle',dur:.25,gain:.06,glide:[[440,.2]],wet:.2}); noise({dur:.15,gain:.08,type:'highpass',f0:3000,f1:2000});
    tone(1400,{dur:3,gain:.05,attack:.3,glide:[[260,2.9]],wet:.3,at:.3}); noise({dur:3.2,gain:.18,type:'bandpass',f0:300,f1:1800,q:.6,attack:2.5,wet:.2});
  }
  function updAnvil(t,dt){
    anv.away += ((st==='day'?0:1)-anv.away)*Math.min(1,dt*(st==='day'?.35:.9)); const up=anv.away*anv.away*55;
    if (anv.mode==='float'){ anvil.position.set(ANV_HOME.x, ANV_HOME.y+Math.sin(t*1.1)*.35+up, ANV_HOME.z); anvil.rotation.set(Math.sin(t*.9)*.06,t*.2,Math.sin(t*1.3)*.05);
      balloon.position.set(ANV_HOME.x+Math.sin(t*.7)*.4, ANV_HOME.y+4.2+Math.sin(t*1.1+.4)*.4+up, ANV_HOME.z+Math.cos(t*.6)*.3); balloon.rotation.z=Math.sin(t*.8)*.1; }
    else if (anv.mode==='fall'){ anv.t+=dt; anv.v+=dt*24; anvil.position.y-=anv.v*dt; anvil.rotation.x+=dt*.6; anvil.rotation.z+=dt*.4;
      anv.bal.y+=dt*3; balloon.position.copy(anv.bal); balloon.position.x+=Math.sin(t*2)*.3;
      if (Math.random()<.6) puff(S,anvil.position.clone().add(new THREE.Vector3(rand(-1,1),2,rand(-1,1))),{color:0xffffff,size:rand(.2,.5),life:.5,vel:new THREE.Vector3(0,anv.v*.3,0)});
      const pos=anvil.position.clone().add(new THREE.Vector3(2.2,5.5,4.5)); camRide={pos, look:anvil.position.clone().add(new THREE.Vector3(0,-2,0)), dismount:()=>{}};
      if (anvil.position.y < -14 && !anv.exited){ anv.exited=true; if (opts.onExit) opts.onExit(); } }
    const a=strG.attributes.position.array; const top=balloon.position.clone().add(new THREE.Vector3(0,-1.45,0)), bot=anvil.position.clone().add(new THREE.Vector3(0,.4,0));
    for (let k=0;k<10;k++){ const u=k/9; const p=bot.clone().lerp(top,u); if (anv.mode!=='float' && u>.5) p.copy(top).add(new THREE.Vector3(Math.sin(t*6+u*8)*.2*(1-u),-(1-u)*2.4,0)); else p.x+=Math.sin(u*Math.PI)*Math.sin(t*1.4)*.25; a[k*3]=p.x; a[k*3+1]=p.y; a[k*3+2]=p.z; }
    if (anv.mode!=='float') for (let k=0;k<5;k++){ const p=bot.clone(); a[k*3]=p.x; a[k*3+1]=p.y+k*.1; a[k*3+2]=p.z; }
    strG.attributes.position.needsUpdate=true;
  }

  /* ---- the loop ---- */
  let st='day', stT=0, darkness=0, anger=0, auraLvl=0, shake=0, zapT=0, hop=0, hopFrom=new THREE.Vector3(), birdT=2;
  const shieldPos=i=>shields[i].position.clone().add(new THREE.Vector3(0,0,0));
  const go=s=>{ st=s; stT=0; };
  const headPos=()=>new THREE.Vector3(SEAT.x, knight.position.y+4.45, SEAT.z);
  function crownHit(){
    if (st!=='day') return;
    go('gather'); toast('The sky darkens…',2.5); crown.userData.pulse=1;
    tone(55,{type:'sawtooth',dur:4.5,gain:.07,attack:2.5,wet:.8}); noise({dur:4,gain:.12,f0:200,f1:900,attack:2.5,type:'bandpass',q:.8});
    drone();
  }
  function angerUp(){
    if (st!=='throne') return;
    anger++; shake=1;
    tone(70+anger*18,{type:'sawtooth',dur:1.4,gain:.12+anger*.05,attack:.05,glide:[[50+anger*10,1.3]],wet:.6});
    noise({dur:.8,gain:.12+anger*.06,type:'bandpass',f0:2800,f1:1200,q:2,wet:.4}); crack(.2+anger*.1);
    for (let k=0;k<4+anger*4;k++) zap(knight.position.clone().add(new THREE.Vector3(0,2,0)).add(rv(.6)), knight.position.clone().add(new THREE.Vector3(0,2,0)).add(rv(2+anger)),.4,.2,6);
    if (anger<3){ toast(anger===1?'He stirs…':'He is getting angry…',1.8); }
    else { toast('The Storm King strikes!',2); go('bolt'); hop=0; knight.visible=false; ball.visible=true; ball.scale.setScalar(.6);
      hopFrom=knight.position.clone().add(new THREE.Vector3(0,2,0)); ball.position.copy(hopFrom); flashT=.16; crack(.4);
      tone(880,{type:'sawtooth',dur:.5,gain:.06,glide:[[1760,.3]],wet:.4}); crown.visible=false; }
  }
  return {
    key:'storm', scene:S, pick, pal:['#17171a','#c9c7c1','#f5c22b','#d6262b'], bias:-.06, contrast:1.5,
    cam:{target:new THREE.Vector3(0,5,-3), dist:33, yaw:0.02, pitch:.2},
    reset(){ anv.mode='float'; anv.exited=false; anvil.rotation.set(0,0,0); if (riding) dismount(); camRide=null; },
    drop(){ if (anv.mode!=='float') return; if (anv.away>.2){ toast('The anvil drifts back down after the storm',2.2); return; } dropAnvil(); },
    click(hit, ray){
      const kind = hit && hit.object.userData.kind;
      if (kind==='shield'){ const sh=hit.object.userData.sh; ringShield(sh); sh.userData.ring=1; if (st==='day') songStep(sh); return; }
      if (kind==='dragon'){ if (dragon.flee<.5){ dragonRoar(); dragon.close=1; roarT=1; toast('The sky dragon swoops past',1.8); } return; }
      if (kind==='pearl'){ bell(1174.7,.07); bell(1568,.05,.1); sparks(pearl.position,12,3); return; }
      if (kind==='ride'){ if (st==='day' && !riding){ riding=true; rideC.visible=false; rideLook.yaw=0; rideLook.pitch=0; tone(523.3,{dur:.4,gain:.05,glide:[[784,.3]],wet:.5}); tone(784,{dur:.6,gain:.04,at:.12,glide:[[1046.5,.4]],wet:.5}); toast('Hop on! Drag to look, click to hop off',2.4); } return; }
      if (kind==='anvil'){ dropAnvil(); return; }
      if (kind==='crown' && st==='day') return crownHit();
      if ((kind==='knight' || kind==='crown') && st==='throne') return angerUp();
      if (darkness>.5 && (st==='throne' || st==='gather')){ bolt(hit ? hit.point.clone() : ray.origin.clone().addScaledVector(ray.direction, 30)); return; }
      if (hit && (kind==='floor' || kind==='throne')){ for (let k=0;k<4;k++) puff(S,hit.point,{color:0xffffff,size:rand(.15,.3),life:.7,vel:new THREE.Vector3(rand(-1,1),rand(.5,1.5),rand(-1,1))}); tone(rand(500,700),{dur:.15,gain:.03,type:'triangle'}); }
    },
    update(t,dt){
      stT+=dt;
      // ---- state machine
      if (st==='day'){ darkness=Math.max(0,darkness-dt*.35);
        birdT-=dt; if (birdT<0){ birdT=rand(2.5,6); if (darkness<.1){ const f=rand(2600,3400); tone(f,{dur:.1,gain:.018,glide:[[f*1.3,.07]],wet:.3}); tone(f*1.1,{dur:.1,gain:.015,glide:[[f*1.45,.07]],wet:.3,at:.14}); } } }
      else if (st==='gather'){ darkness=Math.min(1,darkness+dt/3);
        if (darkness>.6 && Math.random()<dt*.8) bolt(new THREE.Vector3(rand(-60,60),rand(-4,0),rand(-70,-20)),null,true);
        if (stT>3.6){ go('descend'); knight.visible=true; knight.position.set(SEAT.x,40,SEAT.z); anger=0; auraLvl=0; visorM.color.setRGB(0,.3,0);
          bolt(SEAT.clone().add(new THREE.Vector3(0,1,0)), new THREE.Vector3(0,60,-6)); toast('Something is falling…',1.8); } }
      else if (st==='descend'){ const k=Math.min(1,stT/2.2), e=1-Math.pow(1-k,3);
        knight.position.y = SEAT.y + (1-e)*38;
        if (Math.random()<.5) zap(knight.position.clone().add(new THREE.Vector3(0,5,0)), knight.position.clone().add(new THREE.Vector3(rand(-1,1),rand(8,12),rand(-1,1))),.5,.12,6);
        // crown floats up to meet him
        const h=headPos(); const ck=Math.max(0,(k-.55)/.45); crown.position.lerpVectors(CROWN_HOME,h,ck); crown.scale.setScalar(1-ck*.4);
        if (k>=1){ go('throne'); flashT=.16; thunder(8); gong(55,.2); crown.position.copy(h); crown.scale.setScalar(.6);
          for (let j=0;j<14;j++) zap(h, h.clone().add(rv(rand(1.5,3.5))),.4,.35,7);
          sparks(h,20,6); for (let j=0;j<10;j++){ const a=j/10*TAU; puff(S,new THREE.Vector3(Math.cos(a)*2,.2,SEAT.z+2+Math.sin(a)*2),{color:0xffffff,size:.5,life:1,vel:new THREE.Vector3(Math.cos(a)*3,.5,Math.sin(a)*3)}); }
          toast('The Storm King takes his throne',2.4); } }
      else if (st==='throne'){ crown.position.copy(headPos()); }
      else if (st==='bolt'){ const i=ORDER[hop]; const to=shieldPos(i); const d=Math.max(.09,.5*Math.pow(.76,hop)); const k=Math.min(1,stT/d);
        ball.position.lerpVectors(hopFrom,to,k); ball.position.y+=Math.sin(k*Math.PI)*.8;
        if (Math.random()<.7) zap(hopFrom,ball.position,.35,.1,7);
        if (k>=1){ const sh=shields[i]; sh.userData.ring=1; evilShield(sh,hop); crack(.12+hop*.03); sparks(to,10,5);
          zap(hopFrom,to,.5,.25,10); hopFrom=to.clone(); hop++; stT=0; if (hop>=ORDER.length){ go('charge'); hopFrom=ball.position.clone();
            tone(180,{type:'sawtooth',dur:1.6,gain:.08,glide:[[1500,1.5]],wet:.5}); noise({dur:1.6,gain:.15,type:'bandpass',f0:400,f1:4000,q:2,attack:1.2}); } } }
      else if (st==='charge'){ const up=new THREE.Vector3(0,11.5,-3); const k=Math.min(1,stT/.7);
        ball.position.lerpVectors(hopFrom,up,1-Math.pow(1-k,2)); ball.scale.setScalar(.6+Math.min(1,stT/1.2)*2.2);
        for (let j=0;j<3;j++) zap(ball.position, ball.position.clone().add(rv(ball.scale.x*rand(1.2,2.4))),.4,.08,6);
        if (stT>1.3){ go('crash'); hopFrom=ball.position.clone(); } }
      else if (st==='crash'){ const k=Math.min(1,stT/.22); ball.position.lerpVectors(hopFrom,new THREE.Vector3(0,.3,0),k*k);
        if (k>=1){ go('impact'); ball.visible=false; flashT=.3; const c0=new THREE.Vector3(0,.2,0);
          thunder(0); thunder(4); tone(45,{type:'sine',dur:3.5,gain:.4,glide:[[22,3.2]],wet:.6}); noise({dur:2.5,gain:.3,type:'bandpass',f0:3000,f1:500,q:.7});
          for (let j=0;j<40;j++) puff(S,c0,{color:j%3?ACC:0xffffff,basic:j%3!==0,size:rand(.1,.35),life:rand(.6,1.6),vel:rv(rand(4,10)).setY(rand(2,9))});
          for (let j=0;j<6;j++) bolt(c0.clone().add(rv(1.5).setY(0)),null,true); } }
      else if (st==='impact'){ const c0=new THREE.Vector3(0,.2,0); const k=stT/2.2;
        if (stT<.7 && Math.random()<.35) bolt(c0.clone().add(rv(2).setY(0)),null,true);
        const n=Math.floor((1-k)*6); for (let j=0;j<n;j++){ const a=rand(0,TAU), r=rand(3,10*Math.min(1,stT*2+.3)); zap(c0, new THREE.Vector3(Math.cos(a)*r,.15,Math.sin(a)*r),.6,.1,9); }
        if (Math.random()<(1-k)*.6) zap(c0.clone().add(new THREE.Vector3(0,.5,0)), rv(rand(4,9)).setY(rand(2,8)),.8,.12,8,false);
        if (stT>2.2){ go('clear'); crown.visible=true; crown.position.copy(CROWN_HOME); crown.scale.setScalar(.01); if (droneStop) droneStop();
          toast('The storm passes',2.2); [261.6,329.6,392,523.3].forEach((f,i)=>tone(f,{dur:3.5,gain:.04,attack:.6,at:.5+i*.15,wet:.8})); } }
      else if (st==='clear'){ darkness=Math.max(0,darkness-dt/3.5); crown.scale.setScalar(Math.min(1,stT/1.5)); if (darkness<=0) go('day'); }

      // ---- weather
      const dk=darkness;
      for (let i=0;i<sp.count*3;i++) skyCol[i]=dayC[i]+(nightC[i]-dayC[i])*dk;
      skyGeo.attributes.color.needsUpdate=true;
      S.fog.color.copy(fogDay).lerp(fogNight,dk); hemi.intensity=.85-.3*dk; sun.intensity=1-.15*dk;
      sunDisc.position.y=48-dk*60; sunDisc.scale.setScalar(9*(1-dk*.5));
      storm.forEach(c=>{ c.position.y=c.userData.y+(1-dk)*60; });
      rain.visible = dk>.45;
      post.uniforms.bias.value = -.06 + (1-dk)*.02;
      if (padWind && AU.on && Math.random()<dt*2) padWind.gain.setTargetAtTime(.02+dk*.2,AU.ctx.currentTime,.8);
      sea.forEach(c=>{ c.position.y += Math.sin(t*.4+c.userData.ph)*.003; c.rotation.y += dt*.01; });

      // ---- crown
      if (st==='day' || st==='gather' || st==='clear'){ crown.position.y = CROWN_HOME.y+Math.sin(t*1.3)*.25; }
      crown.rotation.y += dt*(st==='throne'?2.5:.5 + (crown.userData.pulse||0)*6);
      if (crown.userData.pulse) crown.userData.pulse=Math.max(0,crown.userData.pulse-dt*.6);
      const charged = st==='throne' || st==='descend';
      crownM.emissive.setRGB(0, charged ? .75+.25*Math.sin(t*20) : .3+.5*(crown.userData.pulse||0), 0);
      sigil.rotation.z += dt*(.2+anger*.6); sigil.material.emissive.setRGB(0,.15+dk*.35+anger*.15,0);
      shields.forEach(sh=>{ const u=sh.userData; if (u.ring){ u.ring=Math.max(0,u.ring-dt*.9); }
        u.trimM.emissive.setRGB(0,.22+u.ring*.78,0); u.faceM.emissive.setScalar(u.ring*.5); sh.rotation.z=Math.sin(t*30)*u.ring*.08; });

      // ---- knight on the throne
      zapT-=dt;
      if (st==='throne'){
        auraLvl += ((anger*.9+.25)-auraLvl)*Math.min(1,dt*3);
        shake=Math.max(0,shake-dt*1.5);
        const tr=(anger*.02+shake*.12);
        knight.position.set(SEAT.x+rand(-tr,tr), SEAT.y+Math.sin(t*1.6)*.03+rand(-tr,tr)*.5, SEAT.z);
        auraM.color.setRGB(0, .05+auraLvl*.12+.04*Math.sin(t*14), 0); aura.scale.setScalar(2.2+auraLvl*.5+Math.sin(t*9)*.08);
        if (anger>=2) visorM.color.setRGB(.9+.1*Math.sin(t*12),0,0); else visorM.color.setRGB(0,.6+anger*.2,0);
        if (zapT<0){ zapT=1/14; const h=headPos();
          zap(h.clone().add(new THREE.Vector3(0,.3,0)), h.clone().add(rv(rand(.6,1.4)).setY(rand(.5,1.6))),.2,.09,5,false);
          for (let j=0;j<Math.round(auraLvl*3);j++){ const c=knight.position.clone().add(new THREE.Vector3(0,2,0)); zap(c.clone().add(rv(1.2)), c.clone().add(rv(1.6+auraLvl*.9)),.35,.1,6, anger>1); }
          if (anger>0 && Math.random()<.15*anger){ crack(.05*anger); } }
        jag(.08+anger*.08);
      }
      { const p=capeG.attributes.position.array; const wind=.4+darkness*.8+anger*.5;
        for (let i=0;i<p.length;i+=3){ const x=capeBase[i], y=capeBase[i+1]; const k=(1.7-y)/3.4; p[i+2]=capeBase[i+2]-k*(.3+Math.sin(t*2+x*1.2+y*.8)*.25*wind); p[i]=x+Math.sin(t*1.7+y)*k*.12*wind; } capeG.attributes.position.needsUpdate=true; }
      plume.forEach((m,i)=>{ m.position.x=Math.sin(t*3+i*.6)*.06*i; });
      if (ball.visible){ ball.children[0].scale.setScalar(1+Math.sin(t*40)*.15); ballGlow.material.color.setRGB(0,.2+.1*Math.sin(t*25),0);
        if (Math.random()<.8) zap(ball.position, ball.position.clone().add(rv(ball.scale.x*rand(.9,1.8))),.25,.07,5,false); }

      updDragon(t,dt); updRide(t,dt); updAnvil(t,dt);
      // ---- rain, arcs, flash
      if (rain.visible){ const p=rainG.attributes.position.array; for(let i=0;i<rainN;i++){ let y=p[i*6+1]-dt*38; if(y<-5) y+=45; p[i*6+1]=y; p[i*6+4]=y-1.6; p[i*6]=p[i*6+3]+.3; } rainG.attributes.position.needsUpdate=true; }
      for (let i=arcs.length-1;i>=0;i--){ const a=arcs[i]; a.t+=dt; const vis=Math.sin(a.t*90)>-.4; a.ls.forEach(l=>l.visible=vis); if (a.t>a.life){ a.ls.forEach(l=>S.remove(l)); a.g.dispose(); arcs.splice(i,1);} }
      for (let i=stars.length-1;i>=0;i--){ const s2=stars[i]; s2.t+=dt; const k=s2.t/s2.life; s2.m.scale.setScalar(s2.size*Math.sin(Math.min(1,k)*Math.PI)); s2.m.lookAt(camera.position); s2.m.rotateZ(k*.6); if (k>=1){ S.remove(s2.m); stars.splice(i,1);} }
      flashT=Math.max(0,flashT-dt); post.uniforms.flash.value = flashT>.1 ? 1 : flashT>0 ? .4 : 0;
    }
  };
}

/* ---------------- APP ---------------- */
const W = buildStorm();
const PAL = ['#17171a','#c9c7c1','#f5c22b','#d6262b'];
post.uniforms.cA.value.set(PAL[0]); post.uniforms.cB.value.set(PAL[1]); post.uniforms.cC.value.set(PAL[2]); post.uniforms.cD.value.set(PAL[3]);
post.uniforms.bias.value = W.bias; post.uniforms.contrast.value = W.contrast;
const cam = { target:new THREE.Vector3(), dist:33, yaw:0, pitch:.2, idle:0 };
function resetCam(){ Object.assign(cam, {target:W.cam.target.clone(), dist:W.cam.dist, yaw:W.cam.yaw, pitch:W.cam.pitch, idle:0}); }
resetCam();
let autoRot = false, active = false, T = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// pointer: drag orbits (or looks around while riding), a tap clicks
const ray = new THREE.Raycaster(); let down=null; const pts=new Map(); let pinch=null;
// one finger (or the mouse) drags to orbit and taps to click; two fingers pinch to zoom, twist or slide to rotate
const base=(x,y,multi)=>({x,y,moved:multi?99:0,multi:!!multi,yaw:cam.yaw,pitch:cam.pitch,ry:rideLook.yaw,rp:rideLook.pitch});
const pinchState=()=>{ const [a,b]=[...pts.values()]; return {d:Math.hypot(b.x-a.x,b.y-a.y)||1, ang:Math.atan2(b.y-a.y,b.x-a.x), mx:(a.x+b.x)/2, my:(a.y+b.y)/2}; };
const onDown = e=>{ if (!active) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
  if (pts.size===1){ down=base(e.clientX,e.clientY,false); pinch=null; }
  else if (pts.size===2 && !camRide){ const p=pinchState(); pinch={...p, dist:cam.dist, yaw:cam.yaw, pitch:cam.pitch}; if (down){ down.multi=true; down.moved=99; } }
  if (e.pointerType!=='mouse') e.preventDefault(); };
const onMove = e=>{ if (pts.has(e.pointerId)) pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(!down) return;
  if (pinch && pts.size>=2){ const p=pinchState(); let da=p.ang-pinch.ang; if (da>Math.PI) da-=TAU; if (da<-Math.PI) da+=TAU;
    cam.dist=Math.max(12,Math.min(60,pinch.dist*pinch.d/p.d));
    cam.yaw=pinch.yaw - da - (p.mx-pinch.mx)*.006; cam.pitch=Math.max(-.05,Math.min(1.1,pinch.pitch+(p.my-pinch.my)*.004)); cam.idle=0; return; }
  if (pts.size>1 && !camRide) return;
  const dx=e.clientX-down.x, dy=e.clientY-down.y; down.moved=Math.max(down.moved,Math.abs(dx)+Math.abs(dy));
  if (camRide){ rideLook.yaw = down.ry - dx*.005; rideLook.pitch = Math.max(-1, Math.min(1, down.rp - dy*.004)); return; }
  cam.yaw = down.yaw - dx*.006; cam.pitch = Math.max(-.05, Math.min(1.1, down.pitch + dy*.004)); cam.idle=0; };
const onUp = e=>{ pts.delete(e.pointerId); if(!down) return;
  if (down.multi){ pinch=null; if (pts.size===1){ const q=[...pts.values()][0]; down=base(q.x,q.y,true); } else if (!pts.size) down=null; return; }
  const moved=down.moved; down=null; if (moved>(e.pointerType==='mouse'?6:12) || !active) return;
  if (camRide){ camRide.dismount(); return; }
  syncAudio();
  const r=canvas.getBoundingClientRect(); const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(v,camera); const hits=ray.intersectObjects(W.pick,false).filter(h=>{ for(let o=h.object;o;o=o.parent) if(!o.visible) return false; return true; });
  W.click(hits[0]||null, ray.ray); cam.idle=0; };
const onCancel = e=>{ pts.delete(e.pointerId); if (!pts.size){ down=null; pinch=null; } };
const onWheel = e=>{ if (!active) return; e.preventDefault(); cam.dist=Math.max(12,Math.min(60,cam.dist+e.deltaY*.02)); };
canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onCancel);
canvas.addEventListener('wheel', onWheel, {passive:false});
canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';

function frame(dt){
  if (!active) return;
  dt = Math.min(.05, dt||.016); T += dt;
  resize(); syncAudio();
  if (AU.on && !padStop) startPad(); else if (!AU.on && padStop) stopPad();
  cam.idle+=dt; if (autoRot && cam.idle>3 && !reduce) cam.yaw += dt*.04;
  const dd=cam.dist*Math.min(1.7, Math.max(1, 1.15/camera.aspect)), cp=Math.cos(cam.pitch);
  camera.position.set(cam.target.x+Math.sin(cam.yaw)*cp*dd, cam.target.y+Math.sin(cam.pitch)*dd, cam.target.z+Math.cos(cam.yaw)*cp*dd);
  camera.lookAt(cam.target);
  if (camRide){ camera.position.copy(camRide.pos); camera.lookAt(camRide.look); }
  W.update(T,dt); tickPuffs(dt);
  renderer.setRenderTarget(rt); renderer.render(W.scene,camera);
  renderer.setRenderTarget(null); renderer.render(postScene,postCam);
}
return {
  frame,
  start(){ active=true; W.reset(); resetCam(); rideLook.yaw=0; rideLook.pitch=0; cw=0; resize(); },
  stop(){ active=false; down=null; pinch=null; pts.clear(); stopPad(); if (droneStop) droneStop(); },
  drop(){ if (active) W.drop(); },
  setRotate(on){ autoRot=!!on; cam.idle=9; },
  destroy(){ this.stop(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('wheel', onWheel);
    try{ renderer.dispose(); rt.dispose(); renderer.forceContextLoss(); }catch(_){} }
};
} };
})();
