require('dotenv').config();
const path = require('path');
const fs = require('fs');
const serve = require('koa-static');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const prisma = require('./config/database');
const router = require('./routes');

const app = new Koa();
const PORT = process.env.PORT || 3000;

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || (error.code === 'P2002' ? 409 : error.code === 'P2003' ? 400 : 500);
    const message = error.code === 'P2002'
      ? 'NIM/NIP atau email sudah terdaftar'
      : error.code === 'P2003' ? 'Kamar yang dipilih tidak ditemukan' : error.message;
    ctx.body = { error: ctx.status < 500 ? message : 'Terjadi kesalahan pada server' };
    if (ctx.status === 500) console.error(error);
  }
});

app.use(bodyParser({ jsonLimit: '5mb' }));
app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (ctx, next) => {
  if (!ctx.path.startsWith('/uploads/')) return next();
  const uploadRoot = path.resolve(__dirname, '../uploads');
  const requestedPath = path.resolve(uploadRoot, ctx.path.slice('/uploads/'.length));
  if (!requestedPath.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(requestedPath)) {
    ctx.throw(404, 'Berkas tidak ditemukan');
  }
  ctx.type = path.extname(requestedPath);
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.body = fs.createReadStream(requestedPath);
});
// Frontend React harus di-build sebelum server dijalankan.
const reactDist = path.join(__dirname, '../frontend/dist');
const reactIndex = path.join(reactDist, 'index.html');
if (!fs.existsSync(reactIndex)) {
  throw new Error('React frontend build not found. Run "npm run build" before starting the server.');
}
app.use(serve(reactDist));
app.use(async (ctx, next) => {
  await next();
  if (ctx.status === 404 && ctx.method === 'GET' && !ctx.path.startsWith('/api')) {
    ctx.type = 'html';
    ctx.body = fs.createReadStream(reactIndex);
  }
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Berhasil konek ke database MySQL');
  } catch (err) {
    console.error('❌ Gagal konek ke database:', err.message);
  }
}

testConnection();

require('./jobs/autoAlpa').startAutoAlpa();

app.listen(PORT, () => {
  console.log(`🚀 Server Koa berjalan di http://localhost:${PORT}`);
});