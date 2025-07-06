@echo off
setlocal

REM Build the Docker image
docker build -t drnit29/gemini-cli-openai:latest .
if %errorlevel% neq 0 (
    echo Docker build failed.
    exit /b %errorlevel%
)

REM Push the Docker image to Docker Hub
docker push drnit29/gemini-cli-openai:latest
if %errorlevel% neq 0 (
    echo Docker push failed.
    exit /b %errorlevel%
)

echo Successfully built and pushed drnit29/gemini-cli-openai:latest
endlocal