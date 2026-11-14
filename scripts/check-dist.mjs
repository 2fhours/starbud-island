import fs from 'node:fs';

const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const rooted = /(?:src|href)=["']\/assets\//.test(html);
const hasPagesAsset = html.includes('/starbud-island/assets/');
if (rooted || !hasPagesAsset) {
  console.error(html);
  throw new Error('dist/index.html 的资源必须挂在 /starbud-island/ 下，不能写成站点根路径 /assets/。');
}
if (!fs.existsSync(new URL('../dist/.nojekyll', import.meta.url))) {
  throw new Error('dist 缺少 .nojekyll');
}
console.log('dist 相对路径检查通过');
