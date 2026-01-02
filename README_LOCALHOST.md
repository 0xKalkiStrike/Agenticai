# IT Support System - Localhost WAMP Setup

A simple IT support ticket system designed to run on localhost with WAMP server.

## 🚀 Quick Start

### Prerequisites
- WAMP Server installed and running
- Python 3.7+ with pip
- Node.js 16+ with npm

### 1. Setup Database
```bash
# Run the setup script to create database and tables
py setup_localhost_wamp.py
```

### 2. Install Dependencies
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies  
npm install
```

### 3. Start the Application
```bash
# Terminal 1: Start Backend (FastAPI)
py backend/app/main.py

# Terminal 2: Start Frontend (Next.js)
npm run dev
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **phpMyAdmin**: http://localhost/phpmyadmin

## 👥 Default Users

| Username | Password | Role |
|----------|----------|------|
| Admin | Admin123 | Administrator |
| TestClient | client123 | Client |
| TestDev | dev123 | Developer |
| TestPM | pm123 | Project Manager |

## 🗄️ Database Configuration

The system uses MySQL with these default WAMP settings:
- **Host**: localhost
- **Port**: 3306
- **User**: root
- **Password**: (empty)
- **Database**: agentic_ai

## 📁 Project Structure

```
├── backend/app/          # FastAPI backend
├── components/           # React components
├── lib/                  # Utilities and types
├── app/                  # Next.js pages
├── setup_localhost_wamp.py  # Database setup script
└── requirements.txt      # Python dependencies
```

## 🔧 Features

- **User Management**: Admin can manage users and roles
- **Ticket System**: Create, assign, and track support tickets
- **AI Assistant**: Basic AI-powered chat support
- **Dashboard**: Role-based dashboards for different user types
- **Notifications**: Real-time notifications for ticket updates

## 🛠️ Development

### Backend (FastAPI)
- Located in `backend/app/`
- Main file: `backend/app/main.py`
- Database operations: `backend/app/database.py`

### Frontend (Next.js)
- React components in `components/`
- Pages in `app/`
- Utilities in `lib/`

## 📊 Database Tables

- `users` - User accounts and roles
- `tickets` - Support tickets
- `notifications` - System notifications
- `knowledge_base` - AI knowledge base
- `ai_conversations` - AI chat conversations
- `stats` - System statistics

## 🔍 Troubleshooting

1. **Database Connection Issues**
   - Ensure WAMP is running
   - Check MySQL service is started
   - Verify database credentials in `.env.local`

2. **Backend Not Starting**
   - Check Python dependencies: `pip install -r requirements.txt`
   - Verify port 8001 is available

3. **Frontend Not Loading**
   - Check Node.js dependencies: `npm install`
   - Verify port 3000 is available

## 📝 Notes

- This is a localhost-only setup optimized for WAMP server
- No Docker or deployment configurations included
- Designed for development and testing purposes
- Uses simple authentication (not production-ready)