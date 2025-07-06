@echo off
echo =================================================
echo        Testes da API Gemini CLI OpenAI
echo =================================================
echo.

echo 📦 Instalando dependencias Python...
pip install -r requirements.txt
echo.

echo 🧪 Executando testes com requests...
python test_api.py
echo.

echo 🔧 Executando testes com OpenAI SDK...
python test_openai_sdk.py
echo.

echo ✅ Testes concluidos!
pause