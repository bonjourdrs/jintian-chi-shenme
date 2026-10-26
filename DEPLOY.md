# 部署说明

线上演示：<https://jintian-chi-shenme.deed.page/>

源码仓库：<https://github.com/shitoudaidi/jintian-chi-shenme>

本仓库是 Vite + React 静态站，`vite.config.ts` 已设 `base: './'`，路由为 HashRouter，适合 GitHub Pages / Surge / 任意静态托管。当前版本见 `src/lib/version.ts`（`APP_VERSION`）。

## 本地构建

```bash
npm install
npm run build    # 产物在 dist/
npm run preview  # 本地预览
```

## 方案 A：Surge（最快，无需先建 GitHub 仓）

```bash
npm run build
npx --yes surge ./dist today-eat-what.surge.sh
# 若域名被占用，换一个：
npx --yes surge ./dist today-eat-what-<你的后缀>.surge.sh
```

首次会提示注册/登录 Surge。成功后终端会打印 `https://….surge.sh`。

也可用 npm script：

```bash
npm run deploy:surge
```

## 方案 B：GitHub Pages（Actions）

1. 在 GitHub 新建空仓库（建议名 `today-eat-what`），不要勾选自动加 README。
2. 本地推送：

```bash
cd /path/to/今天吃什么
git init   # 若尚未 init
git add .
git commit -m "今天吃什么：一期+二期"
git branch -M main
git remote add origin git@github.com:<你的用户名>/today-eat-what.git
git push -u origin main
```

3. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
4. 推送 `main` 后，工作流 `.github/workflows/pages.yml` 会构建并发布。
5. 几分钟后打开：`https://<你的用户名>.github.io/today-eat-what/`

> 私有仓的 GitHub Pages 需要付费计划；免费请用 **public** 仓，或继续用 Surge。

## 方案 C：任意静态托管

上传 `dist/` 目录即可（Netlify / Cloudflare Pages / 对象存储静态网站）。入口是 `dist/index.html`。

## 注意

- 不要把 Cursor Origin 草稿仓当正式远程。
- 两人同步依赖本机 PeerJS / 粘贴同步包，与静态托管无关。
- 盒马仍是公开搜索链接，不是加购 API。

## 本机试过的情况（二期 B）

- `npm run build` 已通过，`dist/` 可直接上传。
- Surge：需要交互登录/注册（`surge.sh` 账号），当前环境没有 `SURGE_TOKEN`，无法无人值守发布。
- Cloudflare quick tunnel：能申请到 `*.trycloudflare.com` 地址，但本沙箱出网连不上 Cloudflare edge（530 / QUIC·7844 受限），不能当稳定公网站。
- GitHub：`gh` 未登录，且 Cursor 不能代你建仓；推送与开启 Pages 需你在本机完成（见上方方案 B）。

有 Surge 账号时：

```bash
npx --yes surge login
npm run deploy:surge
```
