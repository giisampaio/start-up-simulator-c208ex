import './style.css'

/* =========================================================================
   Caravan EX — Simulador de Partida (Fase 1)
   Portado do protótipo v3 (by Giovane Sampaio) para projeto Vite/TS.
   Mudanças de fidelidade nesta fase:
     • Bandas dos instrumentos corrigidas para o EX 867 SHP.
     • Redline de torque DINÂMICA (varia com OAT) e dependente do AVIONICS 2.
     • Redline de ITT muda entre Start mode (1090°C) e Run mode (850°C).
     • Correções de bugs (FUEL BOOST ON, boot lines, etc.).
     • Layout responsivo (CSS): EIS fixo no topo no celular.
   A física de spool/ITT segue o modelo aproximado do v3 (calibração fina e
   o auto-corte em 46% Ng ficam para a Fase 2).
   ========================================================================= */

const S: any = {}

function reset(){
  Object.assign(S,{t:0,extPwr:'OFF',gpuConnected:(S.initGpu??false),battery:false,generator:'ON',fuelBoost:'OFF',stbyAlt:'OFF',ignition:'NORM',
    starter:false,starterMode:'OFF',avStby:'OFF',avBusTie:'OFF',av1:'OFF',av2:'OFF',emergPwr:'NORMAL',fuelCondition:'CUTOFF',
    selL:'OFF',selR:'OFF',oat:15,
    Ng:0,ITT:15,Np:0,torque:0,oilPsi:0,oilTemp:15,fflow:0,batAmps:0,busVolts:0,fuelL:(S.initFuelL??1110),fuelR:(S.initFuelR??1110),
    spike:15,lightT:0,lit:false,peakITT:0,hotStart:false,idleReached:false,idleStable:0,rsvrSecs:45,firedStarve:false,firedRsvr:false,
    eisState:'off',bootT:0,genTripped:false,
    starterTimer:0,starterMax:0,starterCycleExceed:false,
    fuelNgAtIntro:null,oilAtIntro:null,boostAtIntro:null,emergAtStart:null,pwrAtStart:null,selsAtStart:null,ngAtStarterCut:null,idleITT:null,
    log:[],firedHot:false,firedIdle:false,finished:false})
  S.ITT=15;S.oilTemp=15;S.spike=15
  renderSwitches();renderSelectors();renderEmerg();renderFclever();renderOat();renderGpu()
  document.getElementById('verdict')!.className='verdict';document.getElementById('log')!.innerHTML=''
  logMsg('Pronto. Abra as seletoras (overhead), ligue a bateria e siga o fluxo.','')
}
const GPU_V=27.5
const pwr=()=>S.battery||(S.gpuConnected&&S.extPwr==='BUS')
const canCrankNow=()=>S.battery||(S.gpuConnected&&S.extPwr==='STARTER')
const BOOTDUR=3.0
const BOOTLINES:[number,string][]=[[0.3,'AHRS ALIGN'],[0.9,'AIR DATA'],[1.5,'ENGINE / EIS'],[2.0,'DATABASE']]
function updBootLines(t:number){document.getElementById('eb-lines')!.innerHTML=BOOTLINES.filter(l=>t>=l[0]).map(l=>`<div><span>${l[1]}</span><span class="ok">OK</span></div>`).join('')}
const idleNg=()=>S.fuelCondition==='HIGH'?71:62;const SELF=50
function logMsg(m:string,c:string){const s=S.t>0?` <span class="snap">[Ng ${S.Ng.toFixed(0)}% · ITT ${S.ITT.toFixed(0)}° · óleo ${S.oilPsi.toFixed(0)}]</span>`:''
  S.log.unshift(`<div><span class="t">${S.t.toFixed(1)}s</span> <span class="${c}">${m}</span>${s}</div>`);document.getElementById('log')!.innerHTML=S.log.join('')}

/* ---------- redlines dinâmicas (fidelidade EX) ---------- */
// Torque: com AVIONICS 2 OFF a redline trava em 2397 (POH). Com AV2 ON ela é
// "dinâmica" — aqui modelada caindo com OAT alta (proxy de densidade do ar).
function trqRL(){return S.av2!=='ON'?2397:Math.max(1865,Math.round(2397-Math.max(0,S.oat-15)*9))}
// ITT: Start mode (até auto-sustento) redline 1090°C; Run mode 850°C.
function ittRL(){return (S.lit&&S.Ng>=55)?850:1090}

/* ---------- áudio (buzina) ---------- */
let actx:any,hornGain:any,hornOsc:any
function ensureAudio(){if(!actx){try{actx=new(window.AudioContext||(window as any).webkitAudioContext)();hornGain=actx.createGain();hornGain.gain.value=0;hornOsc=actx.createOscillator();hornOsc.type='square';hornOsc.frequency.value=380;hornOsc.connect(hornGain).connect(actx.destination);hornOsc.start()}catch(e){}}if(actx&&actx.state==='suspended')actx.resume();requestWakeLock()}
let wakeLock:any=null
async function requestWakeLock(){try{if('wakeLock'in navigator&&!wakeLock){wakeLock=await (navigator as any).wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')requestWakeLock()})

function selWarn(){if(!pwr())return false;const bothOff=S.selL!=='ON'&&S.selR!=='ON';const oneOffStart=S.starter&&(S.selL!=='ON'||S.selR!=='ON');return bothOff||oneOffStart}

/* ---------- switches (painel lateral) ---------- */
const SW:any={
  extPwr:{name:'Ext Power',guard:true,pos:[['BUS','BUS'],['STARTER','STR'],['OFF','OFF']]},
  battery:{name:'Battery',pos:[['on','ON'],['off','OFF']]},
  generator:{name:'Generator',pos:[['RESET','RST'],['ON','ON'],['TRIP','TRIP']]},
  fuelBoost:{name:'Fuel Boost',pos:[['ON','ON'],['NORM','NORM'],['OFF','OFF']]},
  stbyAlt:{name:'Stby Alt Pwr',boxed:true,pos:[['ON','ON'],['OFF','OFF']]},
  ignition:{name:'Ignition',pos:[['ON','ON'],['NORM','NORM']]},
  starter:{name:'Starter',pos:[['on','START'],['off','OFF'],['motor','MOTOR']]},
  avStby:{name:'Av Stby Pwr',guard:true,pos:[['ON','ON'],['OFF','OFF']]},
  avBusTie:{name:'Av Bus Tie',guard:true,pos:[['ON','ON'],['OFF','OFF']]},
  av1:{name:'Avionics 1',pos:[['ON','ON'],['OFF','OFF']]},
  av2:{name:'Avionics 2',pos:[['ON','ON'],['OFF','OFF']]},
}
const PANEL=[['extPwr','battery'],['generator','fuelBoost'],['stbyAlt','ignition','starter'],['avStby','avBusTie','av1','av2']]
function curVal(k:string){if(k==='battery')return S.battery?'on':'off';if(k==='starter')return S.starter?(S.starterMode==='MOTOR'?'motor':'on'):'off';return S[k]}
function oneSwitch(k:string){const c=SW[k];const h=c.pos.length*28;const cur=curVal(k);const idx=Math.max(0,c.pos.findIndex((p:any)=>p[0]===cur))
  return `<div class="switch"><div class="sw-wrap ${c.boxed?'boxed':''}">
    <div class="sw-track" data-sw="${k}" style="height:${h+4}px">${c.pos.map((p:any)=>`<div class="sw-pos" data-v="${p[0]}"></div>`).join('')}
      <div class="sw-knob ${c.guard?'guard':''}" style="top:${2+idx*28}px"></div></div>
    <div class="sw-labels" style="height:${h+4}px">${c.pos.map((p:any)=>`<span data-sw="${k}" data-v="${p[0]}" class="${p[0]===cur?'act':''}">${p[1]}</span>`).join('')}</div>
    </div><div class="sw-name">${c.name}</div></div>`}
function renderSwitches(){document.getElementById('swpanel')!.innerHTML=PANEL.map(row=>`<div class="swrow">${row.map(oneSwitch).join('')}</div>`).join('')}
function renderEmerg(){document.getElementById('emergSlot')!.innerHTML=
  `<span style="font-family:'Saira Condensed';font-weight:700;text-transform:uppercase;font-size:.66rem;color:#cdd4dd">Emerg Power</span>`+
  `<div class="seg" style="flex:1"><button data-emerg="NORMAL" style="flex:1;font-family:'Saira Condensed';font-weight:600;font-size:.78rem;padding:11px;border-radius:8px;border:1px solid #1b1f25;background:${S.emergPwr==='NORMAL'?'var(--cyan)':'#222a34'};color:${S.emergPwr==='NORMAL'?'#06223a':'#aeb7c2'};cursor:pointer">NORMAL</button>`+
  `<button data-emerg="FWD" style="flex:1;font-family:'Saira Condensed';font-weight:600;font-size:.78rem;padding:11px;border-radius:8px;border:1px solid #1b1f25;background:${S.emergPwr==='FWD'?'var(--red)':'#222a34'};color:${S.emergPwr==='FWD'?'#3a0c0a':'#aeb7c2'};cursor:pointer">À FRENTE</button></div>`}
function renderSelectors(){document.getElementById('selectors')!.innerHTML=['L','R'].map(s=>{const on=S['sel'+s]==='ON';const side=s==='L'?'left':'right'
  return `<div class="fs"><div class="sel-dial ${side} ${on?'on':''}" data-sel="${s}"><span class="sel-lbl sel-off">OFF</span><span class="sel-lbl sel-on">ON·165</span><div class="lever"></div><div class="pivot"></div></div><div class="fs-name">${s==='L'?'Esquerda':'Direita'}</div></div>`}).join('')}
const FC_POS:any={HIGH:7,LOW:45,CUTOFF:85}  // posição da manete (% do topo do trilho)
function renderFclever(){const h=document.getElementById('fcl-handle');if(h)h.style.top=FC_POS[S.fuelCondition]+'%'
  document.querySelectorAll('#fclever [data-fc]').forEach(el=>(el as HTMLElement).classList.toggle('act',(el as HTMLElement).dataset.fc===S.fuelCondition))}
function setFuelCondition(v:string){
  if(v==='LOW'||v==='HIGH'){
    if(!S.lit&&S.fuelNgAtIntro===null){S.fuelNgAtIntro=S.Ng;S.oilAtIntro=S.oilPsi;S.boostAtIntro=S.fuelBoost;logMsg('FUEL CONDITION → '+(v==='LOW'?'LOW IDLE':'HIGH IDLE')+' — introduzindo combustível',S.Ng>=12?'':'e-bad')}
    else logMsg('FUEL CONDITION → '+(v==='LOW'?'LOW IDLE':'HIGH IDLE'),'')
    S.fuelCondition=v
  } else {
    logMsg('FUEL CONDITION → CUTOFF',S.lit?'e-warn':'');if(S.lit){S.lit=false;logMsg('Combustível cortado — motor desliga','e-warn')}S.fuelCondition='CUTOFF'
  }
  renderFclever()
}
// manete arrastável (com gate no CUTOFF)
;(function setupFclever(){const track=document.getElementById('fcl-track'),handle=document.getElementById('fcl-handle');if(!track||!handle)return
  const frac=(e:any)=>{const r=track.getBoundingClientRect();return Math.max(0.04,Math.min(0.93,(e.clientY-r.top)/r.height))}
  const nearest=(f:number)=> f>0.70?'CUTOFF':(f<0.26?'HIGH':'LOW')  // gate: só vai a CUTOFF puxando bem pra baixo
  let drag=false
  handle.addEventListener('pointerdown',(e:any)=>{e.preventDefault();ensureAudio();drag=true;handle.classList.add('grabbing');try{handle.setPointerCapture(e.pointerId)}catch(_){}})
  handle.addEventListener('pointermove',(e:any)=>{if(!drag)return;handle.style.top=(frac(e)*100)+'%'})
  const end=(e:any)=>{if(!drag)return;drag=false;handle.classList.remove('grabbing');setFuelCondition(nearest(frac(e)))}
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end)
  document.querySelectorAll('#fclever [data-fc]').forEach(el=>el.addEventListener('click',()=>{ensureAudio();setFuelCondition((el as HTMLElement).dataset.fc!)}))
})()
function renderOat(){document.querySelectorAll('#oatseg button').forEach(b=>(b as HTMLElement).classList.toggle('active',parseFloat((b as HTMLElement).dataset.v!)===S.oat))}

function setSw(k:string,v:string){ensureAudio()
  if(k==='battery'){const on=v==='on';if(on!==S.battery){S.battery=on;logMsg('Bateria '+(on?'ON':'OFF'),'')}renderSwitches();return}
  if(k==='starter'){const mode=v==='on'?'START':(v==='motor'?'MOTOR':'OFF')
    if(mode==='OFF'){
      if(S.starter){S.starter=false;S.starterMode='OFF';S.ngAtStarterCut=S.Ng;logMsg('STARTER → OFF (Ng '+S.Ng.toFixed(0)+'%)',S.Ng>=55?'e-good':(S.lit?'e-warn':''))
        if(S.lit&&S.Ng<SELF)logMsg('Starter cortado antes do auto-sustento — risco de hung/hot start','e-bad')}
    } else {
      const wasOff=!S.starter;S.starter=true;S.starterMode=mode;if(wasOff)S.starterTimer=0
      if(mode==='START'){S.pwrAtStart=pwr();S.emergAtStart=S.emergPwr;S.selsAtStart=(S.selL==='ON'&&S.selR==='ON')}
      const canCrank=S.battery||S.extPwr==='STARTER'
      logMsg('STARTER → '+mode+(mode==='MOTOR'?' (dry motoring — sem ignição)':''),(pwr()&&canCrank)?'':'e-bad')
      if(mode==='MOTOR'&&S.ignition!=='NORM')logMsg('Interlock: MOTOR só motoriza com IGNITION em NORM','e-warn')
      if(!pwr())logMsg('Sem energia no barramento — starter não gira!','e-bad')
      else if(!canCrank)logMsg('EXT POWER em BUS não alimenta o starter (use bateria ou EXT POWER em STARTER)','e-bad')
    }
    renderSwitches();return}
  S[k]=v
  if(k==='fuelBoost')logMsg('Fuel Boost → '+v,v==='OFF'?'e-warn':'')
  else if(k==='extPwr'){logMsg('External Power → '+v,(v!=='OFF'&&!S.gpuConnected)?'e-warn':'');if(v!=='OFF'&&!S.gpuConnected)logMsg('Nenhuma fonte externa conectada — conecte a GPU para ter efeito.','e-warn')}
  else if(k==='ignition')logMsg('Ignition → '+v,'')
  else if(k==='generator'){if(v==='TRIP'){S.genTripped=true;logMsg('Generator TRIP — gerador desconectado','e-warn')}else if(v==='RESET'){S.genTripped=false;logMsg('Generator RESET — gerador rearmado','e-good')}}
  else if(k==='stbyAlt')logMsg('Stby Alt Pwr → '+v,'')
  else if(SW[k])logMsg(SW[k].name+' → '+v,'')
  renderSwitches()
}
const MOMENTARY:any={starter:{vals:['motor'],ret:'off'},generator:{vals:['RESET','TRIP'],ret:'ON'}}
function posAt(e:any){const lab=e.target.closest('[data-sw][data-v]');const tr=e.target.closest('.sw-track[data-sw]')
  if(lab)return{k:lab.dataset.sw,v:lab.dataset.v}
  if(tr){const cells=[...tr.querySelectorAll('.sw-pos')];const r=tr.getBoundingClientRect();const idx=Math.max(0,Math.min(cells.length-1,Math.floor((e.clientY-r.top)/28)));return{k:tr.dataset.sw,v:cells[idx].dataset.v}}
  return null}
function isMomentary(k:string,v:string){return MOMENTARY[k]&&MOMENTARY[k].vals.includes(v)}
document.getElementById('swpanel')!.addEventListener('click',e=>{const p=posAt(e);if(!p)return;if(isMomentary(p.k,p.v))return;setSw(p.k,p.v)})
let held:any=null
function releaseHeld(){if(held){const h=held;held=null;setSw(h.k,h.ret)}}
document.getElementById('swpanel')!.addEventListener('pointerdown',e=>{const p=posAt(e);if(p&&isMomentary(p.k,p.v)){e.preventDefault();ensureAudio();held={k:p.k,ret:MOMENTARY[p.k].ret};setSw(p.k,p.v)}})
document.addEventListener('pointerup',releaseHeld);document.addEventListener('pointercancel',releaseHeld)
document.getElementById('selectors')!.addEventListener('click',e=>{const l=(e.target as HTMLElement).closest('[data-sel]') as HTMLElement;if(!l)return;ensureAudio()
  const s=l.dataset.sel!;S['sel'+s]=S['sel'+s]==='ON'?'OFF':'ON';l.classList.toggle('on',S['sel'+s]==='ON');logMsg('Seletora '+(s==='L'?'esquerda':'direita')+' → '+S['sel'+s],S['sel'+s]==='ON'?'':'e-warn')})
document.getElementById('emergSlot')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('[data-emerg]') as HTMLElement;if(!b)return;ensureAudio()
  S.emergPwr=b.dataset.emerg;logMsg('Emerg Power → '+(S.emergPwr==='NORMAL'?'NORMAL':'À FRENTE'),S.emergPwr==='NORMAL'?'':'e-bad');renderEmerg()})
// (FUEL CONDITION agora é a manete fixa à direita — ver setupFclever / setFuelCondition)
document.getElementById('oatseg')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('button') as HTMLElement;if(!b)return;ensureAudio();S.oat=parseFloat(b.dataset.v!);if(!S.lit){S.ITT=S.oat;S.oilTemp=S.oat;S.spike=S.oat}renderOat()})
function renderGpu(){document.querySelectorAll('#gpuseg button').forEach(b=>(b as HTMLElement).classList.toggle('active',(((b as HTMLElement).dataset.gpu==='on')===S.gpuConnected)))}
document.getElementById('gpuseg')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('button') as HTMLElement;if(!b)return;ensureAudio();const on=b.dataset.gpu==='on';if(on!==S.gpuConnected){S.gpuConnected=on;logMsg('Fonte externa (GPU) '+(on?'CONECTADA (~27,5 V) — selecione EXT POWER em BUS/STARTER':'desconectada'),on?'e-good':'e-warn')}renderGpu()})

/* ---------- gauges redondos ---------- */
const RG:any[]=[
  {k:'torque',l:'TRQ',u:'FT-LB',min:0,max:2600,bands:[[0,2397,'g']],rlFn:trqRL,dec:0},
  {k:'ITT',l:'ITT',u:'°C',min:0,max:1100,bands:[[0,825,'g'],[825,850,'a'],[850,1100,'r']],rlFn:ittRL,dec:0},
  {k:'Ng',l:'Ng',u:'%',min:0,max:110,bands:[[50,100,'g'],[100,103.7,'a'],[103.7,110,'r']],rl:103.7,dec:1},
]
const CM:any={g:'#3fd66b',a:'#f0b429',r:'#ff5046'}
function apt(cx:number,cy:number,r:number,a:number){const rad=a*Math.PI/180;return[cx+r*Math.sin(rad),cy-r*Math.cos(rad)]}
function arc(cx:number,cy:number,r:number,a0:number,a1:number){const[x0,y0]=apt(cx,cy,r,a0),[x1,y1]=apt(cx,cy,r,a1);return`M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${(a1-a0)>180?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`}
const A0=-135,A1=135,cx=84,cy=72,R=54
function v2a(g:any,v:number){return A0+(Math.max(g.min,Math.min(g.max,v))-g.min)/(g.max-g.min)*(A1-A0)}
function rlVal(g:any){return g.rlFn?g.rlFn():g.rl}
function buildRounds(){document.getElementById('rounds')!.innerHTML=RG.map(g=>{let s=`<svg viewBox="0 0 168 144" class="rg-svg">`
  s+=`<path d="${arc(cx,cy,R,A0,A1)}" fill="none" stroke="#222b38" stroke-width="9" stroke-linecap="round"/>`
  g.bands.forEach((b:any)=>{s+=`<path d="${arc(cx,cy,R,v2a(g,b[0]),v2a(g,b[1]))}" fill="none" stroke="${CM[b[2]]}" stroke-width="9"/>`})
  const rl=rlVal(g);if(rl){const[a,b]=apt(cx,cy,R+6,v2a(g,rl)),[c,d]=apt(cx,cy,R-6,v2a(g,rl));s+=`<line id="rl-${g.k}" x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="#ff5046" stroke-width="3"/>`}
  s+=`<text x="${cx}" y="15" text-anchor="middle" fill="#9fb0c4" font-family="Saira Condensed" font-weight="700" font-size="14">${g.l}</text>`
  s+=`<text x="${cx}" y="28" text-anchor="middle" fill="#5c6b7d" font-family="JetBrains Mono" font-size="8">${g.u}</text>`
  s+=`<line id="nd-${g.k}" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-R+8}" stroke="#fff" stroke-width="3" stroke-linecap="round" transform="rotate(${v2a(g,0)},${cx},${cy})"/>`
  s+=`<circle cx="${cx}" cy="${cy}" r="5" fill="#cfd6df"/>`
  s+=`<text id="tx-${g.k}" x="${cx}" y="130" text-anchor="middle" fill="#fff" font-family="JetBrains Mono" font-weight="700" font-size="26">0</text></svg>`;return s}).join('')}
function updRounds(){RG.forEach(g=>{const v=S[g.k]||0;document.getElementById('nd-'+g.k)!.setAttribute('transform',`rotate(${v2a(g,v).toFixed(1)},${cx},${cy})`)
  const rl=rlVal(g);const rlEl=document.getElementById('rl-'+g.k)
  if(rl&&rlEl){const[a,b]=apt(cx,cy,R+6,v2a(g,rl)),[c,d]=apt(cx,cy,R-6,v2a(g,rl));rlEl.setAttribute('x1',a.toFixed(1));rlEl.setAttribute('y1',b.toFixed(1));rlEl.setAttribute('x2',c.toFixed(1));rlEl.setAttribute('y2',d.toFixed(1))}
  const tx=document.getElementById('tx-'+g.k)!;tx.textContent=v.toFixed(g.dec);let col='#fff'
  if(g.k==='ITT')col=v>ittRL()?'#ff5046':v>825?'#f0b429':'#fff'
  else if(g.k==='torque')col=v>trqRL()?'#ff5046':'#fff'
  else{for(const b of g.bands)if(v>=b[0]&&v<b[1])col=CM[b[2]]}
  tx.setAttribute('fill',col)})}

/* ---------- barras horizontais (óleo) — bandas EX ---------- */
const HB:any[]=[
  {k:'oilPsi',t:'t-oilp',d:'d-oilp',min:0,max:200,bands:[[0,40,'r'],[40,85,'a'],[85,105,'g'],[105,200,'r']],dec:0},
  {k:'oilTemp',t:'t-oilt',d:'d-oilt',min:-40,max:110,bands:[[-40,32,'a'],[32,99,'g'],[99,105,'a'],[105,110,'r']],dec:0},
]
function buildHB(){HB.forEach(h=>{document.getElementById(h.t)!.innerHTML=h.bands.map((b:any)=>`<div class="hband" style="left:${(b[0]-h.min)/(h.max-h.min)*100}%;width:${(b[1]-b[0])/(h.max-h.min)*100}%;background:${CM[b[2]]};opacity:.4"></div>`).join('')+`<div class="hneedle" id="nh-${h.k}"></div>`})}
function updHB(){HB.forEach(h=>{const v=S[h.k]||0;document.getElementById('nh-'+h.k)!.style.left=Math.max(0,Math.min(100,(v-h.min)/(h.max-h.min)*100))+'%';document.getElementById(h.d)!.textContent=v.toFixed(h.dec)})}
function updExtras(){document.getElementById('d-np')!.textContent=S.Np.toFixed(0);document.getElementById('d-ff')!.textContent=S.fflow.toFixed(0)
  document.getElementById('d-bat')!.textContent=S.batAmps.toFixed(0);const volt=document.getElementById('d-volt')!;volt.textContent=S.busVolts.toFixed(1)
  volt.style.color=(S.busVolts>0&&S.busVolts<23)||S.busVolts>32.5?'#ff5046':'#fff'
  document.getElementById('fq-l')!.style.height=(S.fuelL/1110*100)+'%';document.getElementById('fq-r')!.style.height=(S.fuelR/1110*100)+'%'
  document.getElementById('d-fl')!.textContent=S.fuelL.toFixed(0);document.getElementById('d-fr')!.textContent=S.fuelR.toFixed(0)
  const fd=document.getElementById('d-fdelta')!;const imb=Math.abs(S.fuelL-S.fuelR);fd.textContent=imb.toFixed(0);fd.style.color=imb>200?'#f0b429':'#fff'}

/* ---------- CAS ---------- */
function casActive():[string,boolean,string][]{const P=pwr();const ignOn=P&&((S.starter&&S.starterMode==='START')||S.ignition==='ON');const feeding=S.selL==='ON'||S.selR==='ON'
  return[['FUEL SELECT OFF',selWarn(),'r'],['RSVR FUEL LOW',P&&!feeding&&S.rsvrSecs<25,'r'],['OIL PRESS LOW',P&&S.lit&&S.oilPsi<40,'r'],
    ['EMERG PWR LVR',P&&S.emergPwr!=='NORMAL','r'],['VOLTS LOW',P&&S.busVolts>0&&S.busVolts<23,'r'],
    ['GENERATOR OFF',P&&(!(S.lit&&S.Ng>50&&!S.starter)||S.genTripped),'a'],['STARTER ON',S.starter,'a'],
    ['FUEL PRESS LOW',P&&S.fuelBoost==='OFF'&&S.fuelCondition!=='CUTOFF','a'],['FUEL BOOST ON',S.fuelBoost==='ON','a'],
    ['FUEL IMBALANCE',P&&Math.abs(S.fuelL-S.fuelR)>200,'a'],
    ['IGNITION ON',ignOn,'w']]}
function drawCAS(){const act=casActive().filter(m=>m[1]);const el=document.getElementById('cas-list')!
  el.innerHTML=act.length?act.map(m=>`<div class="cas-msg ${m[2]}">${m[0]}</div>`).join(''):`<div class="cas-empty">— sem mensagens —</div>`}

/* ---------- física ---------- */
let last=performance.now()
function tick(now:number){let dt=(now-last)/1000;last=now;if(dt>0.1)dt=0.1;S.t+=dt
  const P=pwr();const ignOn=P&&((S.starter&&S.starterMode==='START')||S.ignition==='ON')
  const feeding=S.selL==='ON'||S.selR==='ON'
  if(feeding)S.rsvrSecs=Math.min(45,S.rsvrSecs+dt*30);else if(S.lit)S.rsvrSecs=Math.max(0,S.rsvrSecs-dt*(S.fflow>130?1.6:1))
  if(!feeding&&S.lit&&S.rsvrSecs<25&&S.rsvrSecs>0&&!S.firedRsvr){S.firedRsvr=true;logMsg('RSVR FUEL LOW — reservatório acabando (seletoras fechadas)','e-warn')}
  if(S.lit&&S.rsvrSecs<=0&&!S.firedStarve){S.firedStarve=true;S.lit=false;logMsg('Reservatório esgotado — motor apagou. Abra as seletoras!','e-bad')}
  const fuelAvail=S.fuelBoost!=='OFF'&&S.rsvrSecs>0
  if(S.starter){S.starterTimer+=dt;S.starterMax=Math.max(S.starterMax,S.starterTimer);if(S.starterTimer>30&&!S.starterCycleExceed){S.starterCycleExceed=true;logMsg('Ciclo do starter excedeu 30 s!','e-bad')}}
  if(!S.lit&&(S.fuelCondition==='LOW'||S.fuelCondition==='HIGH')&&ignOn&&fuelAvail&&P){S.lit=true;S.lightT=0
    logMsg('Light-off — combustível inflamou; observe o pico de ITT',S.Ng<10?'e-warn':'e-good')}
  if(S.lit)S.lightT+=dt
  // --- Ng (gerador de gases) ---
  // Após o light-off há ~2,5 s de fase de "light" (Ng quase parado) enquanto a ITT dá o pico;
  // só depois o motor acelera até o idle.
  let tNg,r
  if(S.lit){
    if(S.starter&&S.lightT<2.5){tNg=Math.max(S.Ng,12);r=0.25}
    else if(S.starter){tNg=idleNg()+3;r=0.28}
    else if(S.Ng>=SELF){tNg=idleNg();r=0.4}
    else{tNg=0;r=0.4}
  }else{
    const crank=S.starter&&P&&canCrankNow()&&(S.starterMode!=='MOTOR'||S.ignition==='NORM')
    const gpuStartC=S.gpuConnected&&S.extPwr==='STARTER'
    tNg=crank?(gpuStartC?23:20):0;r=crank?(gpuStartC?0.95:0.8):0.5
  }
  S.Ng+=(tNg-S.Ng)*r*dt;if(S.Ng<0)S.Ng=0
  // --- Fuel flow (PPH) --- EMERG fora do NORMAL despeja excesso de combustível
  const ffBase=S.lit?(S.fuelCondition==='HIGH'?150:110):0
  const ffTarget=ffBase*(S.lit&&S.emergPwr!=='NORMAL'?1.7:1)
  S.fflow+=(ffTarget-S.fflow)*1.6*dt
  // --- ITT (física) --- temperatura de equilíbrio = idle + "bump" (combustível/ar): muito
  // combustível com pouco ar (Ng baixo) => pico; atraso térmico faz a ITT subir/descer suave.
  const ittIdle=(S.fuelCondition==='HIGH'?665:625)+Math.max(0,(S.oat-15))*2.5
  const bump=S.lit?3.3*S.fflow*Math.max(0,(SELF-S.Ng))/SELF:0
  const ittEq=S.lit?(ittIdle+bump):S.oat
  S.ITT+=(ittEq-S.ITT)*(S.lit?2.0:1.0)*dt
  S.peakITT=Math.max(S.peakITT,S.ITT);if(S.ITT>1090&&!S.firedHot){S.firedHot=true;S.hotStart=true;logMsg('⚠ HOT START — ITT > 1090°C! Leve FUEL CONDITION a CUTOFF','e-bad')}
  S.oilPsi+=((S.Ng<3?0:Math.min(S.lit?95:140,S.Ng*1.55))-S.oilPsi)*1.1*dt
  S.oilTemp+=(((S.lit?42:S.oat))-S.oilTemp)*0.05*dt
  S.Np+=(((S.lit&&S.Ng>50)?600+(S.Ng-50)*16:(S.lit&&S.Ng>45?(S.Ng-45)*40:0))-S.Np)*0.7*dt
  S.torque+=(((S.lit&&S.Np>300)?150:0)-S.torque)*0.6*dt
  // --- Elétrico (bateria + GPU) ---
  const genOn=S.lit&&S.Ng>50&&!S.starter&&!S.genTripped
  const gpuBus=S.gpuConnected&&S.extPwr==='BUS'        // GPU alimenta o barramento (~27,5 V)
  const gpuStart=S.gpuConnected&&S.extPwr==='STARTER'  // GPU alimenta o starter (poupa a bateria)
  let vT;if(!P)vT=0;else if(genOn)vT=28.5;else if(gpuBus)vT=GPU_V;else if(S.starter&&!gpuStart)vT=22.2;else vT=24.2
  S.busVolts+=(vT-S.busVolts)*2.2*dt
  let aT;if(!P)aT=0;else if(S.starter)aT=gpuStart?-12:-190;else if(genOn)aT=6;else if(gpuBus)aT=2;else aT=-3
  S.batAmps+=(aT-S.batAmps)*2.5*dt
  if(S.lit){const burn=S.fflow/3600*dt;if(S.selL==='ON')S.fuelL-=burn*(S.selR==='ON'?.5:1);if(S.selR==='ON')S.fuelR-=burn*(S.selL==='ON'?.5:1)}
  if(S.lit&&!S.starter&&Math.abs(S.Ng-idleNg())<6&&S.ITT<720){S.idleStable+=dt;if(S.idleStable>1.5&&!S.firedIdle){S.firedIdle=true;S.idleReached=true;S.idleITT=S.ITT;logMsg('Idle estável — motor em auto-sustento ✓','e-good')}}else S.idleStable=0
  if(S.idleReached)S.idleITT=S.ITT
  if(hornGain){const beat=Math.floor(S.t*3)%2;hornGain.gain.value=selWarn()?(beat?0.05:0):0}
  updRounds();updHB();updExtras();drawCAS()
  const eisP=pwr()&&S.av1==='ON';const eis=document.getElementById('eis')!
  if(!eisP){S.eisState='off';S.bootT=0}
  else{if(S.eisState==='off'){S.eisState='booting';S.bootT=0}if(S.eisState==='booting'){S.bootT+=dt;if(S.bootT>=BOOTDUR)S.eisState='on'}}
  eis.classList.toggle('off',S.eisState==='off');eis.classList.toggle('booting',S.eisState==='booting')
  if(S.eisState==='booting'){document.getElementById('eb-fill')!.style.width=Math.min(100,S.bootT/BOOTDUR*100)+'%';updBootLines(S.bootT)}
  requestAnimationFrame(tick)}

/* ---------- análise (verdict) ---------- */
function analyze(){const c:[string,boolean,string][]=[
  ['Energia (bateria/ext) disponível na partida',S.pwrAtStart===true,'O starter precisa de energia elétrica.'],
  ['Seletoras L e R em ON antes da partida',S.selsAtStart===true,'Na partida, qualquer seletora OFF dispara FUEL SELECT OFF + buzina.'],
  ['EMERG POWER em NORMAL na partida',(S.emergAtStart||S.emergPwr)==='NORMAL','Fora do NORMAL causa over-temperature.'],
  ['Fuel Boost ativo ao introduzir combustível',S.boostAtIntro&&S.boostAtIntro!=='OFF','Sem pressão = partida pendurada (hung).'],
  ['Óleo indicando antes do combustível',S.oilAtIntro!=null&&S.oilAtIntro>1,'Confirme OIL PSI subindo no motoring.'],
  ['Combustível com Ng ≥ 12%',S.fuelNgAtIntro!=null&&S.fuelNgAtIntro>=12,'Cedo demais = pouco ar = hot start.'],
  ['ITT não excedeu 1090°C',!S.hotStart,'Pico '+S.peakITT.toFixed(0)+'°C.'],
  ['Starter cortado com Ng ≥ 55%',S.ngAtStarterCut!=null&&S.ngAtStarterCut>=55,S.ngAtStarterCut!=null?('Cortado em '+S.ngAtStarterCut.toFixed(0)+'%.'):'Você não cortou o starter.'],
  ['Ciclo do starter ≤ 30 s',!S.starterCycleExceed,'Usado '+S.starterMax.toFixed(0)+'s (máx 30s).'],
  ['ITT de idle ≤ 700°C',S.idleITT==null||S.idleITT<=700,'Idle ITT '+(S.idleITT?S.idleITT.toFixed(0):'-')+'°C.'],
  ['AVIONICS 2 ligado após a partida',S.av2==='ON','Liga-se após a partida (redline dinâmica de torque).'],
  ['STBY ALT PWR ligado após a partida',S.stbyAlt==='ON','Liga-se o STBY ALT PWR depois da partida, com o gerador online.'],
  ['Atingiu idle estável',S.idleReached===true,'Motor deve auto-sustentar no idle.']]
  const fails=c.filter(x=>!x[1]).length;const v=document.getElementById('verdict')!;v.className='verdict show '+(fails===0?'good':'bad')
  v.innerHTML=`<h3>${fails===0?'✓ Bom acionamento':'✗ '+fails+' problema'+(fails>1?'s':'')}</h3>`+c.map(x=>`<div class="check ${x[1]?'ok':'no'}"><span class="mk">${x[1]?'✓':'✗'}</span><span>${x[0]}${x[1]?'':' — <b>'+x[2]+'</b>'}</span></div>`).join('')
  S.finished=true;v.scrollIntoView({behavior:'smooth',block:'nearest'})}
document.getElementById('analyze')!.addEventListener('click',analyze)
document.getElementById('reset')!.addEventListener('click',openInit)

// ---- Tela de inicialização (combustível + fonte externa) ----
let initGpuSel=false
function updInitLabels(){const l=+(document.getElementById('ir-l') as HTMLInputElement).value;const r=+(document.getElementById('ir-r') as HTMLInputElement).value
  document.getElementById('il-l')!.textContent=String(l);document.getElementById('il-r')!.textContent=String(r)
  document.getElementById('il-total')!.textContent=String(l+r);document.getElementById('il-gal')!.textContent=String(Math.round((l+r)/6.7))}
function syncInit(){initGpuSel=S.initGpu??false
  ;(document.getElementById('ir-l') as HTMLInputElement).value=String(S.initFuelL??1110)
  ;(document.getElementById('ir-r') as HTMLInputElement).value=String(S.initFuelR??1110)
  updInitLabels()
  document.querySelectorAll('#initgpu button').forEach(b=>(b as HTMLElement).classList.toggle('active',((b as HTMLElement).dataset.gpu==='on')===initGpuSel))}
function openInit(){syncInit();document.getElementById('initov')!.classList.remove('hidden')}
;['ir-l','ir-r'].forEach(id=>document.getElementById(id)!.addEventListener('input',updInitLabels))
document.getElementById('fuelpreset')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('button') as HTMLElement;if(!b)return;const v=b.dataset.fuel!;(document.getElementById('ir-l') as HTMLInputElement).value=v;(document.getElementById('ir-r') as HTMLInputElement).value=v;updInitLabels()})
document.getElementById('initgpu')!.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest('button') as HTMLElement;if(!b)return;initGpuSel=b.dataset.gpu==='on';document.querySelectorAll('#initgpu button').forEach(x=>(x as HTMLElement).classList.toggle('active',x===b))})
document.getElementById('initstart')!.addEventListener('click',()=>{ensureAudio()
  S.initFuelL=+(document.getElementById('ir-l') as HTMLInputElement).value
  S.initFuelR=+(document.getElementById('ir-r') as HTMLInputElement).value
  S.initGpu=initGpuSel
  reset()
  document.getElementById('initov')!.classList.add('hidden')})
syncInit()

buildRounds();buildHB();reset();requestAnimationFrame(tick)

// PWA: registra o service worker apenas no build de produção (evita atrapalhar o HMR no dev)
if((import.meta as any).env?.PROD && 'serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))
}
