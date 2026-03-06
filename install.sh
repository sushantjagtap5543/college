#!/bin/bash

echo "======================================"
echo "GPS Tracker Installation Script"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "Installing Node.js..."
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            echo "Detected Ubuntu/Debian system"
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        # CentOS/RHEL/Fedora
        elif command -v yum &> /dev/null; then
            echo "Detected CentOS/RHEL/Fedora system"
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs
        else
            echo "Please install Node.js manually from: https://nodejs.org/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "Detected macOS with Homebrew"
            brew install node
        else
            echo "Please install Homebrew first: https://brew.sh/"
            echo "Then run: brew install node"
            exit 1
        fi
    else
        echo "Unsupported OS. Please install Node.js manually from: https://nodejs.org/"
        exit 1
    fi
else
    echo "✅ Node.js is already installed"
    echo "   Version: $(node --version)"
fi

echo ""
echo "======================================"
echo "Installing Project Dependencies..."
echo "======================================"
echo ""

# Install npm packages
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Installation Complete!"
    echo "======================================"
    echo ""
    echo "To start the GPS tracker server, run:"
    echo "  npm start"
    echo ""
    echo "The server will be available at:"
    echo "  - Web Interface: http://localhost:3000"
    echo "  - GPS Data Port: 5000"
    echo ""
    echo "Configure your GPS tracker with:"
    echo "  - Server IP: <YOUR_PUBLIC_IP>"
    echo "  - Server Port: 5000"
    echo ""
    echo "To find your public IP, visit: http://whatismyip.com"
    echo ""
else
    echo ""
    echo "❌ Installation failed!"
    echo "Please check the error messages above."
    exit 1
fi
