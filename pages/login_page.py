"""
Login page for the Healthcare Translation App
"""
import streamlit as st
from utils.database import authenticate_user, create_user, get_all_patients
from utils.session import login_user


def show_login():
    """Show login form"""
    st.markdown("""
    <div class="main-header">
        <h1>🏥 Healthcare Translation</h1>
        <p>Doctor-Patient Communication Platform</p>
    </div>
    """, unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["Login", "Register"])

    with tab1:
        st.subheader("Sign In")
        with st.form("login_form"):
            email = st.text_input("Email", placeholder="doctor@demo.com", key="login_email")
            password = st.text_input("Password", type="password", placeholder="password", key="login_password")
            submitted = st.form_submit_button("Login", use_container_width=True)

            if submitted:
                if not email or not password:
                    st.error("Please fill in all fields")
                else:
                    # For demo: accept demo credentials
                    if email == "doctor@demo.com" and password == "password":
                        login_user({
                            'id': 1,
                            'email': 'doctor@demo.com',
                            'role': 'doctor',
                            'first_name': 'Dr. Sarah',
                            'last_name': 'Johnson'
                        })
                        st.success("Login successful!")
                        st.rerun()
                    elif email == "patient@demo.com" and password == "password":
                        login_user({
                            'id': 2,
                            'email': 'patient@demo.com',
                            'role': 'patient',
                            'first_name': 'Maria',
                            'last_name': 'Garcia'
                        })
                        st.success("Login successful!")
                        st.rerun()
                    else:
                        # Try database authentication
                        user = authenticate_user(email, password)
                        if user:
                            login_user(user)
                            st.success("Login successful!")
                            st.rerun()
                        else:
                            st.error("Invalid credentials. Use doctor@demo.com / password or patient@demo.com / password")

        st.markdown("---")
        st.info("📝 **Demo Credentials:**\n- **Doctor:** doctor@demo.com / password\n- **Patient:** patient@demo.com / password")

    with tab2:
        st.subheader("Create Account")
        with st.form("register_form"):
            first_name = st.text_input("First Name", key="reg_first_name")
            last_name = st.text_input("Last Name", key="reg_last_name")
            email = st.text_input("Email", key="reg_email")
            password = st.text_input("Password", type="password", key="reg_password")
            password_confirm = st.text_input("Confirm Password", type="password", key="reg_password_confirm")
            role = st.selectbox("I am a...", ["patient", "doctor"], key="reg_role")

            submitted = st.form_submit_button("Register", use_container_width=True)

            if submitted:
                if not all([first_name, last_name, email, password]):
                    st.error("Please fill in all fields")
                elif password != password_confirm:
                    st.error("Passwords do not match")
                elif len(password) < 8:
                    st.error("Password must be at least 8 characters")
                else:
                    user_id = create_user(email, password, role, first_name, last_name)
                    if user_id:
                        st.success("Registration successful! Please login.")
                    else:
                        st.error("Registration failed. Email may already be registered.")


def show():
    """Main entry point for login page"""
    show_login()
