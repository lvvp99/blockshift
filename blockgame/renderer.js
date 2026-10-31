import { cells } from './engine.js';

const BLOCK_FACES = [
  { indices: [0, 3, 2, 1], color: '#b8765b' },
  { indices: [4, 5, 6, 7], color: '#edb492' },
  { indices: [0, 1, 5, 4], color: '#c38768' },
  { indices: [3, 7, 6, 2], color: '#d69674' },
  { indices: [0, 4, 7, 3], color: '#bc7c5d' },
  { indices: [1, 2, 6, 5], color: '#d79b7a' },
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.observer = new ResizeObserver(() => { this.resize(); this.onResize?.(); });
    this.observer.observe(canvas);
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  configure(level) {
    this.level = level;
    this.tiles = [];
    level.map.forEach((row, z) => [...row].forEach((type, x) => {
      if (type !== '.' && type !== ' ') this.tiles.push({ x, z, type });
    }));
    this.tiles.sort((a, b) => a.x + a.z - b.x - b.z || a.x - b.x);
  }

  layout() {
    const points = this.tiles.flatMap(({x,z}) => [[x-z,(x+z)*.5],[x+1-z,(x+1+z)*.5],[x-z-1,(x+z+1)*.5],[x-z,(x+z+2)*.5]]);
    const minX = Math.min(...points.map(p => p[0]));
    const maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1])) - 1.9;
    const maxY = Math.max(...points.map(p => p[1])) + .4;
    const top = this.width < 600 ? 91 : 108;
    const bottom = this.width < 600 ? 43 : 54;
    this.scale = Math.min((this.width - (this.width < 600 ? 40 : 82)) / (maxX-minX), (this.height-top-bottom) / (maxY-minY), 47);
    this.ox = this.width / 2 - (minX+maxX)*.5*this.scale;
    this.oy = top + (this.height-top-bottom)*.5 - (minY+maxY)*.5*this.scale;
  }

  project([x, y, z]) {
    return [this.ox+(x-z)*this.scale, this.oy+((x+z)*.5-y*.96)*this.scale];
  }

  polygon(points, fill, stroke, lineWidth = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  worldPoly(points, fill, stroke, width) { this.polygon(points.map(p => this.project(p)), fill, stroke, width); }

  tile({ x, z, type }, state, now) {
    const gap = .035, x0=x+gap, x1=x+1-gap, z0=z+gap, z1=z+1-gap, depth=.27;
    const top=[[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]];
    const isBridge = type === 'B';
    if (isBridge && !(state.mask & 1)) {
      const ctx=this.ctx;
      ctx.save();ctx.setLineDash([3,4]);
      this.worldPoly(top, '#9caf7b0c', '#93a17e70', 1);
      ctx.restore();
      return;
    }
    const fragile=type==='F';
    this.worldPoly([[x0,0,z1],[x1,0,z1],[x1,-depth,z1],[x0,-depth,z1]],fragile?'#9e785a':'#3e473a','#eff1e806',.5);
    this.worldPoly([[x1,0,z0],[x1,-depth,z0],[x1,-depth,z1],[x1,0,z1]],fragile?'#b08b68':'#4d5742','#eff1e806',.5);
    const variation = ((x*17+z*7)%5)*2;
    const base=fragile?'#c5a078':isBridge?'#8a9b66':`rgb(${95+variation},${105+variation},${79+variation})`;
    this.worldPoly(top,base,'#c5cfad38',.65);
    // A small bevel catches the light along the back edge.
    this.worldPoly([[x0,0,z0],[x1,0,z0],[x1-.025,.015,z0+.025],[x0+.025,.015,z0+.025]],fragile?'#dfbd9560':'#d3dcbd48');
    if (type==='G') {
      const pulse=.7+Math.sin(now/700)*.15;
      const inset=.17;
      this.worldPoly([[x+inset,.012,z+inset],[x+1-inset,.012,z+inset],[x+1-inset,.012,z+1-inset],[x+inset,.012,z+1-inset]],'#23392b');
      const ctx=this.ctx;
      ctx.save();ctx.shadowColor='#c2ed93';ctx.shadowBlur=10;
      this.worldPoly(top,null,`rgba(201,229,157,${pulse})`,2);
      ctx.restore();
      this.worldPoly([[x+.22,-.025,z+.23],[x+.78,-.025,z+.23],[x+.78,-.025,z+.77],[x+.22,-.025,z+.77]],null,'#94b870',1);
    }
    if(type==='T') {
      const center=this.project([x+.5,.025,z+.5]);
      const ctx=this.ctx;
      ctx.beginPath();ctx.ellipse(center[0],center[1],this.scale*.29,this.scale*.145,0,0,Math.PI*2);
      ctx.fillStyle=state.mask?'#c7e09c':'#99a780';ctx.fill();
      ctx.strokeStyle='#d6e6bb';ctx.lineWidth=1;ctx.stroke();
      this.worldPoly([[x+.4,.03,z+.4],[x+.6,.03,z+.6]],null,'#485a39',1.5);
      this.worldPoly([[x+.4,.03,z+.6],[x+.6,.03,z+.4]],null,'#485a39',1.5);
    }
    if (fragile) {
      this.worldPoly([[x+.28,.02,z+.2],[x+.5,.02,z+.48],[x+.4,.02,z+.66],[x+.65,.02,z+.8]],null,'#9b745580',.8);
    }
    if(isBridge) this.worldPoly([[x+.3,.015,z+.3],[x+.7,.015,z+.7]],null,'#d3e1b8',1);
  }

  boxVertices(state) {
    const x0=state.x+.055, z0=state.z+.055;
    const x1=state.x+(state.o==='x'?2:1)-.055;
    const z1=state.z+(state.o==='z'?2:1)-.055;
    const h=state.o==='u'?1.94:.94;
    return [[x0,.035,z0],[x1,.035,z0],[x1,.035,z1],[x0,.035,z1],[x0,h,z0],[x1,h,z0],[x1,h,z1],[x0,h,z1]];
  }

  transformRoll(vertices, state, direction, progress) {
    const east=direction==='right', west=direction==='left';
    const horizontal=east||west;
    const pivot=horizontal ? (east?state.x+(state.o==='x'?2:1):state.x) : (direction==='down'?state.z+(state.o==='z'?2:1):state.z);
    const angle=progress*Math.PI/2*(east||direction==='down'?1:-1);
    const c=Math.cos(angle),s=Math.sin(angle);
    return vertices.map(([x,y,z])=>{
      const d=(horizontal?x:z)-pivot;
      const pos=d*c+y*s+pivot;
      const height=y*c-d*s;
      return horizontal?[pos,height,z]:[x,height,pos];
    });
  }

  block(state, animation, now) {
    let vertices=this.boxVertices(state);
    if(animation) {
      const p=Math.min(1,(now-animation.start)/animation.duration);
      if(animation.type==='roll') {
        const eased=p*p*(3-2*p);
        vertices=this.transformRoll(vertices,state,animation.direction,eased);
      } else {
        vertices=vertices.map(([x,y,z])=>[x,y-p*p*5,z]);
        this.ctx.globalAlpha=1-p*p;
      }
    }
    const center = cells(state).reduce((a,[x,z])=>[a[0]+x+.5,a[1]+z+.5],[0,0]).map(v=>v/cells(state).length);
    const shadow = this.project([center[0],-.01,center[1]]);
    const ctx=this.ctx;
    ctx.save();ctx.fillStyle='#18281725';ctx.filter='blur(6px)';ctx.beginPath();
    ctx.ellipse(shadow[0],shadow[1]+3,this.scale*(state.o==='u'?.7:1.1),this.scale*.3,0,0,Math.PI*2);ctx.fill();ctx.restore();
    const visible=BLOCK_FACES.map(face=>{
      const points=[...face.indices].reverse().map(i=>vertices[i]);
      const a=points[0],b=points[1],c=points[2];
      const ab=b.map((n,i)=>n-a[i]),ac=c.map((n,i)=>n-a[i]);
      const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      return {...face,points,normal};
    }).filter(face=>face.normal[0]+face.normal[1]*2.08+face.normal[2]>0);
    for(const face of visible) {
      const length=Math.hypot(...face.normal);
      const normal=face.normal.map(value=>value/length);
      const light=Math.max(0,Math.min(1,normal[1]*.95+normal[2]*.5+normal[0]*.15));
      const color=`rgb(${Math.round(192+light*44)},${Math.round(129+light*48)},${Math.round(96+light*46)})`;
      this.worldPoly(face.points,color,'#9c634e',.8);
      const points=face.points;
      const center=points.reduce((a,p)=>a.map((v,i)=>v+p[i]/4),[0,0,0]);
      const inset=points.map(p=>p.map((v,i)=>center[i]+(v-center[i])*.8));
      this.worldPoly(inset,null,'#f6d0ac50',.7);
    }
    ctx.globalAlpha=1;
  }

  draw(state, animation, now=performance.now()) {
    if(!this.tiles || !this.width) return;
    const ctx=this.ctx;
    ctx.clearRect(0,0,this.width,this.height);
    this.layout();
    // The board floats above a quiet, soft shadow.
    ctx.save();
    ctx.translate(this.width/2,this.oy+this.scale*3.8);
    ctx.scale(1,.35);
    const gradient=ctx.createRadialGradient(0,0,5,0,0,this.scale*6);
    gradient.addColorStop(0,'#34422b18');gradient.addColorStop(.65,'#34422b0c');gradient.addColorStop(1,'#34422b00');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,this.scale*6,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const tile of this.tiles) this.tile(tile,state,now);
    this.block(state,animation,now);
  }
}
