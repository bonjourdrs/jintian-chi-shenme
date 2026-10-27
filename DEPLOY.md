# 部署

## 公网发布

当前发布为公开静态站点，完整产物来自 `npm run build` 的 `dist/`。网站公开只代表任何人可加载应用；个人记录仍在各自浏览器保存，详见 [PRIVACY.md](PRIVACY.md)。不把本地 `.local/rooms.json`、个人备份、诊断记录和开发用房间 API 作为公网数据服务部署。

当前公网入口：https://shitoudaidi.github.io/jintian-chi-shenme/

当前主入口由 GitHub Pages 托管，main 推送会自动检查、构建并部署。此前的 Sites 地址保留为独立发布，部分外部浏览器可能无法连接，不再作为主入口。

## GitHub Pages

`.github/workflows/pages.yml` 在 main 推送或手动触发时安装、检查、测试并构建发布。仓库 Settings → Pages 需启用 GitHub Actions 才能生效。普通推送成功不等于 Pages 已发布；必须检查实际工作流和线上地址。

HashRouter 使用 `/#/...`，Vite 资源相对路径支持项目子目录。上传完整 dist，包含本次构建生成的 sw.js。保持 HTML 和 sw.js 可以重新验证缓存，不能只替换 HTML。

## 本地预览

```sh
npm ci
npm test
npm run lint
npm run build
npm run preview
```

默认 http://127.0.0.1:4321/ 。同一 Wi-Fi 手机可使用 `npm run preview:host`，电脑保持开机。局域网 HTTP 不支持完整 Service Worker 离线安装；公网 HTTPS 才支持该能力。

开发服务的房间 API 提供单进程磁盘 CAS，供本机开发验证。其房间号就是访问凭据，不具备账号级授权、成员审批或公网滥用防护；需要正式云同步时先补充这些能力与持久存储，而非直接暴露开发服务。

## 发布验收

1. 两个独立浏览器上下文：甲的收藏、菜单、采购项和账本不出现在乙；乙改动不影响甲。
2. 未配对时不上传个人记录；普通分享链接和二维码不包含状态或房间凭据。
3. 微信入口的浏览器指引正确，复制链接可保留当前食材；外部 App 搜索/加购未实现的边界明确。
4. HTTPS 首次加载安装离线包，断网刷新首页、账本和采购正常；升级按构建版本切换。
5. GitHub 源码提交与公网发布分别保留状态，不把本地构建成功误报为推送或部署成功。
