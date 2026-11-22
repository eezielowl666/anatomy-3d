// 由 Z-Anatomy 原始 FBX 轉成網站用的 GLB（簡化網格、量化、meshopt 壓縮）。
// 用法（在 tools/ 內）：
//   node convert.mjs source/Muscular.fbx ../muscles.glb muscle 0.55 buff   # 肌肉（含體型調整）
//   node convert.mjs source/Skeletal.fbx ../bones.glb   bone   0.6         # 骨骼
// 體型由下方 BLOBS（高斯放大場，單位 cm，左側座標、自動鏡像）控制：[cx,cy,cz, sx,sy,sz, 振幅]
import fs from 'fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS:()=>({style:{}, addEventListener(){}, getContext(){return null}}), createElement:()=>({style:{}}) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
const { MeshoptSimplifier, MeshoptEncoder } = await import('meshoptimizer');
const { Document, NodeIO } = await import('@gltf-transform/core');
const { EXTMeshoptCompression, KHRMeshQuantization } = await import('@gltf-transform/extensions');
const { quantize, meshopt, prune, dedup } = await import('@gltf-transform/functions');
THREE.TextureLoader.prototype.load = function(){ return new THREE.Texture(); };
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;

const [,, inFile, outFile, kind, ratioS, deformS] = process.argv;
const DEFORM = deformS==='buff';
let bvh=null;
if(DEFORM){
  const { MeshBVH } = await import('three-mesh-bvh');
  const sb = fs.readFileSync(new URL('./source/Skeletal.fbx', import.meta.url));
  const sk = new FBXLoader().parse(sb.buffer.slice(sb.byteOffset, sb.byteOffset+sb.byteLength), '');
  sk.updateMatrixWorld(true);
  const parts=[];
  sk.traverse(o=>{ if(!o.isMesh) return; const n=o.name; if(/[ji]$/.test(n)) return;
    const b=n.replace(/[lr]$/,''); if(/(o|e)\d*$/.test(b) && !/(bone|cartilage|Clavicle|canine|Hip_bone)$/i.test(b)) return;
    let g=o.geometry.clone(); for(const k of Object.keys(g.attributes)) if(k!=='position') g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld); if(g.index) g=g.toNonIndexed(); parts.push(g.attributes.position.array); });
  const tot=parts.reduce((a,p)=>a+p.length,0), all=new Float32Array(tot); let off=0; for(const p of parts){all.set(p,off); off+=p.length;}
  const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(all,3));
  bvh=new MeshBVH(bg); console.log('bone BVH tris', tot/9);
}
// hypertrophy field (cm, left side; mirrored)
const BLOBS=[
 [20,136,-3, 6.5,6.5,7.5, .50],  // deltoid (rounded, broad)
 [14,130,-8, 6,6,5, .55],        // upper back width (infraspinatus / teres)
 [13,119,-6, 5.5,10,6, 1.6],     // lats flare -> V taper
 [20,122,-3, 5,9,6, .28],        // upper arm (lean)
 [25,102,-1, 5,8,5, .12],        // forearm
 [10,130,7, 8,6,5, .45],         // chest (flat, wide)
 [7,146,-6, 6,6,6, .12],         // upper traps (low)
 [6,132,-10, 7,8,5, .20],        // mid traps
 [9,84,-7, 7,7,6, .05],          // glutes
 [10,62,1, 7,14,8, .14],         // thigh (long, lean)
 [7,33,-4, 5,8,5, .10],          // calf
 [0,152,-1, 5,5,6, .08],         // neck
 [0,101,2, 12,7,12, -.20],       // waist (narrow)
 [0,88,-1, 13,5,12, -.08],       // hips (narrow)
];
function sField(x,y,z){ x=Math.abs(x); let s=1;
  for(const [cx,cy,cz,sx,sy,sz,a] of BLOBS){ const dx=(x-cx)/sx, dy=(y-cy)/sy, dz=(z-cz)/sz; s+=a*Math.exp(-.5*(dx*dx+dy*dy+dz*dz)); }
  return Math.min(2.4,Math.max(.8,s)); }
const RATIO = +ratioS;
const buf = fs.readFileSync(inFile);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength), '');
obj.updateMatrixWorld(true);

const EXCL_M = /bursa|sheath|(?<!Tensor_)fascia|Fascia_lata|septum|Cross_Section|retinacul|Iliopectineal_arch|transverse_metacarpal|transverse_metatarsal|Common_tendinous_ring|Trochlea_of/i;
const TENDON = /tendon|Iliotibial_tract|Linea_alba|Inguinal_ligament|aponeurosis|Tendinous_arch/i;
function classify(name){
  const side = /l$/.test(name)?'l':(/r$/.test(name)?'r':'');
  const base = side? name.slice(0,-1): name;
  if(kind==='muscle'){
    if(EXCL_M.test(name)) return null;
    return {base, side, cat: TENDON.test(base)?'tendon':'muscle'};
  } else {
    if(/[ji]$/.test(name)) return null;
    if(/(o|e)\d*$/.test(base) && !/(bone|Clavicle|canine|Hip_bone|Mandible)$/i.test(base)) return null;
    if(/cartilage/i.test(base) || base==='Take_a_picture') return null;
    return {base, side, cat:'bone'};
  }
}
const doc = new Document(); const root = doc.getRoot();
const bufferDef = doc.createBuffer(); const scene = doc.createScene('s');
let inT=0,outT=0,count=0; const names=[];
obj.traverse(o=>{
  if(!o.isMesh) return;
  const c = classify(o.name); if(!c) return;
  let g = o.geometry.clone();
  for(const k of Object.keys(g.attributes)) if(k!=='position') g.deleteAttribute(k);
  g.clearGroups();
  g.applyMatrix4(o.matrixWorld);
  if(o.matrixWorld.determinant()<0){ // flip winding
    if(!g.index){ const n=g.attributes.position.count; const idx=[...Array(n).keys()]; g.setIndex(idx);} 
    const a=g.index.array; for(let i=0;i<a.length;i+=3){const t=a[i+1]; a[i+1]=a[i+2]; a[i+2]=t;}
  }
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position.array, idx = new Uint32Array(g.index.array);
  inT += idx.length/3;
  if(idx.length < 9) return;
  const target = Math.max(36, Math.floor(idx.length*RATIO/3)*3);
  let [sidx] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, []);
  if(sidx.length<3) sidx = idx;
  // compact
  const remap=new Map(); const np=[]; const ni=new Uint32Array(sidx.length);
  for(let i=0;i<sidx.length;i++){ let v=sidx[i]; let r=remap.get(v); if(r===undefined){r=remap.size; remap.set(v,r); np.push(pos[v*3],pos[v*3+1],pos[v*3+2]);} ni[i]=r; }
  if(DEFORM){
    const nv=np.length/3, d=new Float32Array(nv*3), P=new THREE.Vector3(), hit={point:new THREE.Vector3()};
    for(let v=0;v<nv;v++){ P.set(np[v*3],np[v*3+1],np[v*3+2]); const r=bvh.closestPointToPoint(P,hit,0,40);
      const k=sField(P.x,P.y,P.z)-1; if(!r) continue; const q=hit.point;
      d[v*3]=(P.x-q.x)*k; d[v*3+1]=(P.y-q.y)*k; d[v*3+2]=(P.z-q.z)*k; }
    // laplacian smoothing of the displacement field
    const nb=Array.from({length:nv},()=>new Set());
    for(let i=0;i<ni.length;i+=3){const a=ni[i],b=ni[i+1],c=ni[i+2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);}
    let cur=d; for(let it=0;it<6;it++){ const nx=new Float32Array(nv*3);
      for(let v=0;v<nv;v++){ let sx=cur[v*3],sy=cur[v*3+1],sz=cur[v*3+2],n=1; for(const u of nb[v]){sx+=cur[u*3];sy+=cur[u*3+1];sz+=cur[u*3+2];n++;}
        nx[v*3]=sx/n; nx[v*3+1]=sy/n; nx[v*3+2]=sz/n; } cur=nx; }
    for(let i=0;i<np.length;i++) np[i]+=cur[i];
  }
  outT += ni.length/3; count++;
  const pa = doc.createAccessor().setType('VEC3').setArray(new Float32Array(np)).setBuffer(bufferDef);
  const ia = doc.createAccessor().setType('SCALAR').setArray(remap.size<65535? new Uint16Array(ni): ni).setBuffer(bufferDef);
  const prim = doc.createPrimitive().setAttribute('POSITION',pa).setIndices(ia);
  const mesh = doc.createMesh(o.name).addPrimitive(prim);
  const node = doc.createNode(o.name).setMesh(mesh).setExtras({b:c.base, s:c.side, c:c.cat});
  scene.addChild(node);
  names.push(c.base);
});
await doc.transform(dedup(), prune(), quantize({quantizePosition:14}), meshopt({encoder:MeshoptEncoder, level:'high'}));
doc.createExtension(KHRMeshQuantization).setRequired(true);
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({'meshopt.encoder':MeshoptEncoder});
await io.write(outFile, doc);
fs.writeFileSync(outFile+'.names.json', JSON.stringify([...new Set(names)].sort()));
console.log(kind, 'meshes', count, 'tris', Math.round(inT), '->', Math.round(outT), 'size', (fs.statSync(outFile).size/1e6).toFixed(2)+'MB');
