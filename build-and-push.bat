@echo off
setlocal

echo Building Docker image...
REM Build the Docker image without cache to ensure fresh build
docker build --no-cache -t drnit29/gemini-cli-openai:latest .
if %errorlevel% neq 0 (
    echo ❌ Docker build failed.
    exit /b %errorlevel%
)

echo Build successful! Pushing to Docker Hub...
REM Push the Docker image to Docker Hub
docker push drnit29/gemini-cli-openai:latest
if %errorlevel% neq 0 (
    echo ❌ Docker push failed.
    exit /b %errorlevel%
)

echo ✅ Successfully built and pushed drnit29/gemini-cli-openai:latest
endlocal