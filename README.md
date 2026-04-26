# MSX RiskLens Guided Investing Hub

## 1) 项目定位（给评委看的项目上下文）

这是一个面向 **Web2 用户友好 onboarding + 可解释财富发现 + 纸上交易教学 + 轻量链上勋章交互** 的 React/Vite demo。  
项目目标不是交易引擎本身，而是验证一个产品问题：  
如何在 MSX/Tokenized 生态中先“看懂产品再交易”，让用户从低复杂度产品（储蓄/稳定收益）过渡到更高风险资产。

与“是否可跑起来”相比，评审更关心三件事：

1. 是否有清楚的新人路径（Learn → Paper → Suitability → Live）。  
2. 是否把不同产品暴露为可比较、可解释的结构（不是只给价格和收益）。  
3. 是否能在本地可复现：钱包连接、页面状态、合约交互都有可执行步骤。

---

## 2) 项目结构与入口

- `/index.html` + `src/main.jsx` + `src/App.jsx`  
  欢迎页/主体验路径（`welcome` 与引导入口）

- `/wealth.html` + `src/wealth.jsx` + `src/WealthApp.jsx`  
  财富页（产品货架、双列布局、时间线动作、风险/适合度信息）

- `/paper-trading.html` + `src/paperTrading.jsx` + `src/PaperTradingApp.jsx`  
  纸面交易页（模拟账户、历史窗口、对冲与仓位、回放成绩）

- `/chart-hover-demo.html` + `src/chartHoverDemo.jsx`  
  图表交互 demo（单独功能页面）

- `app.js`  
  旧版静态脚本数据模型（当前用于对照和部分场景说明，不是主要运行入口）

- `dist/`  
  你可以在本机执行 build 后直接用于部署预览的产物

`vite.config.js` 中把首页、wealth、paper-trading、chart demo 都配置为多页面入口；  
默认 dev server 为 `127.0.0.1:4173`，便于 MetaMask 在本地连接。

---

## 3) 环境要求

- Node.js 建议 20+
- npm（Windows 下建议用 `C:\Program Files\nodejs\npm.cmd`）
- Chrome + MetaMask（钱包相关流程）
- Sepolia 测试网（如需部署/验证链上合约）

---

## 4) 快速启动（建议按此顺序）

1) 安装依赖

```powershell
cd "D:\NYU\web3\msx-risklens-demo"
npm install
```

2) 准备环境变量  
先复制模板文件：

```powershell
copy .env.example .env
copy .env.example .env.local
```

3) 启动服务（推荐）

```powershell
.\start-local.ps1
```

或手动：

```powershell
"C:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1 --port 4173
```

4) 打开页面（本地）

- 首页：`http://127.0.0.1:4173/`
- 财富页：`http://127.0.0.1:4173/wealth.html`
- 纸面交易页：`http://127.0.0.1:4173/paper-trading.html`
- 图表示例：`http://127.0.0.1:4173/chart-hover-demo.html`

> 不要直接 `file://` 打开 HTML。MetaMask 连接与动态交互可能失败。

---

## 5) 配置说明（核心环境变量）

### 5.1 前端公共变量（放 `.env.local`）

- `VITE_BADGE_CONTRACT_ADDRESS`
- `VITE_REPLAY_BADGE_CONTRACT_ADDRESS`
- `VITE_WEALTH_VAULT_ADDRESS`
- `VITE_TWELVE_DATA_API_KEY`（如接入外部市场数据）
- `VITE_PROFILE_STORAGE_ENDPOINT`（本地/远程 profile 网关）
- `VITE_REPLAY_DEVELOPER_MODE`（`true/false`）

### 5.2 部署变量（放 `.env`）

- `SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `UNIFIED_DEMO_BASE_URI` / `REPLAY_BADGE_BASE_URI`
- `WEALTH_VAULT_*`（用于 Vault 初始化与更新脚本）
- `PROFILE_STORAGE_PORT/DIR/CORS_ORIGIN`
- `PINATA_JWT` / `PINATA_PIN_JSON_URL`（可选）

**注意**  
- `WEALTH_VAULT_*` 这类部署变量是本地部署流程变量，不应直接放到前端可见配置里。  
- 项目中 `deploy-badge.ps1` 会检查 `.env`，`npm run dev` 主要使用 `.env.local`（Vite 前端变量）。

---

## 6) 常用脚本（`package.json`）

- `npm run dev`：启动 Vite 本地开发
- `npm run build`：构建多页面静态站点
- `npm run preview`：预览构建产物
- `npm run deploy:badge`
- `npm run deploy:wealth-vault`
- `npm run deploy:replay-badges`
- `npm run deploy:unified-hub`
- `npm run update:wealth-vault`
- `npm run profile-storage:dev`（本地 profile 网关）
- `npm run refresh:wealth-data`（拉取/刷新本地财富数据）

---

## 7) Sepolia 快速流程（可选）

### 方式 A（建议，单地址演示）

```powershell
npm run deploy:unified-hub
```

脚本会输出一个 Hub 地址。将输出结果填到以下变量（可同值）：

- `VITE_BADGE_CONTRACT_ADDRESS`
- `VITE_REPLAY_BADGE_CONTRACT_ADDRESS`
- `VITE_WEALTH_VAULT_ADDRESS`
- `WEALTH_VAULT_ADDRESS`

重启前端后即接入同一套合约地址，适合演示与打分展示。

### 方式 B（按模块分开部署）

- `npm run deploy:badge` 仅部署欢迎页徽章
- `npm run deploy:wealth-vault` 部署 Vault（独立）
- `npm run deploy:replay-badges` 部署论文/成绩类徽章（如使用）
- `npm run update:wealth-vault` 按环境变量更新Vault状态

部署后在前端页面执行以下动作验证：

- 钱包连接到 Sepolia  
- 完成 badge claim（如果页面有触发入口）  
- 在 Wealth 页面查看产品卡与状态是否回显  
- 在 Paper 页面进行至少一次模拟/回放闭环

---

## 8) 5 分钟评审验收清单（建议给评委）

1. 打开首页，确认能看到：
   - 引导路径（新手/专业）
   - 任务/quest、产品卡、风险与收益解释

2. 连接 MetaMask（本地推荐）：
   - 扩展登录后，地址与链上网络状态能被读取
   - 页面切换后状态保持

3. 进入 `wealth.html` 验证：
   - 能浏览不同产品槽（RWA / xStocks / Watchlist 等）
   - 能触发 timeline/仓位/质押或结算类动作

4. 进入 `paper-trading.html` 验证：
   - 能创建/展示模拟账户状态
   - 能执行回放/交易与收益更新
   - 关键计算对新手路径有可读解释

5. 链上变量验证：
   - 若配置了部署地址，页面可读到相应合约地址/交互文案
   - 对应环境变量更新后页面行为一致

---

## 9) 常见问题（Troubleshooting）

- 浏览器提示无法连接钱包：优先用 `http://127.0.0.1:4173`（非 `file://`）
- `pm install` 后启动失败：确认 Node 版本 >= 20，清理缓存后重装 `node_modules`
- 合约地址不生效：确认写入的是 `.env.local`（前端）还是 `.env`（部署脚本）对应位置
- 端口占用：改端口启动（`--port`）或清理 4173 进程

---

## 10) 部署到 GitHub Pages（示例）

```powershell
"C:\Program Files\nodejs\npm.cmd" run build
```

将 `dist/` 内容作为静态站点资源发布（如 GitHub Pages）。  
项目为单页外加多页面入口，发布站点需确认页面入口都可直接访问。

---

## 11) 免责声明

本文档中的数据展示与演示参数用于教学演示，  
不构成投资建议，也不是任何真实钱包资产的交易承诺。
