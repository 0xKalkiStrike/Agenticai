# 🏠 Localhost WAMP Setup - Quick Start Guide

## ⚡ Super Quick Start (Windows)

1. **Start WAMP Server** (make sure MySQL is running)
2. **Double-click** `start_localhost.bat`
3. **Choose option 1** to setup database (first time only)
4. **Choose option 4** to start both backend and frontend

That's it! 🎉

## 🔧 Manual Setup

### 1. Prerequisites
- ✅ WAMP Server running
- ✅ Python 3.7+
- ✅ Node.js 16+

### 2. Database Setup (First Time Only)
```bash
py setup_localhost_wamp.py
```

### 3. Install Dependencies
```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies
npm install
```

### 4. Start Services

**Option A: Use batch file (Windows)**
```bash
start_localhost.bat
```

**Option B: Manual start**
```bash
# Terminal 1: Backend
py backend/app/main.py

# Terminal 2: Frontend  
npm run dev
```

**Option C: NPM scripts**
```bash
# Setup database
npm run setup

# Start backend
npm run backend

# Start frontend
npm run dev
```

## 🌐 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main application |
| Backend API | http://localhost:8001 | REST API |
| API Docs | http://localhost:8001/docs | Interactive API documentation |
| phpMyAdmin | http://localhost/phpmyadmin | Database management |

## 👥 Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | Admin | Admin123 |
| Client | TestClient | client123 |
| Developer | TestDev | dev123 |
| Project Manager | TestPM | pm123 |

## 🗂️ Clean Project Structure

```
├── backend/app/           # FastAPI backend
│   ├── main.py           # Main server file
│   ├── database.py       # Database operations
│   ├── ai_engine.py      # AI functionality
│   └── auth.py           # Authentication
├── components/           # React components
├── lib/                  # Utilities and types
├── app/                  # Next.js pages
├── setup_localhost_wamp.py  # Database setup
├── start_localhost.bat   # Windows startup script
├── requirements.txt      # Python dependencies
├── package.json          # Node.js dependencies
└── README_LOCALHOST.md   # Detailed documentation
```

## 🚀 What's Included

- ✅ **Clean localhost-only setup**
- ✅ **WAMP server integration**
- ✅ **No Docker complexity**
- ✅ **Simple startup scripts**
- ✅ **Pre-configured database**
- ✅ **Sample users and data**
- ✅ **AI-powered support system**
- ✅ **Role-based dashboards**
- ✅ **Ticket management**
- ✅ **Real-time notifications**
- ✅ **Light/Dark theme toggle**
- ✅ **Personal email settings**
- ✅ **Notification preferences**

## 🛠️ Removed Complexity

- ❌ Docker configurations
- ❌ Deployment files
- ❌ Cloud setup scripts
- ❌ Complex test files
- ❌ Production configurations
- ❌ Email server setup
- ❌ External dependencies

## 💡 Tips

1. **Always start WAMP first** before running the application
2. **Use the batch file** for easiest startup on Windows
3. **Check phpMyAdmin** to view/edit database directly
4. **Backend logs** show in the terminal for debugging
5. **Frontend hot-reloads** automatically on code changes

## 🔍 Troubleshooting

**WAMP not running?**
- Start WAMP server
- Ensure MySQL service is green/running

**Port conflicts?**
- Backend uses port 8001
- Frontend uses port 3000
- Make sure these ports are free

**Database connection failed?**
- Check WAMP MySQL is running
- Verify no password set for root user
- Run setup script again

**Dependencies missing?**
- Run: `pip install -r requirements.txt`
- Run: `npm install`

---

🎯 **Goal**: Simple, clean localhost development environment with WAMP server integration!