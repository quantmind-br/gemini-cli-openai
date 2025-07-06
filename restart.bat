@echo off
echo =================================================
echo        Reiniciando Gemini CLI OpenAI Server
echo =================================================
echo.

echo 🔄 Parando containers...
docker-compose -f docker-compose.coolify.yml down

echo.
echo 🚀 Iniciando containers...
docker-compose -f docker-compose.coolify.yml up -d

echo.
echo ⏳ Aguardando containers iniciarem...
timeout /t 3 /nobreak >nul

echo.
echo 📊 Status dos containers:
docker-compose -f docker-compose.coolify.yml ps

echo.
echo 🔍 Verificando saúde da aplicação...
timeout /t 2 /nobreak >nul

echo.
echo 💚 Testando endpoint de saúde...
curl -s http://localhost:3000/health 2>nul && (
    echo ✅ Aplicação reiniciada com sucesso!
    echo 🌐 Acesse: http://localhost:3000
) || (
    echo ❌ Erro ao verificar saúde da aplicação
    echo 📋 Verifique os logs: docker logs gemini-cli-openai-gemini-cli-openai-1
)

echo.
echo 📝 Comandos úteis:
echo    docker logs gemini-cli-openai-gemini-cli-openai-1  - Ver logs da aplicação
echo    docker logs gemini-cli-openai-redis-1              - Ver logs do Redis
echo    stop.bat                                           - Parar containers
echo.
pause