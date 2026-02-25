"""
Session state management for Streamlit
"""
import streamlit as st
from typing import Optional, Dict


def init_session_state():
    """Initialize session state variables"""
    if 'user' not in st.session_state:
        st.session_state.user = None
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    if 'current_page' not in st.session_state:
        st.session_state.current_page = 'login'
    if 'selected_conversation' not in st.session_state:
        st.session_state.selected_conversation = None
    if 'refresh_conversations' not in st.session_state:
        st.session_state.refresh_conversations = False
    if 'translation_direction' not in st.session_state:
        st.session_state.translation_direction = 'en'


def login_user(user: Dict):
    """Log in user and set session state"""
    st.session_state.user = user
    st.session_state.authenticated = True
    st.session_state.current_page = 'dashboard'
    st.session_state.selected_conversation = None


def logout_user():
    """Log out user and clear session state"""
    st.session_state.user = None
    st.session_state.authenticated = False
    st.session_state.current_page = 'login'
    st.session_state.selected_conversation = None


def is_authenticated() -> bool:
    """Check if user is authenticated"""
    return st.session_state.authenticated


def get_current_user() -> Optional[Dict]:
    """Get current user from session"""
    return st.session_state.user


def get_user_role() -> Optional[str]:
    """Get current user's role"""
    return st.session_state.user.get('role') if st.session_state.user else None


def has_role(role: str) -> bool:
    """Check if current user has specific role"""
    return get_user_role() == role


def set_current_page(page: str):
    """Set current page"""
    st.session_state.current_page = page


def get_current_page() -> str:
    """Get current page"""
    return st.session_state.current_page


def set_selected_conversation(conversation: Dict):
    """Set selected conversation"""
    st.session_state.selected_conversation = conversation


def get_selected_conversation() -> Optional[Dict]:
    """Get selected conversation"""
    return st.session_state.selected_conversation


def refresh_data():
    """Trigger data refresh"""
    st.session_state.refresh_conversations = not st.session_state.refresh_conversations


def clear_conversation():
    """Clear selected conversation"""
    st.session_state.selected_conversation = None
    st.session_state.current_page = 'dashboard'
