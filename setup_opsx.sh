Write-Host "=====OpenSpec一键配置(CC启用opsx全指令)====="
#全局安装openspec
npm install -g @fission-ai/openspec@latest
openspec --version

#初始化绑定Claude Code，强制覆写
openspec init --tools claude --force

#启用custom配置开启verify
openspec config set profile custom
openspec update

#生成claude权限配置
New-Item -ItemType Directory -Force -Path .claude | Out-Null
$json=@{
    permissions=@{
        allow=@("Bash(openspec *)","Bash(npm *)","Bash(git *)")
        deny=@("Bash(rm -rf /)","Bash(sudo rm *)")
    }
    mcpServers=@{
        openspec=@{
            command="npx"
            args=@("-y","@fission-ai/openspec-mcp")
        }
    }
}
$json | ConvertTo-Json -Depth 10 | Out-File .claude/settings.json -Encoding utf8

Write-Host "✅配置完毕，重启VSCode+Claude Code，输入/reload-plugins即可使用/opsx:verify"