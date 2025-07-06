#!/bin/bash

echo "================================================="
echo "        Reiniciando Gemini CLI OpenAI Server"
echo "================================================="
echo

echo "🔄 Parando containers..."
docker-compose -f docker-compose.coolify.yml down

echo
echo "🚀 Iniciando containers..."
docker-compose -f docker-compose.coolify.yml up -d

echo
echo "⏳ Aguardando containers iniciarem..."
sleep 3

echo
echo "📊 Status dos containers:"
docker-compose -f docker-compose.coolify.yml ps

echo
echo "🔍 Verificando saúde da aplicação..."
sleep 2

echo
echo "💚 Testando endpoint de saúde..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Aplicação reiniciada com sucesso!"
    echo "🌐 Acesse: http://localhost:3000"
else
    echo "❌ Erro ao verificar saúde da aplicação"
    echo "📋 Verifique os logs: docker logs gemini-cli-openai-gemini-cli-openai-1"
fi

echo
echo "📝 Comandos úteis:"
echo "   docker logs gemini-cli-openai-gemini-cli-openai-1  - Ver logs da aplicação"
echo "   docker logs gemini-cli-openai-redis-1              - Ver logs do Redis"
echo "   ./stop.bat ou docker-compose down                  - Parar containers"
echo