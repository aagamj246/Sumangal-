const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const ROOT = __dirname;
const PRODUCTS_FILE = path.join(ROOT, 'products.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_TTL = 8 * 60 * 60 * 1000;
const sessions = new Map();
const failedLogins = new Map();
const categories = {
  'Necklaces':'necklaces', 'Bangles':'bangles', 'Chain':'chains',
  'Earrings':'earrings', 'Rings':'rings', 'Diamond':'diamonds'
};

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error('Set ADMIN_PASSWORD to a password of at least 12 characters before starting the server.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Cache-Control','no-store');
  next();
});

function readProducts() {
  const data = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  if (!Array.isArray(data)) throw new Error('products.json must contain an array');
  return data.map((p,i)=>({...p, id:p.id || `legacy-${i+1}`}));
}
function writeProducts(products) {
  const temp = PRODUCTS_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(products, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, PRODUCTS_FILE);
}
function sessionAuth(req,res,next) {
  const token = req.cookiesToken || (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('sg_admin='))?.slice('sg_admin='.length);
  const session = token && sessions.get(token);
  if (!session || session.expires < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({error:'Please log in again.'});
  }
  session.expires = Date.now() + SESSION_TTL;
  next();
}
function safeEqual(a,b) {
  const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
app.post('/api/login',(req,res)=>{
  const ip=req.ip || 'local'; const record=failedLogins.get(ip) || {count:0,until:0};
  if (record.until>Date.now()) return res.status(429).json({error:'Too many attempts. Wait 10 minutes and try again.'});
  if (!safeEqual(req.body?.password || '', ADMIN_PASSWORD)) {
    record.count++; if(record.count>=5){record.count=0;record.until=Date.now()+10*60*1000;} failedLogins.set(ip,record);
    return res.status(401).json({error:'Incorrect password.'});
  }
  failedLogins.delete(ip);
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,{expires:Date.now()+SESSION_TTL});
  res.setHeader('Set-Cookie',`sg_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL/1000}`);
  res.json({ok:true});
});
app.post('/api/logout',sessionAuth,(req,res)=>{
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sg_admin='))?.slice('sg_admin='.length);
  if(token) sessions.delete(token);
  res.setHeader('Set-Cookie','sg_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ok:true});
});
app.get('/api/products',sessionAuth,(req,res)=>res.json(readProducts()));
app.post('/api/products',sessionAuth,(req,res)=>{
  const p=validateProduct(req.body); if(p.error) return res.status(400).json({error:p.error});
  const products=readProducts(); const product={...p.value,id:crypto.randomUUID()};
  products.unshift(product); writeProducts(products); res.status(201).json(product);
});
app.put('/api/products/:id',sessionAuth,(req,res)=>{
  const p=validateProduct(req.body); if(p.error) return res.status(400).json({error:p.error});
  const products=readProducts(); const i=products.findIndex(x=>x.id===req.params.id);
  if(i<0) return res.status(404).json({error:'Product not found.'});
  products[i]={...p.value,id:products[i].id}; writeProducts(products); res.json(products[i]);
});
app.delete('/api/products/:id',sessionAuth,(req,res)=>{
  const products=readProducts(); const next=products.filter(x=>x.id!==req.params.id);
  if(next.length===products.length) return res.status(404).json({error:'Product not found.'});
  writeProducts(next); res.json({ok:true});
});
function validateProduct(body) {
  const name=String(body?.name||'').trim(); const category=String(body?.category||'');
  const subcategory=String(body?.subcategory||'').trim(); const price=String(body?.price||'Enquire for price').trim();
  const image=String(body?.image||'').trim();
  if(!name) return {error:'Enter a product name.'};
  if(!categories[category]) return {error:'Choose a valid category.'};
  if(!image) return {error:'Upload or enter a product image path.'};
  if(image.startsWith('/') || image.includes('..') || image.startsWith('\\')) return {error:'Invalid image path.'};
  if(!/^https:\/\//i.test(image) && !/^image\/[a-z0-9_./-]+$/i.test(image)) return {error:'Use an image in the image folder or a secure https image URL.'};
  return {value:{name,category,subcategory,price,image}};
}
const allowedMime={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const storage=multer.diskStorage({
  destination:(req,file,cb)=>{ const cat=categories[req.body.category]; if(!cat) return cb(new Error('Select a valid category before uploading.')); const dest=path.join(ROOT,'image',cat); fs.mkdirSync(dest,{recursive:true}); cb(null,dest); },
  filename:(req,file,cb)=>{ const ext=allowedMime[file.mimetype]; const base=path.basename(file.originalname,path.extname(file.originalname)).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,45)||'jewellery'; cb(null,`${base}-${Date.now()}.${ext}`); }
});
const upload=multer({storage,limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>allowedMime[file.mimetype]?cb(null,true):cb(new Error('Upload JPG, PNG, WEBP or GIF images only.'))});
app.post('/api/upload',sessionAuth,(req,res)=>upload.single('image')(req,res,err=>{
  if(err) return res.status(400).json({error:err.message});
  if(!req.file) return res.status(400).json({error:'Choose an image to upload.'});
  res.json({path:`image/${categories[req.body.category]}/${req.file.filename}`});
}));
app.use(express.static(ROOT,{index:'index.html'}));
app.listen(PORT,'127.0.0.1',()=>console.log(`Sumangal Gold is running at http://127.0.0.1:${PORT}\nAdmin panel: http://127.0.0.1:${PORT}/admin.html`));
