#!/bin/bash
set -e

echo "🔧 Building TypeScript..."
# Build TypeScript first to catch errors early
npm run build

if [ $? -eq 0 ]; then
    echo "✅ TypeScript build successful!"
    echo "🐳 Building Docker image..."
    # Build the Docker image without cache to ensure fresh build
    docker build --no-cache -t drnit29/gemini-cli-openai:latest .
else
    echo "❌ TypeScript build failed"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo "Build successful! Pushing to Docker Hub..."
    # Push the Docker image to Docker Hub
    docker push drnit29/gemini-cli-openai:latest
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully built and pushed drnit29/gemini-cli-openai:latest"
    else
        echo "❌ Push failed"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi