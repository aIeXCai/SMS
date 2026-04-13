# SMS 学校管理系统 - 部署指南

欢迎使用 SMS 学校管理系统！本指南将一步步教您如何在其他计算机上部署这个系统。即使您没有技术经验，按照本指南操作也能顺利完成部署。

---

## 目录

1. [系统要求](#系统要求)
2. [安装必需软件](#安装必需软件)
3. [部署项目](#部署项目)
4. [启动服务](#启动服务)
5. [访问系统](#访问系统)
6. [停止服务](#停止服务)
7. [常见问题](#常见问题)

---

## 系统要求

本系统支持以下操作系统：
- Windows 10 或更高版本
- macOS 10.15 (Catalina) 或更高版本
- Ubuntu 18.04 或更高版本

**必需软件：**
- Python 3.12 或更高版本
- Node.js 18 或更高版本
- Redis（用于处理异步任务）

---

## 安装必需软件

### Windows 系统

#### 1. 安装 Python

1. 访问 Python 官网：https://www.python.org/downloads/
2. 下载最新的 Python 3.12 或更高版本的安装包
3. 双击安装包运行
4. **重要**：安装时勾选 "Add Python to PATH" 选项
5. 点击 "Install Now" 完成安装

**验证安装：**
打开命令提示符（Win+R，输入 `cmd`，回车），输入：
```
python --version
```
如果看到类似 `Python 3.12.x` 的输出，说明安装成功。

---

#### 2. 安装 Node.js

1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 LTS（长期支持）版本的安装包
3. 双击安装包运行，按照提示完成安装

**验证安装：**
打开命令提示符，输入：
```
node --version
npm --version
```
如果看到版本号，说明安装成功。

---

#### 3. 安装 Redis

**方法一：使用 Chocolatey（推荐，如果您已安装）**

1. 打开管理员权限的命令提示符
2. 输入以下命令：
```
choco install redis-64
```

**方法二：手动安装**

1. 访问 Redis Windows 版本下载：https://github.com/microsoftarchive/redis/releases
2. 下载最新的 `.msi` 安装包
3. 双击安装包运行

**方法三：Docker 方式（适用于 Windows Server 2022，推荐生产环境使用）**

Windows Server 2022 支持 Docker，这是生产环境最推荐的方案。

**步骤 1：安装 Docker Desktop 或启用容器功能**

如果您还没有安装 Docker，请参考：
- [Windows Server 容器官方文档](https://learn.microsoft.com/zh-us/virtualization/windowscontainers/quick-start/quick-start-windows-server)

**步骤 2：启动 Redis 容器**

打开管理员权限的 PowerShell 或命令提示符，执行：

```powershell
docker run -d -p 6379:6379 --name redis-server redis:latest
```

参数说明：
| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `-p 6379:6379` | 端口映射（主机:容器） |
| `--name redis-server` | 容器名称 |
| `redis:latest` | 使用最新版本 Redis 镜像 |

**步骤 3：验证 Redis 是否运行**

```powershell
docker ps
```

看到 `redis-server` 在运行中即为成功。

**步骤 4：测试连接**

```powershell
redis-cli ping
```

如果返回 `PONG`，说明 Redis 正常工作。

**常用 Docker Redis 命令：**

| 操作 | 命令 |
|------|------|
| 启动 | `docker start redis-server` |
| 停止 | `docker stop redis-server` |
| 重启 | `docker restart redis-server` |
| 查看日志 | `docker logs redis-server` |
| 删除容器 | `docker rm -f redis-server` |
| 开机自启 | `docker update --restart unless-stopped redis-server` |

**设置开机自启（推荐）：**

```powershell
docker update --restart unless-stopped redis-server
```

这样服务器重启后 Redis 会自动启动。

**启动 Redis（手动安装方式）：**
在命令提示符中输入：
```
redis-server
```

---

### macOS 系统

#### 1. 安装 Homebrew（如果还没有）

打开终端（Command + Space，输入"终端"），输入：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，按提示操作。

---

#### 2. 安装 Python

在终端输入：
```bash
brew install python@3.12
```

**验证安装：**
```bash
python3 --version
```

---

#### 3. 安装 Node.js

在终端输入：
```bash
brew install node
```

**验证安装：**
```bash
node --version
npm --version
```

---

#### 4. 安装 Redis

在终端输入：
```bash
brew install redis
```

**启动 Redis：**
```bash
brew services start redis
```

**停止 Redis：**
```bash
brew services stop redis
```

---

### Linux (Ubuntu/Debian) 系统

#### 1. 安装 Python

在终端输入：
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**验证安装：**
```bash
python3 --version
```

---

#### 2. 安装 Node.js

在终端输入：
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**验证安装：**
```bash
node --version
npm --version
```

---

#### 3. 安装 Redis

在终端输入：
```bash
sudo apt update
sudo apt install redis-server
```

**启动 Redis：**
```bash
sudo systemctl start redis
sudo systemctl enable redis
```

---

## 部署项目

### 步骤 1：获取项目代码

**如果您有 Git：**
```bash
git clone <仓库地址>
cd SMS
```

**如果没有 Git：**
1. 下载项目的压缩包（ZIP 文件）
2. 解压到您喜欢的位置
3. 打开命令行工具，进入解压后的文件夹：
   - Windows: `cd 文件夹路径`
   - macOS/Linux: `cd 文件夹路径`

---

### 步骤 2：安装 Python 依赖

在项目根目录下（包含 `manage.py` 文件的文件夹），打开命令行工具，输入：

**Windows:**
```
pip install -r requirements.txt
```

**macOS/Linux:**
```bash
pip3 install -r requirements.txt
```

这将安装以下依赖：
- Django（Web 框架）
- djangorestframework（API 框架）
- django-rq（异步任务处理）
- redis（Redis 客户端）
- openpyxl（Excel 文件处理）
- 等其他依赖

---

### 步骤 3：安装前端依赖

进入前端目录：
```bash
cd frontend
```

安装依赖：
```bash
npm install
```

等待安装完成后，返回项目根目录：
```bash
cd ..
```

---

### 步骤 4：启动 Redis 服务

**在启动系统之前，必须先启动 Redis！**

**Windows:**
在命令提示符中输入：
```
redis-server
```
保持这个窗口打开，不要关闭。

**macOS:**
在终端输入：
```bash
brew services start redis
```

**Linux:**
在终端输入：
```bash
sudo systemctl start redis
```

**验证 Redis 是否运行：**

**Windows:**
打开新的命令提示符，输入：
```
redis-cli ping
```
如果返回 `PONG`，说明 Redis 正在运行。

**macOS/Linux:**
在终端输入：
```bash
redis-cli ping
```

---

### 步骤 5：数据库迁移

系统使用 SQLite 数据库（默认），首次运行需要初始化数据库。

在项目根目录下，打开命令行工具，输入：

```bash
python manage.py migrate
```

或者（macOS/Linux）：
```bash
python3 manage.py migrate
```

您会看到一系列输出，显示数据库表的创建过程。成功完成后，会显示 "OK"。

---

### 步骤 6：创建管理员账号

创建一个可以登录系统的管理员账号。

在命令行工具中输入：
```bash
python manage.py createsuperuser
```

按照提示输入信息：
- Username（用户名）：例如 `admin`
- Email（邮箱）：例如 `admin@example.com`
- Password（密码）：输入两次，不会显示字符

---

## 启动服务

### 方式一：Windows 使用一键启动脚本（推荐）

如果您使用 Windows，项目提供了一个一键启动脚本 `start_sms.bat`。

双击 `start_sms.bat` 文件，或在命令提示符中进入项目根目录，输入：
```
start_sms.bat
```

脚本会自动完成以下操作：
1. 检查并启动 Redis
2. 安装/验证 Python 依赖
3. 执行数据库迁移
4. 在新窗口启动前端服务
5. 在新窗口启动异步任务处理器（RQ Worker）
6. 启动 Django 后端服务

---

### 方式二：macOS 使用一键启动脚本（推荐）

如果您使用 macOS，项目提供了一个一键启动脚本 `start_sms.sh`。

在终端中，进入项目根目录，输入：
```bash
bash start_sms.sh
```

脚本会自动完成以下操作：
1. 检查并启动 Redis
2. 激活 conda 环境
3. 执行数据库迁移
4. 在新终端窗口启动前端服务
5. 在后台启动异步任务处理器
6. 启动 Django 后端服务

---

### 方式三：手动启动（通用）

如果您使用 Windows 或 Linux，或者想手动控制启动过程：

**打开 3 个命令行窗口（或标签页）**

#### 终端 1：启动 Django 后端

```bash
python manage.py runserver 0.0.0.0:8000
```

成功后会显示：
```
Starting development server at http://0.0.0.0:8000/
```

#### 终端 2：启动 Next.js 前端

首先进入前端目录：
```bash
cd frontend
```

然后启动开发服务器：
```bash
npm run dev
```

成功后会显示：
```
ready - started server on 0.0.0.0:3000
```

#### 终端 3：启动 RQ Worker（可选）

用于处理异步任务（如成绩排名计算）：

```bash
python manage.py rqworker default
```

---

## 访问系统

启动所有服务后，您可以通过浏览器访问系统：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端主页 | http://localhost:3000 | 用户登录和主要操作界面 |
| 后端 API | http://127.0.0.1:8000 | Django 后端服务 |
| 管理后台 | http://127.0.0.1:8000/admin/ | Django 管理后台（使用步骤 6 创建的账号登录） |
| 任务监控 | http://127.0.0.1:8000/django-rq/ | 异步任务监控界面 |

---

## 停止服务

### macOS（使用 Homebrew）

停止 Redis：
```bash
brew services stop redis
```

### Linux

停止 Redis：
```bash
sudo systemctl stop redis
```

### Windows

在运行 Redis 的命令提示符窗口中，按 `Ctrl + C` 停止 Redis 服务。

### 停止前端和后端

在各自的命令行窗口中，按 `Ctrl + C` 停止服务。

---

## 常见问题

### 问题 1：端口被占用

**错误信息：**
```
Address already in use
```

**解决方法：**

**Windows:**
查找占用端口的进程：
```
netstat -ano | findstr :8000
netstat -ano | findstr :3000
```

结束进程：
```
taskkill /PID <进程ID> /F
```

**macOS/Linux:**
查找占用端口的进程：
```bash
lsof -ti:8000
lsof -ti:3000
```

结束进程：
```bash
kill -9 <进程ID>
```

---

### 问题 2：Redis 启动失败

**Windows:**
- 确保 Redis 已正确安装
- 检查是否有多个 Redis 实例在运行

**macOS/Linux:**
检查 Redis 状态：
```bash
brew services list  # macOS
sudo systemctl status redis  # Linux
```

如果未运行，重新启动：
```bash
brew services restart redis  # macOS
sudo systemctl restart redis  # Linux
```

---

### 问题 3：pip 安装依赖失败

**使用国内镜像加速（推荐）：**

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**或者使用其他镜像：**
```bash
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
```

---

### 问题 4：npm install 失败

**清除缓存后重试：**
```bash
npm cache clean --force
npm install
```

---

### 问题 5：数据库迁移失败

**删除数据库文件后重新迁移：**

1. 停止 Django 服务
2. 删除 `db.sqlite3` 文件（在项目根目录）
3. 重新运行迁移：
```bash
python manage.py migrate
```

---

## 生产环境部署提示

本指南适用于开发环境部署。如果您需要在生产环境中部署，建议：

1. **使用 Gunicorn 替代 Django 开发服务器**
2. **使用 Nginx 作为反向代理**
3. **使用 PostgreSQL 数据库替代 SQLite**
4. **修改安全配置：**
   - 设置 `DEBUG = False`
   - 配置 `ALLOWED_HOSTS`
   - 修改 `SECRET_KEY`
   - 使用环境变量存储敏感信息
5. **配置 HTTPS（SSL 证书）**

如需生产环境部署帮助，请联系技术支持或查阅 Django 官方部署文档。

---

## 需要帮助？

如果在部署过程中遇到问题，您可以：

1. 查阅项目的 [README.md](README.md) 获取更多信息
2. 检查系统日志文件（位于 `logs/` 目录）
3. 在项目 GitHub 仓库提交 Issue

---

**祝您部署顺利！🎉**
