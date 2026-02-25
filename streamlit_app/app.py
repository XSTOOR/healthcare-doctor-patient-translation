"""
Healthcare Doctor-Patient Translation Web Application - Streamlit Version
Main application entry point
"""
import streamlit as st
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set page config
st.set_page_config(
    page_title="Healthcare Translation",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 2rem 0;
        background: linear-gradient(135deg, #115E59 0%, #0D9488 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 2rem;
    }
    .conversation-card {
        padding: 1.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        margin-bottom: 1rem;
        transition: all 0.2s;
    }
    .conversation-card:hover {
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    .message-bubble {
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        max-width: 70%;
    }
    .message-own {
        background: #115E59;
        color: white;
        margin-left: auto;
    }
    .message-other {
        background: #f3f4f6;
        color: #1f2937;
    }
    .status-active {
        background: #d1fae5;
        color: #065f46;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.875rem;
    }
    .status-ended {
        background: #f3f4f6;
        color: #6b7280;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.875rem;
    }
    .stButton>button {
        width: 100%;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-weight: 500;
    }
    .stTextInput>div>div>input,
    .stTextArea>div>div>textarea,
    .stSelectbox>div>div>select {
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
from utils.session import init_session_state
init_session_state()

# Import pages
from pages import login_page, dashboard_page, conversation_page


def main():
    """Main application router"""

    # Show app header
    if st.session_state.get('authenticated'):
        st.markdown(f"""
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="color: #115E59; margin: 0;">🏥 Healthcare Translation</h1>
                <p style="color: #6b7280; margin: 0.25rem 0 0 0;">
                    Welcome, {st.session_state.user.get('first_name', 'User')} ({st.session_state.user.get('role', '').capitalize()})
                </p>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # Route to appropriate page
    if not st.session_state.get('authenticated'):
        login_page.show()
    elif st.session_state.get('current_page') == 'dashboard':
        dashboard_page.show()
    elif st.session_state.get('current_page') == 'conversation':
        conversation_page.show()
    else:
        st.session_state.current_page = 'dashboard'
        dashboard_page.show()


if __name__ == "__main__":
    main()
