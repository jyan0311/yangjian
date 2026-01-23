# 🚀 GitHub Pages 部署完整指南

## 📌 前置准备

### 1. 确认你已经有：
- ✅ GitHub 账号（如果没有，去 https://github.com 注册）
- ✅ Git 已安装（打开终端输入 `git --version` 检查）
- ✅ Node.js 已安装（已确认 ✓）

---

## 🎯 第一步：本地测试

在终端中运行以下命令，确保网站能正常运行：

```bash
# 进入项目目录
cd /Users/yangjian/Documents/GitHub/个人主页

# 启动开发服务器
npm run dev
```

打开浏览器访问 `http://localhost:4321`，你应该能看到你的 Usagi 主题网站！

按 `Ctrl + C` 停止服务器。

---

## 🎯 第二步：创建 GitHub 仓库

### 方法 A：通过 GitHub 网站创建（推荐新手）

1. **登录 GitHub**
   - 访问 https://github.com
   - 使用你的账号登录

2. **创建新仓库**
   - 点击右上角的 `+` 号
   - 选择 **"New repository"**

3. **填写仓库信息**
   - **Repository name（仓库名）**: 输入 `personal-website` 或 `个人主页`
     > ⚠️ 注意：如果你想用中文名，后面需要修改配置
   - **Description（描述）**: 输入 `My Usagi-themed digital garden`
   - **Public/Private**: 选择 **Public（公开）**
     > ⚠️ GitHub Pages 免费版只支持公开仓库
   - ❌ **不要勾选** "Add a README file"
   - ❌ **不要勾选** "Add .gitignore"
   - ❌ **不要勾选** "Choose a license"

4. **点击绿色按钮 "Create repository"**

5. **记下你的仓库地址**
   - 你会看到类似这样的地址：
     ```
     https://github.com/yangjian/personal-website.git
     ```
   - 或者如果用中文名：
     ```
     https://github.com/yangjian/个人主页.git
     ```

---

## 🎯 第三步：修改配置文件（重要！）

根据你刚才创建的仓库名，我们需要修改 `astro.config.mjs` 文件。

### 如果你的仓库名是 `personal-website`：

```javascript
export default defineConfig({
  site: 'https://yangjian.github.io',
  base: '/personal-website',
  integrations: [tailwind()],
});
```

### 如果你的仓库名是 `个人主页`：

```javascript
export default defineConfig({
  site: 'https://yangjian.github.io',
  base: '/个人主页',
  integrations: [tailwind()],
});
```

> 💡 **重要提示**：`base` 的值必须和你的仓库名完全一致！

---

## 🎯 第四步：初始化 Git 并推送代码

打开终端，**一条一条**运行以下命令：

### 1. 初始化 Git 仓库

```bash
cd /Users/yangjian/Documents/GitHub/个人主页
git init
```

你会看到：`Initialized empty Git repository...`

### 2. 添加所有文件

```bash
git add .
```

> 这个命令会把所有文件添加到 Git 的"暂存区"

### 3. 创建第一个提交

```bash
git commit -m "🎉 Initial commit: Usagi digital garden"
```

你会看到类似这样的输出：
```
[main (root-commit) abc1234] 🎉 Initial commit: Usagi digital garden
 10 files changed, 500 insertions(+)
```

### 4. 连接到 GitHub 仓库

**把下面的地址替换成你自己的仓库地址！**

```bash
# 如果你的仓库名是 personal-website
git remote add origin https://github.com/yangjian/personal-website.git

# 或者如果是中文名
git remote add origin https://github.com/yangjian/个人主页.git
```

### 5. 推送到 GitHub

```bash
git branch -M main
git push -u origin main
```

> 如果第一次使用 Git，可能会要求你输入 GitHub 用户名和密码。
> 
> ⚠️ **注意**：GitHub 现在不支持密码登录，你需要使用 **Personal Access Token（个人访问令牌）**
> 
> 创建 Token：
> 1. 访问 https://github.com/settings/tokens
> 2. 点击 "Generate new token" → "Generate new token (classic)"
> 3. 选择 `repo` 权限
> 4. 复制生成的 token（它只显示一次！）
> 5. 在终端粘贴这个 token 作为密码

---

## 🎯 第五步：配置 GitHub Pages

1. **访问你的仓库**
   - 打开 `https://github.com/yangjian/你的仓库名`

2. **进入 Settings**
   - 点击仓库顶部的 **"Settings"** 标签

3. **找到 Pages 设置**
   - 在左侧菜单找到 **"Pages"**
   - 点击进入

4. **配置部署源**
   - 在 **"Build and deployment"** 部分
   - **Source**: 选择 **"GitHub Actions"**
   
5. **保存**
   - 设置会自动保存

---

## 🎯 第六步：等待部署完成

1. **查看部署状态**
   - 回到仓库主页
   - 点击顶部的 **"Actions"** 标签
   - 你会看到一个正在运行的工作流（带有黄色圆圈 🟡）

2. **等待完成**
   - 通常需要 1-3 分钟
   - 当圆圈变成绿色的勾 ✅，就说明部署成功了！

3. **访问你的网站**
   - 网站地址是：
     ```
     https://yangjian.github.io/你的仓库名/
     ```
   - 例如：
     - `https://yangjian.github.io/personal-website/`
     - 或 `https://yangjian.github.io/个人主页/`

---

## 🎨 第七步：以后如何更新网站

当你修改了代码，想更新网站时：

```bash
# 1. 查看修改了哪些文件
git status

# 2. 添加所有修改
git add .

# 3. 提交修改
git commit -m "✨ 更新了首页内容"

# 4. 推送到 GitHub
git push
```

推送后，GitHub Actions 会自动重新部署！大约 1-3 分钟后，你的修改就会生效。

---

## ❓ 常见问题

### Q1: 访问网站显示 404 错误

**原因**：`astro.config.mjs` 中的 `base` 配置不正确

**解决**：
1. 检查 `base: '/仓库名'` 是否和 GitHub 仓库名完全一致
2. 修改后重新提交：
   ```bash
   git add astro.config.mjs
   git commit -m "🔧 修复 base 配置"
   git push
   ```

### Q2: 样式/图片无法加载

**原因**：同样是 `base` 配置问题

**解决**：确保所有链接都使用相对路径，Astro 会自动处理

### Q3: GitHub Actions 部署失败

**原因**：可能是 Node.js 版本或依赖问题

**解决**：
1. 查看 Actions 标签页的错误日志
2. 确保 `package.json` 中的依赖都能正常安装

### Q4: 推送代码时要求输入密码

**原因**：GitHub 不再支持密码认证

**解决**：使用 Personal Access Token（见第四步第5小节）

---

## 📝 快速命令备忘录

```bash
# 本地开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览生产版本

# Git 操作
git status           # 查看状态
git add .            # 添加所有修改
git commit -m "消息" # 提交修改
git push             # 推送到 GitHub
git log              # 查看提交历史
```

---

## 🎉 完成！

恭喜你！你的 Usagi 主题个人网站已经成功部署到 GitHub Pages 了！

现在你可以：
- 分享你的网站链接给朋友
- 继续添加更多页面和内容
- 每次修改后推送到 GitHub 自动更新

祝你享受你的数字花园！🐰✨

---

**需要帮助？**
- GitHub Pages 文档：https://docs.github.com/pages
- Astro 文档：https://docs.astro.build
