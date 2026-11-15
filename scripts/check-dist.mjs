import fs from 'node:fs';

for (const name of ['index.html', 'iso.html', 'view3d.html']) {
  const html = fs.readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
  const rooted = /(?:src|href)=["']\/assets\//.test(html);
  const hasPagesAsset = html.includes('/starbud-island/assets/');
  if (rooted || !hasPagesAsset) {
    console.error(html);
    throw new Error(`${name} 的资源必须挂在 /starbud-island/ 下，不能写成站点根路径 /assets/。`);
  }
}
const indexHtml = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const indexJs = indexHtml.match(/\/assets\/([^"]+\.js)/)?.[1];
if (!indexJs) throw new Error('找不到主脚本');
const main = fs.readFileSync(new URL(`../dist/assets/${indexJs}`, import.meta.url), 'utf8');
if (main.includes('WebGLRenderer')) throw new Error('2D 首屏不应该打包 3D 渲染器');
if (!fs.existsSync(new URL('../dist/.nojekyll', import.meta.url))) {
  throw new Error('dist 缺少 .nojekyll');
}
const portraits = ['lujiao', 'yanwei', 'luzhu', 'dianrong', 'yanke', 'fengling', 'taibei', 'xiwen', 'player', 'grandma', 'qinghe', 'lanchuan'];
for (const id of portraits) {
  const file = new URL(`../dist/portraits/${id}.jpg`, import.meta.url);
  if (!fs.existsSync(file)) throw new Error(`dist 缺少立绘 portraits/${id}.jpg`);
}
if (!main.includes('/starbud-island/') || !main.includes('portraits/')) {
  throw new Error('主脚本没有把立绘挂在 /starbud-island/portraits/ 下');
}
console.log('dist 相对路径检查通过');
