# 工法情报编辑器 - 一键启动脚本
# 同时启动前端 (Vite :4512) 和后端 (BFF :4513)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Info  { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Ok    { Write-Host "[OK]   $args" -ForegroundColor Green }
function Write-Error { Write-Host "[ERR]  $args" -ForegroundColor Red }
function Write-Step  { Write-Host "`n==> $args" -ForegroundColor Yellow }

Clear-Host
Write-Host @"

   ==========================================
    工法情报编辑器 - 一键启动
    前端 :4512 + BFF :4513
   ==========================================

"@ -ForegroundColor Magenta

# 检查 Node.js
try {
    $nodeVersion = node --version
    Write-Ok "Node.js $nodeVersion"
} catch {
    Write-Error "未检测到 Node.js，请先安装: https://nodejs.org/"
    Read-Host "按回车退出"
    exit 1
}

# 检查依赖
Write-Step "检查依赖..."
if (-not (Test-Path "$ProjectRoot\node_modules")) {
    Write-Info "安装依赖..."
    Push-Location $ProjectRoot
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Error "依赖安装失败"
        Read-Host "按回车退出"
        exit 1
    }
    Write-Ok "依赖安装完成"
} else {
    Write-Ok "依赖已就绪"
}

# 检查环境变量
Write-Step "检查配置..."
$envFile = "$ProjectRoot\.env.local"
if (Test-Path $envFile) {
    $match = Select-String -Path $envFile -Pattern "DEEPSEEK_API_KEY=(.+)"
    if ($match -and $match.Matches.Groups[1].Value) {
        Write-Ok "DEEPSEEK_API_KEY 已配置"
    } else {
        Write-Error "缺少 DEEPSEEK_API_KEY，请在 .env.local 中配置"
    }
} else {
    Write-Error "缺少 .env.local 文件"
}

# 启动
Write-Step "启动服务..."
Write-Host "  前端: http://localhost:4512"
Write-Host "  BFF:  http://localhost:4513"
Write-Host "  按 Ctrl+C 停止所有服务`n"

Push-Location $ProjectRoot
try {
    # 清理残留进程
    $existing = Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "server\.js|vite" }
    if ($existing) {
        Write-Info "清理残留进程..."
        $existing | Stop-Process -Force
        Start-Sleep 1
    }

    # 同步 worker 资源
    Write-Info "同步 PDF.js worker..."
    npm run sync:worker

    # 打开浏览器（稍等几秒等服务起来）
    Start-Sleep 3
    Start-Process "http://localhost:4512"

    # 用 cmd /c 启动两个进程（确保 PATH 正常加载）
    Write-Info "启动 BFF 服务 (端口 4513)..."
    $bff = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c node server.js"

    Start-Sleep 2

    Write-Info "启动前端 (端口 4512)..."
    $front = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c npx vite --host 0.0.0.0 --port 4512"

    # 等待任意一个退出
    $null = Wait-Process -Id $bff.Id, $front.Id

} finally {
    # 清理
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "server\.js|vite" } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Pop-Location
    Write-Host "`n服务已停止。" -ForegroundColor Yellow
}