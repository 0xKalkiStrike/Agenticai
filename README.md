# 🎫 IT Support System - Localhost Edition

A simple, clean IT support ticket system designed for localhost development with WAMP server.

## 🚀 Quick Start

1. **Start WAMP Server** (ensure MySQL is running)
2. **Run setup**: `py setup_localhost_wamp.py`
3. **Start backend**: `py backend/app/main.py`
4. **Start frontend**: `npm run dev`

**Or use the Windows batch file**: `start_localhost.bat`

## 🌐 Access

- **App**: http://localhost:3000
- **API**: http://localhost:8001
- **Docs**: http://localhost:8001/docs
- **phpMyAdmin**: http://localhost/phpmyadmin

## 👤 Login

- **Admin**: Admin / Admin123
- **Client**: TestClient / client123
- **Developer**: TestDev / dev123
- **PM**: TestPM / pm123

## 📁 Structure

```
├── backend/app/     # FastAPI backend
├── components/      # React components  
├── app/            # Next.js pages
├── lib/            # Utilities
└── setup_localhost_wamp.py  # Database setup
```

## 🔧 Features

- User management & roles
- Ticket system with assignments
- AI-powered chat support
- Real-time notifications
- Role-based dashboards
- **Light/Dark theme toggle**
- **Personal email settings**
- **Notification preferences**
- WAMP server integration

---

📖 **Detailed docs**: See `LOCALHOST_SETUP.md` for complete setup guide