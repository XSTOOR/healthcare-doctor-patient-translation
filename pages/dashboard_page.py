"""
Dashboard page showing conversations list
"""
import streamlit as st
from datetime import datetime
from utils.database import (
    get_conversations_by_user,
    create_conversation,
    get_active_conversation,
    update_conversation_status,
    get_all_patients,
    get_user_by_id
)
from utils.session import (
    get_current_user,
    set_current_page,
    set_selected_conversation,
    has_role,
    logout_user,
    refresh_data,
    get_language_options
)
from utils.translation import get_language_name


def format_date(date_str):
    """Format date to relative time"""
    if not date_str:
        return "Unknown"
    dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S") if isinstance(date_str, str) else date_str
    now = datetime.now()
    diff = now - dt
    hours = diff.total_seconds() / 3600

    if hours < 1:
        return f"{int(diff.total_seconds() / 60)}m ago"
    elif hours < 24:
        return f"{int(hours)}h ago"
    elif hours < 168:  # 1 week
        return f"{int(hours / 24)}d ago"
    else:
        return dt.strftime("%b %d, %Y")


def show_conversation_card(conv):
    """Display a conversation card"""
    is_doctor = has_role('doctor')

    # Get participant name
    if is_doctor:
        participant_name = f"{conv.get('patient_first_name', '')} {conv.get('patient_last_name', '')}"
    else:
        participant_name = f"{conv.get('doctor_first_name', '')} {conv.get('doctor_last_name', '')}"

    status = conv.get('status', 'active')
    status_class = 'status-active' if status == 'active' else 'status-ended'

    # Create clickable card
    col1, col2, col3 = st.columns([3, 2, 1])

    with col1:
        st.markdown(f"**{conv.get('title', f'Consultation #{conv[\"id\"]}')}**")
        st.caption(f"👤 {participant_name}")

    with col2:
        st.markdown(f"<span class='{status_class}'>{status.capitalize()}</span>", unsafe_allow_html=True)
        st.caption(f"🕐 {format_date(conv.get('created_at'))}")

    with col3:
        st.caption(f"💬 {conv.get('message_count', 0)} messages")
        if conv.get('has_summary'):
            st.caption("✨ Summary")

    st.markdown("---")


def show_new_conversation_modal():
    """Show modal to create new conversation"""
    with st.expander("➕ Start New Consultation", expanded=True):
        with st.form("new_conversation_form"):
            # Language selection
            lang_options = get_language_options()
            patient_language = st.selectbox(
                "Patient's Language",
                options=list(lang_options.keys()),
                index=0,
                key="new_conv_language"
            )

            # Get patients (for doctors)
            patients = get_all_patients()
            if patients:
                patient_options = {f"{p['first_name']} {p['last_name']} ({p['email']})": p['id']
                                   for p in patients}
                selected_patient = st.selectbox(
                    "Select Patient",
                    options=list(patient_options.keys()),
                    key="new_conv_patient"
                )
            else:
                st.warning("No patients found. Using demo patient.")
                selected_patient = "Demo Patient (patient@demo.com)"

            col1, col2 = st.columns(2)
            with col1:
                submit = st.form_submit_button("Start Consultation", use_container_width=True)
            with col2:
                cancel = st.form_submit_button("Cancel", use_container_width=True)

            if submit:
                try:
                    doctor_id = get_current_user()['id']
                    patient_id = patient_options.get(selected_patient, 2)  # Default to demo patient
                    patient_lang_code = lang_options[patient_language]
                    title = f"Consultation - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

                    # Check for active conversation
                    existing = get_active_conversation(doctor_id, patient_id)

                    if existing:
                        st.warning(f"⚠️ An active consultation with this patient already exists (started on {format_date(existing['created_at'])}).")

                        action = st.radio(
                            "What would you like to do?",
                            ["Continue existing conversation", "End existing and start new"],
                            key="existing_conv_action"
                        )

                        if st.button("Proceed", key="proceed_existing"):
                            if action == "Continue existing conversation":
                                set_selected_conversation(existing)
                                set_current_page('conversation')
                                st.rerun()
                            else:
                                update_conversation_status(existing['id'], 'ended')
                                conv_id = create_conversation(doctor_id, patient_id, patient_lang_code, title)
                                if conv_id:
                                    st.success("New consultation started!")
                                    refresh_data()
                                    st.rerun()
                                else:
                                    st.error("Failed to create consultation.")
                    else:
                        conv_id = create_conversation(doctor_id, patient_id, patient_lang_code, title)
                        if conv_id:
                            st.success("New consultation started!")
                            refresh_data()
                            st.rerun()
                        else:
                            st.error("Failed to create consultation.")

                except Exception as e:
                    st.error(f"Error: {str(e)}")


def show():
    """Main dashboard page"""
    user = get_current_user()

    if not user:
        st.error("Please login first")
        return

    is_doctor = has_role('doctor')

    # Header
    col1, col2, col3 = st.columns([3, 2, 1])
    with col1:
        st.title(f"{'Doctor' if is_doctor else 'Patient'} Dashboard")
    with col3:
        if st.button("🚪 Logout", use_container_width=True):
            logout_user()
            st.rerun()

    st.markdown("---")

    # Show new conversation button for doctors
    if is_doctor:
        show_new_conversation_modal()
        st.markdown("---")

    # Search
    search_term = st.text_input("🔍 Search conversations...", placeholder="Search by name, title...")

    # Load conversations
    conversations = get_conversations_by_user(user['id'], user['role'])

    if search_term:
        from utils.database import search_conversations
        conversations = search_conversations(user['id'], user['role'], search_term)

    # Display conversations
    if not conversations:
        st.markdown("""
        <div style="text-align: center; padding: 3rem;">
            <p style="font-size: 3rem; margin: 0;">💬</p>
            <h3>No conversations yet</h3>
            <p style="color: #6b7280;">
                Start a new consultation to communicate with patients
            </p>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.subheader(f"Conversations ({len(conversations)})")

        for conv in conversations:
            # Make each conversation clickable
            with st.container():
                show_conversation_card(conv)

                # Add click handler
                if st.button(f"View Conversation {conv['id']}", key=f"view_{conv['id']}", use_container_width=True):
                    conv_details = get_conversation_by_id(conv['id'], user['id'])
                    if conv_details:
                        set_selected_conversation(conv_details)
                        set_current_page('conversation')
                        st.rerun()


def get_conversation_by_id(conv_id, user_id):
    """Helper to get conversation details"""
    from utils.database import get_conversation_by_id as get_conv
    return get_conv(conv_id, user_id)
