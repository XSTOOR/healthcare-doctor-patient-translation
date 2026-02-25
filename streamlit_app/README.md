# Healthcare Translation App - Streamlit Version

A Streamlit-based healthcare doctor-patient translation web application that enables real-time communication with translation and AI-powered medical summaries.

## 🚀 Quick Start

### Access the Application
- **URL**: https://ds347u208p80.drytis.ai/
- **Port**: 8501 (internal)

### Demo Credentials
- **Doctor**: doctor@demo.com / password
- **Patient**: patient@demo.com / password

## 📁 Project Structure

```
streamlit_app/
├── app.py                 # Main application entry point
├── requirements.txt       # Python dependencies
├── .env                   # Environment configuration
├── utils/                 # Utility modules
│   ├── __init__.py
│   ├── database.py        # Database connection and queries
│   ├── translation.py     # Translation service (MyMemory API)
│   ├── session.py         # Session state management
│   └── auth_helpers.py    # Authentication helpers
├── pages/                 # Application pages
│   ├── __init__.py
│   ├── login_page.py      # Login/Register page
│   ├── dashboard_page.py  # Dashboard with conversations list
│   └── conversation_page.py # Chat/Conversation interface
└── venv/                  # Python virtual environment
```

## 🛠️ Installation

### Prerequisites
- Python 3.11+
- MySQL database
- pip package manager

### Setup Steps

1. **Create virtual environment:**
   ```bash
   cd /workspace/streamlit_app
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   Edit `.env` file with your database credentials:
   ```env
   DATABASE_HOST=localhost
   DATABASE_PORT=3306
   DATABASE_NAME=your_database_name
   DATABASE_USER=your_database_user
   DATABASE_PASSWORD=your_database_password
   ```

4. **Run the application:**
   ```bash
   streamlit run app.py --server.port=8501 --server.address=0.0.0.0
   ```

## 🏗️ Architecture

### Database Layer (`utils/database.py`)
- **DatabaseManager**: Connection pooling and query execution
- **User Functions**: Authentication, user creation, retrieval
- **Conversation Functions**: CRUD operations for consultations
- **Message Functions**: Store and retrieve chat messages
- **Summary Functions**: AI-powered medical summaries
- **Search Functions**: Full-text search across conversations

### Translation Service (`utils/translation.py`)
- Uses **MyMemory Translation API** (free tier)
- Supports 12+ languages
- Auto-detection for source language
- Batch translation support

### Session Management (`utils/session.py`)
- User authentication state
- Navigation between pages
- Conversation selection tracking

## 📱 Features

### For Doctors
- ✅ Create new consultations
- ✅ Select patient language
- ✅ Send translated messages
- ✅ View conversation history
- ✅ Generate AI medical summaries
- ✅ Search conversations

### For Patients
- ✅ View consultations
- ✅ Send translated messages
- ✅ View conversation history
- ✅ Read medical summaries

### Translation Features
- ✅ Real-time text translation
- ✅ 12+ supported languages
- ✅ Translation preview before sending
- ✅ Message history with original and translated text

### AI Summary Features
- ✅ Auto-generate medical summaries
- ✅ Extract symptoms, diagnosis, medications
- ✅ Follow-up action recommendations

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_HOST | MySQL host | localhost |
| DATABASE_PORT | MySQL port | 3306 |
| DATABASE_NAME | Database name | healthcare_translation |
| DATABASE_USER | Database user | root |
| DATABASE_PASSWORD | Database password | - |
| JWT_SECRET | JWT signing secret | - |
| MYMEMORY_API_EMAIL | MyMemory API email (optional) | - |

### Supported Languages

- English (en)
- Spanish (es)
- Chinese (zh)
- Arabic (ar)
- French (fr)
- German (de)
- Portuguese (pt)
- Russian (ru)
- Hindi (hi)
- Vietnamese (vi)
- Korean (ko)
- Japanese (ja)
- Italian (it)
- Dutch (nl)

## 🔐 Security Notes

- Demo uses simple password hashing (SHA-256)
- **Production**: Use bcrypt/Argon2 for password hashing
- **Production**: Implement rate limiting
- **Production**: Add CSRF protection
- **Production**: Use HTTPS only
- **Production**: Implement proper session management

## 🐛 Troubleshooting

### Blank Page on Load
- Check if Streamlit service is running: `ps aux | grep streamlit`
- Check if port 8501 is listening: `ss -tlnp | grep 8501`
- Check service logs: `tail -f /var/log/supervisor/service-bg-service-700.log`

### Database Connection Errors
- Verify MySQL is running
- Check credentials in `.env`
- Ensure database exists and tables are created

### Translation Not Working
- Check internet connectivity
- MyMemory API may be rate-limited
- Consider registering email for higher limits

## 📊 Database Schema

### Tables
- **users**: User accounts (doctors & patients)
- **conversations**: Consultation sessions
- **messages**: Chat messages with translations
- **summaries**: AI-generated medical summaries

## 🔄 Conversion from Node.js/React

This Streamlit version converts the original Node.js/Express/React application to Python/Streamlit:

| Original | Streamlit Version |
|----------|-------------------|
| React Components | Streamlit pages/functions |
| Express Routes | Python functions + Streamlit callbacks |
| Socket.IO | Streamlit session state + rerun |
| JWT Auth | Session-based auth (simplified) |
| React Router | Streamlit session state navigation |

## 📝 Development Notes

### Adding New Pages
1. Create new page file in `pages/`
2. Import in `app.py`
3. Add routing logic in `main()` function

### Adding New Database Queries
1. Add function to `utils/database.py`
2. Use `DatabaseManager` for connections
3. Return dictionaries for easy display in Streamlit

### Customizing UI
- Edit CSS in `app.py` under `st.markdown()` with `<style>` tags
- Use Streamlit's built-in components
- Create reusable functions in `utils/` or `components/`

## 📄 License

This is a healthcare communication application. Ensure HIPAA compliance before production use.

## 🆘 Support

For issues or questions, check the service logs or contact development team.
