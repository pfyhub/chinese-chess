# 把 src/ 下的引擎打包成小游戏可用的 CommonJS 单文件
# 用法：右键“使用 PowerShell 运行”，或执行 powershell -ExecutionPolicy Bypass -File build.ps1
$root = Split-Path -Parent $PSScriptRoot
npx --yes esbuild "$root\wechat-game\js\engine-entry.js" --bundle --format=cjs --platform=neutral --outfile="$root\wechat-game\js\bundle.js"
