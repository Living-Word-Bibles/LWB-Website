import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(root,'index.html'))) throw new Error('index.html is missing from the repository root.');
if (!fs.existsSync(path.join(root,'404.html'))) throw new Error('404.html is missing from the repository root.');

const ignoredDirs = new Set(['.git','.github','node_modules','apps-script','scripts']);
const files=[];
(function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.isDirectory() && ignoredDirs.has(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p); else files.push(p);
  }
})(root);

const htmlFiles=files.filter(f=>f.endsWith('.html') && !f.includes(`${path.sep}assets${path.sep}includes${path.sep}`));
const htmlByRoute=new Map();
const idsByRoute=new Map();

function fileToRoute(file){
  const rel=path.relative(root,file).split(path.sep).join('/');
  if(rel==='index.html')return '/';
  if(rel==='404.html')return '/404.html';
  if(rel.endsWith('/index.html'))return '/'+rel.slice(0,-'/index.html'.length)+'/';
  return '/'+rel;
}
for(const file of htmlFiles){
  const route=fileToRoute(file);
  const html=fs.readFileSync(file,'utf8');
  htmlByRoute.set(route,html);
  const ids=new Set();
  for(const m of html.matchAll(/\bid=["']([^"']+)["']/gi))ids.add(m[1]);
  idsByRoute.set(route,ids);
}

const errors=[];
const warnings=[];
let checked=0;
function add(kind,file,url,message){(kind==='error'?errors:warnings).push({file:path.relative(root,file).split(path.sep).join('/'),url,message});}
function isExternal(url){return /^(?:https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(url);}
function stripQueryHash(url){return url.split('#')[0].split('?')[0];}
function routeForTarget(baseFile,url){
  const bare=stripQueryHash(url);
  if(!bare)return fileToRoute(baseFile);
  if(bare.startsWith('/')){
    if(path.extname(bare))return bare;
    return bare.endsWith('/')?bare:bare+'/';
  }
  const baseDir=path.posix.dirname(fileToRoute(baseFile));
  const resolved=path.posix.normalize(path.posix.join(baseDir,bare));
  if(path.extname(resolved))return resolved.startsWith('/')?resolved:'/'+resolved;
  const r=resolved.startsWith('/')?resolved:'/'+resolved;
  return r.endsWith('/')?r:r+'/';
}
function fsTarget(baseFile,url){
  const bare=decodeURI(stripQueryHash(url));
  if(bare.startsWith('/'))return path.join(root,bare.replace(/^\//,''));
  return path.resolve(path.dirname(baseFile),bare);
}
function targetExists(baseFile,url){
  const p=fsTarget(baseFile,url);
  if(fs.existsSync(p))return true;
  if(fs.existsSync(path.join(p,'index.html')))return true;
  return false;
}

for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  for(const tagMatch of html.matchAll(/<(a|link|script|img|iframe|source)\b[^>]*>/gi)){
    const tag=tagMatch[1].toLowerCase();
    const raw=tagMatch[0];
    const attrName=['a','link'].includes(tag)?'href':(tag==='source'?'srcset':'src');
    const attr=raw.match(new RegExp(`${attrName}=["']([^"']+)["']`,'i'));
    if(!attr)continue;
    const urls=tag==='source'?attr[1].split(',').map(x=>x.trim().split(/\s+/)[0]):[attr[1]];
    for(const original of urls){
      const url=original.trim();
      if(!url||url.includes('${')||isExternal(url))continue;
      checked++;
      const isAsset=url.startsWith('/assets/')||/\.(?:css|js|png|jpe?g|webp|svg|gif|ico|pdf|epub|rtf|woff2?|json|xml)$/i.test(stripQueryHash(url));
      if(!targetExists(file,url)){
        const fallback=tag==='img'&&raw.match(/data-fallback=["']([^"']+)["']/i);
        if(fallback&&targetExists(file,fallback[1])) add('warning',file,url,`Missing image uses working fallback ${fallback[1]}`);
        else add('error',file,url,isAsset?'Missing local asset':'Missing internal route');
        continue;
      }
      const hashIndex=url.indexOf('#');
      if(hashIndex>=0&&tag==='a'){
        const fragment=decodeURIComponent(url.slice(hashIndex+1));
        if(fragment){
          const dynamicReaderHash=/^(?:\/|ref=|net=|gnv=|bsb=|bbe=|oeb=|[A-Za-z0-9._% -]+\.\d+\.\d+)/i.test(fragment);
          if(!dynamicReaderHash){
            const route=routeForTarget(file,url);
            const ids=idsByRoute.get(route);
            if(!ids||!ids.has(fragment))add('error',file,url,`Missing anchor id="${fragment}" on ${route}`);
          }
        }
      }
    }
  }
}

const required=[
  '/index.html','/404.html','/CNAME','/sitemap.xml','/site-map/index.html',
  '/assets/css/site.css','/assets/js/config.js','/assets/js/site.js','/assets/js/products.js','/assets/js/reader.js','/assets/js/order-complete.js',
  '/assets/includes/lwb-header.html','/assets/includes/lwb-footer.html',
  '/assets/LivingWordBibles01.png','/assets/lwbbanner.webp','/assets/lw-ios-badge-light.svg','/assets/lw-ios-badge-dark.svg',
  '/assets/homeasset01.webp','/assets/homeasset02.webp','/assets/homeasset03.webp','/assets/barnes-noble-01-logo-png-transparent.webp',
  '/assets/products/kjvspecial.epub','/assets/products/drb.epub','/assets/kjv.pdf','/assets/asv.pdf','/assets/ylt.pdf','/assets/web.pdf','/assets/kjvembedcode.rtf'
];
for(const item of required){
  if(!fs.existsSync(path.join(root,item.replace(/^\//,''))))errors.push({file:'(required files)',url:item,message:'Required static file missing'});
}

for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  if(html.includes('<div data-lwb-header></div>') && !html.includes('/assets/js/site.js')) {
    errors.push({file:path.relative(root,file),url:'/assets/js/site.js',message:'Shared header placeholder exists without site.js loader'});
  }
  if(html.includes('<div data-lwb-footer></div>') && !html.includes('/assets/js/site.js')) {
    errors.push({file:path.relative(root,file),url:'/assets/js/site.js',message:'Shared footer placeholder exists without site.js loader'});
  }
}

function format(items){
  if(!items.length)return 'None.';
  return items.map(x=>`- \`${x.file}\` → \`${x.url}\` — ${x.message}`).join('\n');
}
const report=`# Route, Asset, and Anchor Validation Report\n\n- Architecture: **checked-in static pages; no generated dist directory**\n- HTML files scanned: **${htmlFiles.length}**\n- Internal references checked: **${checked}**\n- Errors: **${errors.length}**\n- Warnings: **${warnings.length}**\n\n## Errors\n\n${format(errors)}\n\n## Warnings\n\n${format(warnings)}\n\n## Result\n\n${errors.length?'**FAILED** — deployment must not proceed.':'**PASSED** — all internal routes, required assets, and anchor fragments resolved.'}\n\nExternal services such as PayPal, Google Apps Script, Firebase, Biblia, Bible API, Free Use Bible API, and Bible SuperSearch require post-deployment network testing.\n`;
fs.writeFileSync(path.join(root,'LINK-VALIDATION-REPORT.md'),report);
fs.writeFileSync(path.join(root,'MISSING-ASSETS.md'),`# Missing Assets\n\n${errors.filter(x=>x.message.includes('asset')||x.message.includes('file')).length?format(errors.filter(x=>x.message.includes('asset')||x.message.includes('file'))):'None.'}\n`);
console.log(report);
if(errors.length)process.exitCode=1;
