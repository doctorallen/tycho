// buildings_sorting_bench.js: times three ways to depth-sort N isometric boxes, for the buildings note.
// Run with `node buildings_sorting_bench.js`. (a) a key sort on the base x+y, (b) every pair tested for screen overlap,
// then a depth-first topological sort, (c) the same with overlap found through a 32 px screen grid.
function rng(a){return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function make(n, seed){const r=rng(seed);const S=Math.ceil(Math.sqrt(n)*3);const b=[];for(let i=0;i<n;i++){const w=1+(r()*3|0),d=1+(r()*3|0),h=r()*4;const x=r()*S,y=r()*S;b.push({x0:x,x1:x+w,y0:y,y1:y+d,z0:0,z1:h});}
 for(const o of b){o.sx0=(o.x0-o.y1)*8;o.sx1=(o.x1-o.y0)*8;o.sy0=(o.x0+o.y0)*4-o.z1*6;o.sy1=(o.x1+o.y1)*4-o.z0*6;}return b;}
const overlap=(a,b)=>a.sx0<b.sx1&&b.sx0<a.sx1&&a.sy0<b.sy1&&b.sy0<a.sy1;
const behind=(a,b)=>{ // a must be drawn before b
 if(a.x1<=b.x0)return true; if(b.x1<=a.x0)return false; if(a.y1<=b.y0)return true; if(b.y1<=a.y0)return false; return a.z0<b.z0;};
function topo(b, pairs){const n=b.length,adj=b.map(()=>[]);for(const[i,j]of pairs){if(behind(b[i],b[j]))adj[j].push(i);else adj[i].push(j);}
 const st=new Uint8Array(n),out=[];const visit=i=>{if(st[i])return;st[i]=1;for(const j of adj[i])visit(j);out.push(i);};for(let i=0;i<n;i++)visit(i);return out;}
function pairsAll(b){const p=[];for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++)if(overlap(b[i],b[j]))p.push([i,j]);return p;}
function pairsGrid(b){const C=32,m=new Map(),p=[],seen=new Set();b.forEach((o,i)=>{for(let gx=Math.floor(o.sx0/C);gx<=Math.floor(o.sx1/C);gx++)for(let gy=Math.floor(o.sy0/C);gy<=Math.floor(o.sy1/C);gy++){const k=gx*65536+gy;let l=m.get(k);if(!l)m.set(k,l=[]);for(const j of l){const key=j*100000+i;if(!seen.has(key)&&overlap(b[i],b[j])){seen.add(key);p.push([j,i]);}}l.push(i);}});return p;}
for(const n of [50,200,1000]){const b=make(n,7);const T=(f,reps)=>{const t=process.hrtime.bigint();for(let k=0;k<reps;k++)f();return Number(process.hrtime.bigint()-t)/1e6/reps;};
 const reps=n>500?20:200;
 const tk=T(()=>b.slice().sort((p,q)=>(p.x0+p.y0)-(q.x0+q.y0)),reps);
 const ta=T(()=>topo(b,pairsAll(b)),reps);
 const tg=T(()=>topo(b,pairsGrid(b)),reps);
 console.log(`n=${n}: key sort ${tk.toFixed(3)} ms, pairwise+topo ${ta.toFixed(3)} ms, grid+topo ${tg.toFixed(3)} ms, pairs ${pairsAll(b).length}`);}
