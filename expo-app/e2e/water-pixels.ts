import {expect,type Page} from '@playwright/test';
import {PNG} from 'pngjs';
/** Accept only the exact composited PNG whose water and mask pixels were checked. */
export async function waterScreenshot(page:Page,full:boolean,zero=false):Promise<Buffer>{
 expect(await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>canvas.getContext('webgl2')?.getContextAttributes()?.preserveDrawingBuffer)).toBe(true);
 let capture:Buffer=Buffer.alloc(0);
 let previous:Buffer=Buffer.alloc(0), stableFrames=0;
 await expect.poll(async()=>{
  const label=full?await page.getByText('01 WATER',{exact:true}).boundingBox():null;
  capture=await page.screenshot({animations:'disabled'});const image=PNG.sync.read(capture);
  const blueAt=(x:number,y:number)=>{const i=(y*image.width+x)*4;return image.data[i]===57&&image.data[i+1]===142&&image.data[i+2]===255;};
  if(!blueAt(Math.floor(image.width/2),zero?image.height-3:Math.floor(image.height*(full?.58:.93))))return 'water or label bounds absent';
  if(full){
   if(!label)return 'water or label bounds absent';let labelBlue=0,dark=0,holes=0;
   for(let y=Math.floor(label.y);y<label.y+Math.min(label.height,14);y++)for(let x=Math.floor(label.x);x<label.x+label.width;x++)if(blueAt(x,y))labelBlue++;
   for(let y=Math.floor(image.height*.28);y<image.height*.5;y++)for(let x=24;x<Math.min(140,image.width*.4);x++){const i=(y*image.width+x)*4;if(image.data[i]===12&&image.data[i+1]===12&&image.data[i+2]===12)dark++;if(blueAt(x,y))holes++;}
   if(labelBlue<=100)return 'WATER label covered by stale surface';if(dark<=500||holes<=500)return 'submerged glyph mask absent';
  }
  stableFrames=capture.equals(previous)?stableFrames+1:1;previous=capture;
  return stableFrames>=3?'ready':'waiting for three identical painted frames';
 },{message:'Actual PNG must contain blue water, readable WATER label, and dark submerged8 strokes with blue holes'}).toBe('ready');
 return capture;
}







