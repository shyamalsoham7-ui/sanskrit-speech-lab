
const SR=16000,N=400,H=160,NF=512,NM=26,NC=13,S=20;
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/* ---------- feature extraction ---------- */
const hamm=Float32Array.from({length:N},(_,i)=>.54-.46*Math.cos(2*Math.PI*i/(N-1)));
const mel=f=>2595*Math.log10(1+f/700),imel=m=>700*(10**(m/2595)-1);
const fb=(()=>{const lo=mel(0),hi=mel(SR/2),p=[];for(let i=0;i<NM+2;i++)p.push(Math.floor((NF+1)*imel(lo+(hi-lo)*i/(NM+1))/SR));
 const b=[];for(let m=1;m<=NM;m++){const f=new Float32Array(NF/2+1);for(let k=p[m-1];k<p[m];k++)f[k]=(k-p[m-1])/(p[m]-p[m-1]||1);for(let k=p[m];k<=p[m+1];k++)f[k]=(p[m+1]-k)/(p[m+1]-p[m]||1);b.push(f)}return b})();
const dct=Array.from({length:NC},(_,c)=>Float32Array.from({length:NM},(_,m)=>Math.cos(Math.PI*c*(m+.5)/NM)));
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const u=i+k,v=u+len/2,tr=re[v]*cr-im[v]*ci,ti=re[v]*ci+im[v]*cr;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}}
function extract(x){
 const y=new Float32Array(x.length);y[0]=x[0];for(let i=1;i<x.length;i++)y[i]=x[i]-.97*x[i-1];
 const F=[],E=[],cen=[],zc=[];
 for(let s=0;s+N<=y.length;s+=H){
  const re=new Float32Array(NF),im=new Float32Array(NF);let e=0,z=0;
  for(let i=0;i<N;i++){re[i]=y[s+i]*hamm[i];e+=x[s+i]*x[s+i];if(i&&(x[s+i]>=0)!==(x[s+i-1]>=0))z++}
  fft(re,im);const p=new Float32Array(NF/2+1);let ps=0,pw=0;
  for(let k=0;k<=NF/2;k++){p[k]=re[k]*re[k]+im[k]*im[k];ps+=p[k]*k*SR/NF;pw+=p[k]}
  const ml=fb.map(f=>{let a=0;for(let k=0;k<f.length;k++)a+=f[k]*p[k];return Math.log(a+1e-10)});
  F.push(dct.map(d=>{let a=0;for(let m=0;m<NM;m++)a+=d[m]*ml[m];return a}));
  E.push(10*Math.log10(e/N+1e-12));cen.push(ps/(pw+1e-10));zc.push(z/N);
 }
 if(!F.length)throw Error('audio too short');
 let mx=-1e9;E.forEach(v=>{if(v>mx)mx=v});const a=E.findIndex(v=>v>mx-35),b=E.length-1-[...E].reverse().findIndex(v=>v>mx-35);
 const sl=r=>r.slice(a,b+1),M=sl(F),mean=Array(NC).fill(0);M.forEach(f=>f.forEach((v,i)=>mean[i]+=v/M.length));
 return{mfcc:M.map(f=>f.map((v,i)=>+(v-mean[i]).toFixed(2))),E:sl(E),cen:sl(cen),zc:sl(zc),dur:(b-a+1)*H/SR};
}
async function toSamples(ab){const c=new(window.AudioContext||window.webkitAudioContext)();const buf=await c.decodeAudioData(ab);c.close();
 const o=new OfflineAudioContext(1,Math.ceil(buf.duration*SR),SR),s=o.createBufferSource();s.buffer=buf;s.connect(o.destination);s.start();return(await o.startRendering()).getChannelData(0)}
async function resample16(f32,sr){if(sr===SR)return f32;const o=new OfflineAudioContext(1,Math.ceil(f32.length*SR/sr),SR),b=o.createBuffer(1,f32.length,sr);b.copyToChannel(f32,0);const s=o.createBufferSource();s.buffer=b;s.connect(o.destination);s.start();return(await o.startRendering()).getChannelData(0)}
function wavBlob(x){const b=new ArrayBuffer(44+x.length*2),v=new DataView(b),w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
 w(0,'RIFF');v.setUint32(4,36+x.length*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,x.length*2,true);
 for(let i=0;i<x.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,x[i]))*32767,true);return new Blob([b],{type:'audio/wav'})}
function recorder(root,cb){
 root.innerHTML='<div class="row"><button class="rb">● Record</button><label class="btn">Upload audio<input type="file" accept="audio/*" hidden></label><audio controls class="hide"></audio></div><div class="meter"><div class="lvl"></div></div><div class="mut st">No audio yet</div>';
 const rb=root.querySelector('.rb'),fi=root.querySelector('input'),au=root.querySelector('audio'),st=root.querySelector('.st'),lv=root.querySelector('.lvl');
 let ctx,stream,node,chunks=[],on=false;
 const done=(x,blob)=>{try{const f=extract(x);au.src=URL.createObjectURL(blob);au.classList.remove('hide');st.textContent='✓ '+f.dur.toFixed(2)+' s of speech, '+f.mfcc.length+' frames';cb(f)}catch(e){st.textContent='Could not analyse audio: '+e.message}};
 const stop=async()=>{on=false;rb.textContent='● Record';lv.style.width='0';stream.getTracks().forEach(t=>t.stop());node.disconnect();const sr=ctx.sampleRate;ctx.close();
  const n=chunks.reduce((a,c)=>a+c.length,0),raw=new Float32Array(n);let o=0;chunks.forEach(c=>{raw.set(c,o);o+=c.length});
  if(n<sr*.3){st.textContent='Recording too short. Press Record, say the word, then press Stop.';return}
  st.textContent='Analysing…';const x=await resample16(raw,sr);done(x,wavBlob(x))};
 rb.onclick=async()=>{if(on){stop();return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){st.textContent='Recording needs a secure page: open this site at http://localhost:8000 or an https address (not an embedded preview). Upload still works.';return}
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch(e){st.textContent=e.name==='NotFoundError'?'No microphone found. Plug one in or use Upload.':'Microphone blocked ('+e.name+'). Click the lock icon in the address bar, allow Microphone, and try again.';return}
  ctx=new(window.AudioContext||window.webkitAudioContext)();await ctx.resume();chunks=[];
  const src=ctx.createMediaStreamSource(stream),mute=ctx.createGain();mute.gain.value=0;node=ctx.createScriptProcessor(4096,1,1);
  node.onaudioprocess=e=>{if(!on)return;const d=e.inputBuffer.getChannelData(0);chunks.push(new Float32Array(d));let m=0;for(let i=0;i<d.length;i+=16)m=Math.max(m,Math.abs(d[i]));lv.style.width=Math.min(100,m*140)+'%'};
  src.connect(node);node.connect(mute);mute.connect(ctx.destination);on=true;rb.textContent='■ Stop';st.textContent='Recording… speak now, then press Stop'};
 fi.onchange=async()=>{const f=fi.files[0];if(!f)return;st.textContent='Decoding…';let x;try{x=await toSamples(await f.arrayBuffer())}catch(e){st.textContent='Could not decode that file. Try WAV, MP3 or M4A.';return}done(x,f)};
 return{setStatus:t=>st.textContent=t};
}
/* ---------- charts ---------- */
function prep(c,h){const d=devicePixelRatio||1,w=c.clientWidth;c.width=w*d;c.height=h*d;c.style.height=h+'px';const x=c.getContext('2d');x.scale(d,d);x.font='11px system-ui';return{x,w,h}}
function lineChart(c,v,thr){const{x,w,h}=prep(c,150),mx=Math.max(...v,thr*1.6);x.strokeStyle=css('--ac');x.lineWidth=2;x.beginPath();
 v.forEach((y,i)=>{const px=5+i/(v.length-1||1)*(w-10),py=h-8-(y/mx)*(h-16);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
 x.strokeStyle=css('--mut');x.setLineDash([4,4]);x.lineWidth=1;const ty=h-8-(thr/mx)*(h-16);x.beginPath();x.moveTo(0,ty);x.lineTo(w,ty);x.stroke();x.fillStyle=css('--mut');x.fillText('mean',4,ty-3)}
function barChart(c,v,lab){const{x,w,h}=prep(c,150),mx=Math.max(...v,1e-6),bw=w/v.length;
 v.forEach((y,i)=>{const bh=y/mx*(h-30);x.fillStyle=css('--ac');x.fillRect(i*bw+4,h-18-bh,bw-8,bh);x.fillStyle=css('--mut');x.fillText(lab[i],i*bw+bw/2-8,h-5)})}
/* ---------- storage ---------- */
let DB={refs:{},verses:{}};
try{const s=localStorage.getItem('ssl_v1');if(s)DB=JSON.parse(s)}catch(e){}
const save=()=>{try{localStorage.setItem('ssl_v1',JSON.stringify(DB))}catch(e){}};
/* ---------- tabs ---------- */
[0,1,2].forEach(i=>$('t'+i).onclick=()=>{[0,1,2].forEach(j=>{$('p'+j).classList.toggle('hide',j!==i);$('t'+j).classList.toggle('on',j===i)})});
/* ---------- 1. pronunciation ---------- */
const WORDS=[['कृष्ण','kṛṣṇa'],['धर्म','dharma'],['योग','yoga'],['कर्म','karma'],['शान्ति','śānti'],['गीता','gītā']];
$('word').innerHTML=WORDS.map(w=>'<option value="'+w[0]+'">'+w[0]+' ('+w[1]+')</option>').join('');
let ref=null,stu=null;
const rRef=recorder($('rRef'),f=>{ref=f;DB.refs[$('word').value]=f;save();rRef.setStatus('✓ Reference saved for '+$('word').value+' ('+f.dur.toFixed(2)+' s)')});
recorder($('rStu'),f=>{stu=f});
function loadRef(){ref=DB.refs[$('word').value]||null;rRef.setStatus(ref?'✓ Saved reference loaded ('+ref.dur.toFixed(2)+' s). Record again to replace it.':'No reference recorded for this word yet')}
$('word').onchange=loadRef;loadRef();
$('strict').oninput=()=>$('sv').textContent='d₀ = '+$('strict').value;$('strict').oninput();
function dtw(A,B){const n=A.length,m=B.length,D=Array.from({length:n},()=>new Float32Array(m).fill(Infinity));
 const C=Array.from({length:n},(_,i)=>Float32Array.from({length:m},(_,j)=>{let s=0;for(let k=1;k<NC;k++){const t=A[i][k]-B[j][k];s+=t*t}return Math.sqrt(s)}));
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){let b=i||j?Infinity:0;if(i&&D[i-1][j]<b)b=D[i-1][j];if(j&&D[i][j-1]<b)b=D[i][j-1];if(i&&j&&D[i-1][j-1]<b)b=D[i-1][j-1];D[i][j]=b+C[i][j]}
 let i=n-1,j=m-1;const path=[[i,j]];
 while(i||j){let bi=i,bj=j,b=Infinity;if(i&&j&&D[i-1][j-1]<b){b=D[i-1][j-1];bi=i-1;bj=j-1}if(i&&D[i-1][j]<b){b=D[i-1][j];bi=i-1;bj=j}if(j&&D[i][j-1]<b){b=D[i][j-1];bi=i;bj=j-1}path.push([bi,bj]);i=bi;j=bj}
 return{path:path.reverse(),C}}
const avg=a=>a.reduce((p,c)=>p+c,0)/(a.length||1);
$('cmp').onclick=()=>{
 const out=$('res');out.classList.remove('hide');
 if(!ref||!stu){out.innerHTML='<div class="card">Please provide both a reference and a student recording first.</div>';return}
 const {path,C}=dtw(ref.mfcc,stu.mfcc),n=ref.mfcc.length;
 const d=avg(path.map(([i,j])=>C[i][j])),d0=+$('strict').value,sim=Math.round(100*Math.exp(-((d/d0)**2)));
 const fc=Array(n).fill(0),fn=Array(n).fill(0),cd=Array(NC).fill(0);
 path.forEach(([i,j])=>{fc[i]+=C[i][j];fn[i]++;for(let k=1;k<NC;k++)cd[k]+=Math.abs(ref.mfcc[i][k]-stu.mfcc[j][k])/path.length});
 const fcost=fc.map((v,i)=>v/fn[i]),K=Math.min(5,n),segs=[];
 for(let s=0;s<K;s++){const a=Math.floor(s*n/K),b=Math.floor((s+1)*n/K);segs.push({t0:a*H/SR,t1:b*H/SR,c:avg(fcost.slice(a,b))})}
 const ratio=stu.dur/ref.dur,cr=avg(ref.cen),cs=avg(stu.cen),cp=(cs-cr)/cr*100,zr=avg(ref.zc),zs=avg(stu.zc);
 const grp=[['low-order (c1–c2: spectral tilt, voicing)',avg(cd.slice(1,3))],['mid-order (c3–c6: vowel quality)',avg(cd.slice(3,7))],['high-order (c7–c12: consonant detail)',avg(cd.slice(7))]].sort((a,b)=>b[1]-a[1]);
 const hints=[];
 if(ratio>1.25)hints.push('Student is '+Math.round((ratio-1)*100)+'% slower: look for lengthened vowels or an inserted vowel (e.g. “krishna” for kṛṣṇa).');
 else if(ratio<.8)hints.push('Student is '+Math.round((1-ratio)*100)+'% shorter: a syllable or conjunct part may be dropped (e.g. “kisna”).');
 if(Math.abs(cp)>10)hints.push('Spectral centroid is '+Math.abs(cp).toFixed(0)+'% '+(cp>0?'higher':'lower')+': check sibilants (ṣ / ś / s) and aspiration.');
 hints.push('Largest mismatch is in '+grp[0][0]+'.');
 const worst=segs.reduce((p,c)=>c.c>p.c?c:p);
 if(worst.c>1.25*d)hints.push('Weakest region: '+worst.t0.toFixed(2)+'–'+worst.t1.toFixed(2)+' s of the reference word.');
 const col=sim>=75?'var(--ok)':sim>=50?'var(--ac)':'var(--bad)';
 out.innerHTML='<div class="card"><div class="mut">Pronunciation similarity</div><div class="big" style="color:'+col+'">'+sim+'%</div><div class="mut">DTW mean MFCC distance '+d.toFixed(2)+'</div>'+
 '<ul>'+hints.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul></div>'+
 '<div class="grid"><div class="card"><h2>Alignment cost along the word</h2><canvas id="c1"></canvas><div class="mut">Peaks show where the student deviates from the reference.</div></div>'+
 '<div class="card"><h2>MFCC difference per coefficient</h2><canvas id="c2"></canvas><div class="mut">Mean absolute difference after alignment, c1–c12.</div></div></div>'+
 '<div class="card scroll"><h2>Details</h2><table><tr><th>Measure</th><th>Reference</th><th>Student</th></tr>'+
 '<tr><td>Duration (s)</td><td>'+ref.dur.toFixed(2)+'</td><td>'+stu.dur.toFixed(2)+' ('+ratio.toFixed(2)+'×)</td></tr>'+
 '<tr><td>Mean spectral centroid (Hz)</td><td>'+cr.toFixed(0)+'</td><td>'+cs.toFixed(0)+'</td></tr>'+
 '<tr><td>Mean zero-crossing rate</td><td>'+zr.toFixed(3)+'</td><td>'+zs.toFixed(3)+'</td></tr>'+
 '<tr><td>Mean frame energy (dB)</td><td>'+avg(ref.E).toFixed(1)+'</td><td>'+avg(stu.E).toFixed(1)+'</td></tr></table>'+
 '<h2 style="margin-top:14px">Segment check</h2><table><tr><th>Segment</th><th>Time (ref)</th><th>Cost</th><th>Verdict</th></tr>'+
 segs.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+s.t0.toFixed(2)+'–'+s.t1.toFixed(2)+' s</td><td>'+s.c.toFixed(2)+'</td><td>'+(s.c>1.25*d?'<span class="tag" style="background:var(--bad)">check</span>':'<span class="tag" style="background:var(--ok)">ok</span>')+'</td></tr>').join('')+'</table></div>';
 lineChart($('c1'),fcost,d);barChart($('c2'),cd.slice(1),Array.from({length:NC-1},(_,i)=>'c'+(i+1)));
};
/* ---------- 2. HMM verse recognition ---------- */
function buildModel(seqs){
 const gm=Array(NC).fill(0),gv=Array(NC).fill(0);let tot=0;
 seqs.forEach(q=>q.forEach(x=>{tot++;for(let d=0;d<NC;d++){gm[d]+=x[d]}}));gm.forEach((_,d)=>gm[d]/=tot);
 seqs.forEach(q=>q.forEach(x=>{for(let d=0;d<NC;d++)gv[d]+=(x[d]-gm[d])**2/tot}));
 const floor=gv.map(v=>Math.max(.1*v,1e-3));
 let M=null,seg=seqs.map(q=>q.map((_,t)=>Math.min(S-1,Math.floor(t*S/q.length))));
 for(let it=0;it<7;it++){
  const m=Array.from({length:S},()=>new Float64Array(NC)),v=Array.from({length:S},()=>new Float64Array(NC)),c=new Float64Array(S),st=new Float64Array(S),to=new Float64Array(S);
  seqs.forEach((q,k)=>q.forEach((x,t)=>{const s=seg[k][t];c[s]++;for(let d=0;d<NC;d++){m[s][d]+=x[d];v[s][d]+=x[d]*x[d]}if(t<q.length-1){to[s]++;if(seg[k][t+1]===s)st[s]++}}));
  for(let s=0;s<S;s++)for(let d=0;d<NC;d++){const n=c[s]||1;m[s][d]/=n;v[s][d]=Math.max(v[s][d]/n-m[s][d]**2,floor[d])}
  M={m,v,lv:v.map(r=>Float64Array.from(r,u=>Math.log(2*Math.PI*u))),ls:Float64Array.from({length:S},(_,s)=>s===S-1?0:Math.log((st[s]+1)/(to[s]+2))),lm:Float64Array.from({length:S},(_,s)=>Math.log(1-(st[s]+1)/(to[s]+2)))};
  if(it<6)seg=seqs.map(q=>viterbi(M,q).path);
 }
 return M}
function emit(M,s,x){let l=0;const m=M.m[s],v=M.v[s],lv=M.lv[s];for(let d=0;d<NC;d++){const t=x[d]-m[d];l-=.5*(lv[d]+t*t/v[d])}return l}
function viterbi(M,q){const T=q.length,NEG=-1e18;if(T<S)return{score:-1e9,path:q.map((_,t)=>Math.min(S-1,t))};
 let prev=new Float64Array(S).fill(NEG);prev[0]=emit(M,0,q[0]);const bp=[];
 for(let t=1;t<T;t++){const cur=new Float64Array(S).fill(NEG),b=new Int8Array(S);
  for(let s=0;s<S;s++){const a=prev[s]+M.ls[s],mv=s>0?prev[s-1]+M.lm[s-1]:NEG;if(a>=mv){cur[s]=a;b[s]=s}else{cur[s]=mv;b[s]=s-1}if(cur[s]>NEG/2)cur[s]+=emit(M,s,q[t])}
  bp.push(b);prev=cur}
 if(prev[S-1]<NEG/2)return{score:-1e9,path:q.map((_,t)=>Math.min(S-1,Math.floor(t*S/T)))};
 const path=new Int8Array(T);let s=S-1;path[T-1]=s;for(let t=T-1;t>0;t--){s=bp[t-1][s];path[t-1]=s}
 return{score:prev[S-1]/T,path:Array.from(path)}}
const MODELS={};
const trainVerse=id=>{const v=DB.verses[id];if(v&&v.samples.length)MODELS[id]=buildModel(v.samples)};
const classify=(f,models)=>Object.keys(models).map(id=>({id,score:viterbi(models[id],f.mfcc).score})).sort((a,b)=>b.score-a.score);
const PRE=[['','Choose a preset or type your own…',''],['BG 9.26','Gita 9.26','patraṃ puṣpaṃ phalaṃ toyaṃ yo me bhaktyā prayacchati'],['BG 2.47','Gita 2.47','karmaṇy evādhikāras te mā phaleṣu kadācana'],['BG 18.66','Gita 18.66 (first half)','sarva-dharmān parityajya mām ekaṃ śaraṇaṃ vraja']];
$('preset').innerHTML=PRE.map((p,i)=>'<option value="'+i+'">'+p[1]+'</option>').join('');
$('preset').onchange=()=>{const p=PRE[+$('preset').value];$('vl').value=p[0];$('vt').value=p[2]};
let pend=null;
const rEn=recorder($('rEn'),f=>{pend=f});
$('addS').onclick=()=>{
 const id=$('vl').value.trim();if(!id){$('enSt').textContent='Enter a verse label first.';return}
 if(!pend){$('enSt').textContent='Record or upload a sample first.';return}
 if(pend.mfcc.length<3*S){$('enSt').textContent='Sample too short for the HMM (need at least '+3*S+' frames).';return}
 const v=DB.verses[id]||(DB.verses[id]={text:'',samples:[]});if($('vt').value)v.text=$('vt').value;
 v.samples.push(pend.mfcc);pend=null;rEn.setStatus('Sample stored. Record the next one.');
 const t0=performance.now();trainVerse(id);save();$('enSt').textContent='Trained '+id+' on '+v.samples.length+' sample(s) in '+Math.round(performance.now()-t0)+' ms.';renderV()};
function renderV(){const ids=Object.keys(DB.verses);
 $('vtab').innerHTML=ids.length?'<tr><th>Verse</th><th>Text</th><th>Samples</th><th></th></tr>'+ids.map(id=>'<tr><td>'+esc(id)+'</td><td class="mut">'+esc(DB.verses[id].text)+'</td><td>'+DB.verses[id].samples.length+'</td><td><button data-d="'+esc(id)+'">Delete</button></td></tr>').join(''):'<tr><td class="mut">No verses enrolled yet.</td></tr>';
 $('vtab').querySelectorAll('button').forEach(b=>b.onclick=()=>{delete DB.verses[b.dataset.d];delete MODELS[b.dataset.d];save();renderV()})}
Object.keys(DB.verses).forEach(trainVerse);renderV();
recorder($('rTest'),f=>{
 const out=$('rec');if(!Object.keys(MODELS).length){out.innerHTML='<div class="mut">Enroll at least one verse first.</div>';return}
 const r=classify(f,MODELS),mx=r[0].score,ex=r.map(x=>Math.exp(2*(x.score-mx))),z=ex.reduce((a,b)=>a+b,0);
 out.innerHTML='<div class="mut">Recognized verse</div><div class="big">'+esc(r[0].id)+'</div><div class="mut">'+esc(DB.verses[r[0].id].text)+'</div><table style="margin-top:8px"><tr><th>Verse</th><th>Log-lik / frame</th><th>Relative confidence</th></tr>'+
 r.map((x,i)=>'<tr><td>'+esc(x.id)+'</td><td>'+x.score.toFixed(2)+'</td><td><div class="bar" style="width:'+Math.max(2,Math.round(ex[i]/z*100))+'%"></div>'+Math.round(ex[i]/z*100)+'%</td></tr>').join('')+'</table>'});
$('loo').onclick=()=>{
 const ids=Object.keys(DB.verses);if(ids.length<2){$('looOut').textContent='Enroll at least 2 verses first.';return}
 let ok=0,tot=0;const conf={};
 ids.forEach(id=>{const sm=DB.verses[id].samples;if(sm.length<2)return;
  sm.forEach((q,k)=>{const models={};ids.forEach(o=>{if(o===id)models[o]=buildModel(sm.filter((_,i)=>i!==k));else if(MODELS[o])models[o]=MODELS[o]});
   const pred=classify({mfcc:q},models)[0].id;tot++;if(pred===id)ok++;const key=id+' → '+pred;conf[key]=(conf[key]||0)+1})});
 $('looOut').innerHTML=tot?'<div class="big">'+Math.round(100*ok/tot)+'%</div><div class="mut">'+ok+' of '+tot+' held-out samples correct</div><table style="margin-top:8px"><tr><th>True → predicted</th><th>Count</th></tr>'+Object.entries(conf).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+v+'</td></tr>').join('')+'</table>':'No verse has 2+ samples yet.'};
