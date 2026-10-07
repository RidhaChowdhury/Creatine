import {expect,type Page} from '@playwright/test';
import {PNG} from 'pngjs';
/** Accept only the exact composited PNG whose water and mask pixels were checked. */
export async function waterScreenshot(page:Page,full:boolean,zero=false):Promise<Buffer>{
 expect(await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>canvas.getContext('webgl2')?.getContextAttributes()?.preserveDrawingBuffer)).toBe(true);
 let capture:Buffer=Buffer.alloc(0);
 let previous:Buffer=Buffer.alloc(0), stableFrames=0;
 await expect.poll(async()=>{
  // The dock has its own layout space. Probe the rendered water surface, never the dock.
  const surface=await page.locator('canvas').boundingBox();
  const navigation=await page.getByRole('navigation',{name:'Main navigation',exact:true}).boundingBox();
  if(!surface || !navigation)return 'water surface or navigation is absent';
  if(surface.y+surface.height>navigation.y+1)return `water surface ends at ${surface.y+surface.height}, below navigation at ${navigation.y}`;
  const label=full?await page.getByText('01 WATER',{exact:true}).boundingBox():null;
  capture=await page.screenshot({animations:'disabled'});const image=PNG.sync.read(capture);
  const blueAt=(x:number,y:number)=>{const i=(y*image.width+x)*4;return image.data[i]===57&&image.data[i+1]===142&&image.data[i+2]===255;};
  // Partial water shares vertical space with the inset Performance panel; sample
  // the exposed water beside it, rather than treating that opaque panel as water.
  const probeX=surface.x+(!full&&!zero?12:surface.width/2);
  if(!blueAt(Math.floor(probeX),Math.floor(surface.y+(zero?surface.height-3:surface.height*(full?.58:.93)))))return 'water or label bounds absent';
  if(full){
   if(!label)return 'water or label bounds absent';let labelBlue=0,dark=0,holes=0;
   for(let y=Math.floor(label.y);y<label.y+Math.min(label.height,14);y++)for(let x=Math.floor(label.x);x<label.x+label.width;x++)if(blueAt(x,y))labelBlue++;
   for(let y=Math.floor(surface.y+surface.height*.28);y<surface.y+surface.height*.5;y++)for(let x=Math.floor(surface.x+24);x<Math.min(surface.x+140,surface.x+surface.width*.4);x++){const i=(y*image.width+x)*4;if(image.data[i]===12&&image.data[i+1]===12&&image.data[i+2]===12)dark++;if(blueAt(x,y))holes++;}
   if(labelBlue<=100)return 'WATER label covered by stale surface';if(dark<=500||holes<=500)return 'submerged glyph mask absent';
  }
  stableFrames=capture.equals(previous)?stableFrames+1:1;previous=capture;
  return stableFrames>=3?'ready':'waiting for three identical painted frames';
 },{message:'Actual PNG must contain blue water, readable WATER label, and dark submerged8 strokes with blue holes'}).toBe('ready');
 return capture;
}







