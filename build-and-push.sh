#!/bin/sh
set -e

# Build the Docker image
docker build -t drnit29/gemini-cli-openai:latest .

# Push the Docker image to Docker Hub
docker push drnit29/gemini-cli-openai:latest

echo "Successfully built and pushed drnit29/gemini-cli-openai:latest"