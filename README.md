# 生产排产系统 (Production Scheduling System)

Cornell New Materials 生产排产与产能可视化平台。

## 技术栈

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS**
- **SheetJS (xlsx)** — Excel 导入/导出
- **jsPDF + html2canvas** — PDF 导出
- **localStorage** — 纯前端数据持久化(无需后端)
- 部署平台: **Vercel**

## 功能清单

### 产线管理
- 录入产线编号(如 `1#`、`2#`、`超声波复合`、`热熔胶复合`)
- 配置工作日、班次(支持多班次,如两班制)
- 配置预维护窗口(按星期+时段)

### 订单管理
- 录入订单:订单编号、关联产线、产品型号、计划开工/完工时间(精确到分钟)、批量数量(kg)、状态、备注
- 批量导入 Excel(下载模板 → 填写 → 导入)
- 导出全量订单为 Excel
- 批量选择订单,统一提前/延后 N 小时

### 排产看板
- 甘特图可视化(日 / 周 / 月 三种视图)
- X 轴为时间,Y 轴为全部注册产线
- 每个任务块显示:订单号、产品型号、数量、状态
- **拖拽任务块**直接调整时间(吸附到 15 分钟),自动校验冲突
- **实时状态灯**(该产线最晚完工距当前的天数):
  - 🟢 绿色:>7 天(排产充足)
  - 🟡 黄色:2-7 天(排产适中)
  - 🔴 红色:<2 天(排产紧张)
- 校验规则:
  - 与其他订单时间重叠 → 提示冲突订单号
  - 超出产线日历(工作日/班次) → 提示运营时段
  - 与维护窗口冲突 → 拒绝保存
- 未开工订单支持一键取消(释放产能)
- **导出看板为 PDF**(A3 横向)

## 本地开发

```bash
npm install
npm run dev
# 访问 http://localhost:3000
```

## 部署到 Vercel

### 1. 推送代码到 GitHub

```bash
cd production-scheduling
git init
git add .
git commit -m "feat: 初始化生产排产系统"
git branch -M main
git remote add origin https://github.com/<你的用户名>/production-scheduling.git
git push -u origin main
```

### 2. 在 Vercel 导入项目

1. 打开 <https://vercel.com/new>
2. 选择刚推送的 `production-scheduling` 仓库 → **Import**
3. Framework Preset 自动识别为 **Next.js**,保持默认 → **Deploy**
4. 等待构建完成,Vercel 会分配一个默认域名 `xxx.vercel.app`

### 3. 绑定二级子域名 `scheduling.cornellnonwoven.com`

#### 3.1 在 Vercel 添加域名

1. 进入项目 → **Settings** → **Domains**
2. 输入 `scheduling.cornellnonwoven.com` → **Add**
3. Vercel 会提示需要在 DNS 提供商处添加一条 **CNAME 记录**

#### 3.2 在 `cornellnonwoven.com` 的 DNS 管理处添加记录

| 类型  | 主机/名称       | 值(Target)         | TTL   |
|-------|------------------|----------------------|-------|
| CNAME | `scheduling`     | `cname.vercel-dns.com` | 自动/600 |

> 如果你的 DNS 服务商不支持根域的 CNAME,无需担心 —— 这里是二级子域名,所有主流 DNS 都支持。
> 阿里云/腾讯云/Cloudflare/GoDaddy 全部在 **解析记录** 面板点"添加记录"即可。

#### 3.3 等待 DNS 生效

- 通常 5-30 分钟
- 生效后 Vercel Domains 页会显示 ✅ **Valid Configuration** 并自动签发 HTTPS 证书
- 访问 <https://scheduling.cornellnonwoven.com> 即可

### 4. 后续更新

推送到 `main` 分支后 Vercel 会自动重新构建部署,秒级生效。

```bash
git add .
git commit -m "feat: xxx"
git push
```

## 数据说明

**所有数据存储在浏览器的 localStorage 中**,无后端数据库。这意味着:

- ✅ 零后端成本,Vercel 免费额度即可
- ✅ 响应速度极快
- ✅ 隐私性好,数据不上云
- ⚠️ 数据与浏览器绑定,换浏览器/清缓存会丢失
- ⚠️ 不支持多人协作同步

如后续需要多人协同,可接入云数据库(如 Vercel Postgres / Supabase),届时只需替换 `lib/storage.ts` 的实现即可,上层组件无需改动。

## 目录结构

```
production-scheduling/
├── app/
│   ├── globals.css         # 全局样式
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 主页面(看板/订单/产线 三合一)
├── components/
│   ├── GanttChart.tsx      # 甘特图(核心可视化,支持拖拽)
│   ├── OrderDialog.tsx     # 订单新增/编辑对话框
│   └── LineDialog.tsx      # 产线新增/编辑对话框
├── lib/
│   ├── utils.ts            # 工具函数(时间/冲突检测/状态灯)
│   ├── storage.ts          # localStorage 数据访问层
│   ├── excel.ts            # Excel 导入/导出
│   └── pdf.ts              # PDF 导出(html2canvas + jsPDF)
├── types/
│   └── index.ts            # TypeScript 类型定义
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── postcss.config.js
```

## 默认种子数据

首次加载时会自动初始化 4 条产线:`1#`、`2#`、`超声波复合`、`热熔胶复合`。
如需重置,可在浏览器 DevTools → Application → Local Storage → 清除 `ps_lines_v1` 和 `ps_orders_v1`。
