"""
Authentication helper functions - simplified for demo
"""
from utils.database import create_user, get_user_by_id


def ensure_demo_users():
    """Ensure demo users exist in the database"""
    import hashlib

    def simple_hash(password):
        """Simple hash for demo (in production use bcrypt)"""
        return hashlib.sha256(password.encode()).hexdigest()

    # Check and create doctor user
    doctor = get_user_by_id(1)
    if not doctor:
        create_user(
            email='doctor@demo.com',
            password=simple_hash('password'),
            role='doctor',
            first_name='Dr. Sarah',
            last_name='Johnson'
        )
        print('Created demo doctor user')

    # Check and create patient user
    patient = get_user_by_id(2)
    if not patient:
        create_user(
            email='patient@demo.com',
            password=simple_hash('password'),
            role='patient',
            first_name='Maria',
            last_name='Garcia'
        )
        print('Created demo patient user')


def verify_password(password, stored_password):
    """Verify password (simplified for demo)"""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest() == stored_password
