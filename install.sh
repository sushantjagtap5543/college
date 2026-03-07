#!/bin/bash

# Exit on error
set -e

echo "=========================================================="
echo "      GEOSUREPATH - AWS Lightsail Deployment Script       "
echo "=========================================================="

echo ">>> Phase 1: Cleaning up existing deployments..."
# Stop and remove all existing docker-compose containers, networks, and images (if any)
if command -v docker-compose &> /dev/null; then
    echo "Stopping existing docker-compose services..."
    sudo docker-compose down -v || true
fi

# Deep clean to prevent conflicts and free up space
echo "Cleaning up dangling Docker images and volumes..."
if command -v docker &> /dev/null; then
    echo "Force removing any explicitly named leftover containers..."
    sudo docker rm -f gps_postgres gps_redis gps_tcp_server gps_backend gps_frontend gps_traccar 2>/dev/null || true
    sudo docker system prune -af --volumes || true
fi

echo "Checking for local host processes blocking essential Docker ports (e.g. 5432, 6379, 8080)..."
# Stop local postgres if it's running on the host
sudo systemctl stop postgresql 2>/dev/null || true
sudo systemctl disable postgresql 2>/dev/null || true
# Stop local redis if it's running on the host
sudo systemctl stop redis-server 2>/dev/null || true

# Force kill anything holding essential Docker ports
sudo fuser -k 5432/tcp 2>/dev/null || true
sudo fuser -k 6379/tcp 2>/dev/null || true
sudo fuser -k 8080/tcp 2>/dev/null || true
sudo fuser -k 8082/tcp 2>/dev/null || true
sudo fuser -k 5000/tcp 2>/dev/null || true
sudo fuser -k 5001/tcp 2>/dev/null || true
sudo fuser -k 5023/tcp 2>/dev/null || true
sudo fuser -k 3000/tcp 2>/dev/null || true

echo "Clean up done!"
echo "----------------------------------------------------------"

echo ">>> Phase 2: Installing Prerequisites..."
# Update package list and upgrade system
sudo apt-get update -y
# Install curl, git, docker, and docker-compose if they don't exist
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common git

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get install -y docker.io
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker-Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "Prerequisites installed successfully!"
echo "----------------------------------------------------------"

echo ">>> Phase 3: Building and Starting Services (including Port 5000)..."
# Pull latest images and build the local ones
sudo docker-compose pull
echo "Building the platform containers..."
sudo docker-compose build

echo "Starting all services in detached mode..."
sudo docker-compose up -d

echo "----------------------------------------------------------"
echo ">>> Deployment Complete! GEOSUREPATH is running."
echo ">>> Live Tracking / TCP Receivers are active on Port 5000."
echo ">>> Web UI is available on Port 3000."
echo ">>> Traccar API is available on Port 8082."
echo ">>> Remember to open Ports 80, 443, 3000, 5000, 8080, 8082 in the AWS Lightsail Firewall."
echo "=========================================================="
