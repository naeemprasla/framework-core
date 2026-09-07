import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";

const roots=["src","test","scripts"];
const missing=[];
async function walk(dir){
  for(const ent of await readdir(dir,{withFileTypes:true})){
    const p=resolve(dir,ent.name);
    if(ent.isDirectory()) await walk(p);
    else if(ent.isFile() && extname(p)===".js" || ent.isFile() && extname(p)===".mjs") await check(p);
  }
}
async function exists(p){ try{ return (await stat(p)).isFile(); } catch { return false; } }
async function check(file){
  const src=await readFile(file,"utf8");
  const patterns=[...src.matchAll(/(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']*?\s+from\s+|import\()(["'])(\.[^"']+)\1/g)];
  for(const m of patterns){
    const spec=m[2]; let target=resolve(dirname(file),spec);
    if(await exists(target)) continue;
    if(!extname(target) && await exists(`${target}.js`)) continue;
    if(!extname(target) && await exists(resolve(target,"index.js"))) continue;
    missing.push({file,spec});
  }
}
for(const root of roots) await walk(resolve(process.cwd(),root));
if(missing.length){ console.error(JSON.stringify(missing,null,2)); process.exit(1); }
console.log("relative_import_integrity: PASS");
