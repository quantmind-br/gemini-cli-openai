@echo off
setlocal

echo 🔧 Building TypeScript...
REM Build TypeScript first to catch errors early
npm run build
if %errorlevel% neq 0 (
    echo ❌ TypeScript build failed
    exit /b %errorlevel%
)

echo ✅ TypeScript build successful!
echo 🐳 Building Docker image...
REM Build the Docker image without cache to ensure fresh build
docker build --no-cache -t drnit29/gemini-cli-openai:latest .
if %errorlevel% neq 0 (
    echo ❌ Docker build failed
    exit /b %errorlevel%
)

echo Build successful! Pushing to Docker Hub...
REM Push the Docker image to Docker Hub
docker push drnit29/gemini-cli-openai:latest
if %errorlevel% neq 0 (
    echo ❌ Push failed
    exit /b %errorlevel%
)

echo ✅ Successfully built and pushed drnit29/gemini-cli-openai:latest
endlocal