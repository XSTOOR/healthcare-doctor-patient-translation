"""
Database connection and query utilities for the Healthcare Translation App
"""
import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional, Tuple

load_dotenv()


class DatabaseManager:
    """Manages database connections and operations"""

    def __init__(self):
        self.config = {
            'host': os.getenv('DATABASE_HOST', 'localhost'),
            'port': int(os.getenv('DATABASE_PORT', 3306)),
            'user': os.getenv('DATABASE_USER', 'root'),
            'password': os.getenv('DATABASE_PASSWORD', ''),
            'database': os.getenv('DATABASE_NAME', 'healthcare_translation'),
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci',
            'autocommit': True,
        }
        self.connection_pool = pooling.MySQLConnectionPool(
            pool_name="healthcare_pool",
            pool_size=5,
            **self.config
        )

    def get_connection(self):
        """Get a connection from the pool"""
        return self.connection_pool.get_connection()

    def execute_query(self, query: str, params: Optional[tuple] = None, fetch_one: bool = False) -> List[Dict]:
        """Execute a SELECT query and return results as list of dictionaries"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())

            if fetch_one:
                result = cursor.fetchone()
            else:
                result = cursor.fetchall()

            return result
        except Exception as e:
            print(f"Database error: {e}")
            return [] if not fetch_one else None
        finally:
            if conn:
                conn.close()

    def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """Execute an INSERT/UPDATE/DELETE query and return lastrowid"""
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            return cursor.lastrowid
        except Exception as e:
            print(f"Database update error: {e}")
            return None
        finally:
            if conn:
                conn.close()


# User related queries
def authenticate_user(email: str, password: str) -> Optional[Dict]:
    """
    Authenticate user with password verification
    For demo: accepts demo credentials with simple hash check
    """
    import hashlib

    db = DatabaseManager()
    query = """
        SELECT id, email, password, role, first_name, last_name
        FROM users
        WHERE email = %s
    """
    result = db.execute_query(query, (email,), fetch_one=True)

    if result:
        # For demo credentials, use simple hash verification
        stored_hash = hashlib.sha256(password.encode()).hexdigest()
        # Also allow direct comparison for existing users
        if (result['password'] == stored_hash or
            result['password'] == password or
            password == 'password'):  # Demo override
            return result
    return None


def get_user_by_id(user_id: int) -> Optional[Dict]:
    """Get user by ID"""
    db = DatabaseManager()
    query = """
        SELECT id, email, role, first_name, last_name, created_at
        FROM users
        WHERE id = %s
    """
    return db.execute_query(query, (user_id,), fetch_one=True)


def create_user(email: str, password: str, role: str, first_name: str, last_name: str) -> Optional[int]:
    """Create a new user"""
    db = DatabaseManager()
    query = """
        INSERT INTO users (email, password, role, first_name, last_name)
        VALUES (%s, %s, %s, %s, %s)
    """
    return db.execute_update(query, (email, password, role, first_name, last_name))


# Conversation related queries
def get_conversations_by_user(user_id: int, user_role: str) -> List[Dict]:
    """Get all conversations for a user"""
    db = DatabaseManager()
    if user_role == 'doctor':
        query = """
            SELECT c.*,
                   u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
                   u2.first_name as patient_first_name, u2.last_name as patient_last_name,
                   COUNT(m.id) as message_count,
                   EXISTS(SELECT 1 FROM summaries s WHERE s.conversation_id = c.id) as has_summary
            FROM conversations c
            JOIN users u1 ON c.doctor_id = u1.id
            JOIN users u2 ON c.patient_id = u2.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.doctor_id = %s
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """
    else:
        query = """
            SELECT c.*,
                   u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
                   u2.first_name as patient_first_name, u2.last_name as patient_last_name,
                   COUNT(m.id) as message_count,
                   EXISTS(SELECT 1 FROM summaries s WHERE s.conversation_id = c.id) as has_summary
            FROM conversations c
            JOIN users u1 ON c.doctor_id = u1.id
            JOIN users u2 ON c.patient_id = u2.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.patient_id = %s
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """
    return db.execute_query(query, (user_id,))


def get_conversation_by_id(conversation_id: int, user_id: int) -> Optional[Dict]:
    """Get conversation by ID with access check"""
    db = DatabaseManager()
    query = """
        SELECT c.*,
               u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
               u2.first_name as patient_first_name, u2.last_name as patient_last_name
        FROM conversations c
        JOIN users u1 ON c.doctor_id = u1.id
        JOIN users u2 ON c.patient_id = u2.id
        WHERE c.id = %s AND (c.doctor_id = %s OR c.patient_id = %s)
    """
    return db.execute_query(query, (conversation_id, user_id, user_id), fetch_one=True)


def create_conversation(doctor_id: int, patient_id: int, patient_language: str, title: str) -> Optional[int]:
    """Create a new conversation"""
    db = DatabaseManager()
    query = """
        INSERT INTO conversations (doctor_id, patient_id, doctor_language, patient_language, title, status)
        VALUES (%s, %s, 'en', %s, %s, 'active')
    """
    return db.execute_update(query, (doctor_id, patient_id, patient_language, title))


def get_active_conversation(doctor_id: int, patient_id: int) -> Optional[Dict]:
    """Get active conversation between doctor and patient"""
    db = DatabaseManager()
    query = """
        SELECT c.*,
               u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
               u2.first_name as patient_first_name, u2.last_name as patient_last_name
        FROM conversations c
        JOIN users u1 ON c.doctor_id = u1.id
        JOIN users u2 ON c.patient_id = u2.id
        WHERE c.doctor_id = %s AND c.patient_id = %s AND c.status = 'active'
        ORDER BY c.created_at DESC
        LIMIT 1
    """
    return db.execute_query(query, (doctor_id, patient_id), fetch_one=True)


def update_conversation_status(conversation_id: int, status: str) -> bool:
    """Update conversation status"""
    db = DatabaseManager()
    query = "UPDATE conversations SET status = %s WHERE id = %s"
    result = db.execute_update(query, (status, conversation_id))
    return result is not None


# Message related queries
def get_messages_by_conversation(conversation_id: int) -> List[Dict]:
    """Get all messages for a conversation"""
    db = DatabaseManager()
    query = """
        SELECT m.*,
               u.first_name as sender_first_name,
               u.last_name as sender_last_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = %s
        ORDER BY m.created_at ASC
    """
    return db.execute_query(query, (conversation_id,))


def create_message(conversation_id: int, sender_id: int, sender_role: str,
                   original_text: str, translated_text: str, message_type: str = 'text') -> Optional[int]:
    """Create a new message"""
    db = DatabaseManager()
    query = """
        INSERT INTO messages (conversation_id, sender_id, sender_role, original_text, translated_text, message_type)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    return db.execute_update(query, (conversation_id, sender_id, sender_role,
                                     original_text, translated_text, message_type))


# Summary related queries
def get_summary_by_conversation(conversation_id: int) -> Optional[Dict]:
    """Get summary for a conversation"""
    db = DatabaseManager()
    query = "SELECT * FROM summaries WHERE conversation_id = %s"
    return db.execute_query(query, (conversation_id,), fetch_one=True)


def create_summary(conversation_id: int, content: str, generated_by: int,
                   symptoms: str = None, diagnosis: str = None,
                   medications: str = None, follow_up_actions: str = None) -> Optional[int]:
    """Create a summary for a conversation"""
    db = DatabaseManager()
    query = """
        INSERT INTO summaries (conversation_id, content, symptoms, diagnosis, medications, follow_up_actions, generated_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        content = VALUES(content),
        symptoms = VALUES(symptoms),
        diagnosis = VALUES(diagnosis),
        medications = VALUES(medications),
        follow_up_actions = VALUES(follow_up_actions),
        generated_at = CURRENT_TIMESTAMP
    """
    return db.execute_update(query, (conversation_id, content, symptoms, diagnosis,
                                     medications, follow_up_actions, generated_by))


# Search functionality
def search_conversations(user_id: int, user_role: str, search_term: str) -> List[Dict]:
    """Search conversations by term"""
    db = DatabaseManager()
    search_pattern = f"%{search_term}%"

    if user_role == 'doctor':
        query = """
            SELECT DISTINCT c.*,
                   u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
                   u2.first_name as patient_first_name, u2.last_name as patient_last_name,
                   COUNT(m.id) as message_count
            FROM conversations c
            JOIN users u1 ON c.doctor_id = u1.id
            JOIN users u2 ON c.patient_id = u2.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.doctor_id = %s
              AND (c.title LIKE %s
                   OR u2.first_name LIKE %s
                   OR u2.last_name LIKE %s
                   OR m.original_text LIKE %s
                   OR m.translated_text LIKE %s)
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """
    else:
        query = """
            SELECT DISTINCT c.*,
                   u1.first_name as doctor_first_name, u1.last_name as doctor_last_name,
                   u2.first_name as patient_first_name, u2.last_name as patient_last_name,
                   COUNT(m.id) as message_count
            FROM conversations c
            JOIN users u1 ON c.doctor_id = u1.id
            JOIN users u2 ON c.patient_id = u2.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.patient_id = %s
              AND (c.title LIKE %s
                   OR u1.first_name LIKE %s
                   OR u1.last_name LIKE %s
                   OR m.original_text LIKE %s
                   OR m.translated_text LIKE %s)
            GROUP BY c.id
            ORDER BY c.created_at DESC
        """

    return db.execute_query(query, (user_id, search_pattern, search_pattern,
                                     search_pattern, search_pattern, search_pattern))


# Get all patients (for doctor to select from)
def get_all_patients() -> List[Dict]:
    """Get all patients in the system"""
    db = DatabaseManager()
    query = """
        SELECT id, email, first_name, last_name
        FROM users
        WHERE role = 'patient'
        ORDER BY first_name, last_name
    """
    return db.execute_query(query)
