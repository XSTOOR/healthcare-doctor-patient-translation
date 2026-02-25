"""
Conversation/Chat page
"""
import streamlit as st
from datetime import datetime
from utils.database import (
    get_conversation_by_id,
    get_messages_by_conversation,
    create_message,
    get_summary_by_conversation,
    create_summary
)
from utils.session import (
    get_current_user,
    get_selected_conversation,
    set_current_page,
    has_role,
    clear_conversation
)
from utils.translation import translate_text, get_language_name, get_language_options
from utils.database import get_all_patients
import random


def show():
    """Main conversation page"""
    user = get_current_user()
    conv = get_selected_conversation()

    if not user or not conv:
        st.error("No conversation selected")
        set_current_page('dashboard')
        st.rerun()
        return

    is_doctor = has_role('doctor')

    # Header
    col1, col2, col3 = st.columns([3, 1, 1])

    with col1:
        st.title(f"💬 Consultation #{conv['id']}")
        st.caption(f"Started: {datetime.strptime(conv['created_at'], '%Y-%m-%d %H:%M:%S').strftime('%B %d, %Y at %I:%M %p')}")

    with col2:
        if st.button("← Back to Dashboard", use_container_width=True):
            clear_conversation()
            st.rerun()

    with col3:
        if is_doctor and conv['status'] == 'active':
            if st.button("✨ Generate Summary", use_container_width=True):
                generate_ai_summary(conv, user)

    st.markdown("---")

    # Conversation info
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Doctor", f"{conv.get('doctor_first_name', '')} {conv.get('doctor_last_name', '')}")

    with col2:
        st.metric("Patient", f"{conv.get('patient_first_name', '')} {conv.get('patient_last_name', '')}")

    with col3:
        lang_name = get_language_name(conv.get('patient_language', 'en'))
        st.metric("Patient Language", lang_name)

    with col4:
        st.metric("Status", conv.get('status', 'active').capitalize())

    st.markdown("---")

    # Tabs for chat and summary
    tab1, tab2, tab3 = st.tabs(["💬 Chat", "📋 Summary", "ℹ️ Details"])

    with tab1:
        show_chat_tab(conv, user, is_doctor)

    with tab2:
        show_summary_tab(conv, user, is_doctor)

    with tab3:
        show_details_tab(conv)


def show_chat_tab(conv, user, is_doctor):
    """Show chat interface"""

    # Load messages
    messages = get_messages_by_conversation(conv['id'])

    # Display messages
    if not messages:
        st.info("No messages yet. Start the conversation!")
    else:
        for msg in messages:
            is_own = msg['sender_id'] == user['id']

            # Determine message style
            if is_own:
                st.markdown(f"""
                <div class="message-bubble message-own">
                    <strong>You ({msg['sender_role']})</strong><br/>
                    <small>{msg.get('created_at', '')}</small><br/><br/>
                    {msg.get('translated_text', msg.get('original_text', ''))}
                </div>
                """, unsafe_allow_html=True)
            else:
                sender_name = msg.get('sender_first_name', 'Unknown')
                st.markdown(f"""
                <div class="message-bubble message-other">
                    <strong>{sender_name} ({msg['sender_role']})</strong><br/>
                    <small>{msg.get('created_at', '')}</small><br/><br/>
                    {msg.get('translated_text', msg.get('original_text', ''))}
                </div>
                """, unsafe_allow_html=True)

    st.markdown("---")

    # Message input
    if conv['status'] == 'active':
        st.subheader("Send a Message")

        with st.form("send_message_form"):
            message_text = st.text_area(
                "Type your message...",
                placeholder="Enter your message here...",
                height=100,
                key="message_input"
            )

            # Show translation preview
            if message_text and is_doctor:
                target_lang = conv.get('patient_language', 'en')
                lang_name = get_language_name(target_lang)

                col1, col2 = st.columns(2)
                with col1:
                    if st.form_submit_button("Preview Translation", use_container_width=True):
                        with st.spinner("Translating..."):
                            translated = translate_text(message_text, target_lang, 'en')
                            st.info(f"🌐 Translation to {lang_name}:\n\n{translated}")

            col1, col2 = st.columns(2)
            with col1:
                submitted = st.form_submit_button("Send Message", use_container_width=True, type="primary")
            with col2:
                translate_and_send = st.form_submit_button("Translate & Send", use_container_width=True)

            if submitted or translate_and_send:
                if not message_text.strip():
                    st.warning("Please enter a message")
                else:
                    send_message(conv, user, message_text, translate_and_send)
    else:
        st.warning("This conversation has ended. No new messages can be sent.")


def send_message(conv, user, message_text, should_translate):
    """Send a message with optional translation"""
    try:
        sender_role = user['role']

        # Determine translation
        if should_translate:
            if sender_role == 'doctor':
                target_lang = conv.get('patient_language', 'en')
                source_lang = 'en'
            else:
                target_lang = 'en'
                source_lang = conv.get('patient_language', 'en')

            translated = translate_text(message_text, target_lang, source_lang)
            original_text = message_text
            translated_text = translated
        else:
            original_text = message_text
            translated_text = message_text  # No translation

        # Create message
        msg_id = create_message(
            conv['id'],
            user['id'],
            sender_role,
            original_text,
            translated_text
        )

        if msg_id:
            st.success("Message sent!")
            st.rerun()
        else:
            st.error("Failed to send message")

    except Exception as e:
        st.error(f"Error sending message: {str(e)}")


def show_summary_tab(conv, user, is_doctor):
    """Show summary tab"""

    summary = get_summary_by_conversation(conv['id'])

    if summary:
        st.subheader("Medical Summary")

        col1, col2 = st.columns(2)
        with col1:
            st.metric("Generated", datetime.strptime(summary['generated_at'], '%Y-%m-%d %H:%M:%S').strftime('%B %d, %Y'))

        st.markdown("---")

        # Display summary sections
        if summary.get('symptoms'):
            st.subheader("🩺 Symptoms")
            st.write(summary['symptoms'])

        if summary.get('diagnosis'):
            st.subheader("🔍 Diagnosis")
            st.write(summary['diagnosis'])

        if summary.get('medications'):
            st.subheader("💊 Medications")
            st.write(summary['medications'])

        if summary.get('follow_up_actions'):
            st.subheader("📅 Follow-up Actions")
            st.write(summary['follow_up_actions'])

        st.markdown("---")
        st.subheader("📝 Full Summary")
        st.write(summary['content'])

        if is_doctor:
            if st.button("🔄 Regenerate Summary", use_container_width=True):
                generate_ai_summary(conv, user)

    else:
        st.info("No summary generated yet.")

        if is_doctor:
            st.markdown("---")
            st.subheader("Generate AI Summary")

            st.write("Generate a medical summary from the conversation transcript using AI.")

            if st.button("✨ Generate Summary", use_container_width=True, type="primary"):
                generate_ai_summary(conv, user)


def generate_ai_summary(conv, user):
    """Generate AI summary for the conversation"""
    try:
        with st.spinner("Generating summary..."):
            # Get messages
            messages = get_messages_by_conversation(conv['id'])

            if not messages:
                st.warning("No messages to summarize.")
                return

            # Build conversation transcript
            transcript = "\n".join([
                f"{msg.get('sender_first_name', 'Unknown')}: {msg.get('original_text', '')}"
                for msg in messages
            ])

            # Generate mock summary (in production, use actual AI API)
            summary_content = generate_mock_summary(messages, conv)

            # Create structured summary
            symptoms = extract_symptoms(messages)
            diagnosis = extract_diagnosis(messages)
            medications = extract_medications(messages)
            follow_up = extract_follow_up(messages)

            # Save summary
            summary_id = create_summary(
                conv['id'],
                summary_content,
                user['id'],
                symptoms,
                diagnosis,
                medications,
                follow_up
            )

            if summary_id:
                st.success("Summary generated successfully!")
                st.rerun()
            else:
                st.error("Failed to save summary")

    except Exception as e:
        st.error(f"Error generating summary: {str(e)}")


def generate_mock_summary(messages, conv):
    """Generate a mock summary (replace with actual AI in production)"""
    patient_name = f"{conv.get('patient_first_name', '')} {conv.get('patient_last_name', '')}"
    doctor_name = f"{conv.get('doctor_first_name', '')} {conv.get('doctor_last_name', '')}"

    summary = f"""
Consultation Summary

Patient: {patient_name}
Doctor: {doctor_name}
Date: {datetime.now().strftime('%B %d, %Y')}

Overview:
This consultation covered the patient's health concerns and treatment plan.

Key Discussion Points:
"""

    # Extract some key points from messages
    for i, msg in enumerate(messages[:5], 1):
        speaker = msg.get('sender_first_name', 'Unknown')
        text = msg.get('original_text', '')[:100]
        summary += f"\n{i}. {speaker}: {text}..."

    summary += f"""

Recommendations:
- Continue monitoring symptoms
- Follow prescribed medication regimen
- Schedule follow-up appointment if symptoms persist

Next Steps:
- Patient to report any changes in condition
- Review progress in next consultation
"""

    return summary


def extract_symptoms(messages):
    """Extract symptoms from messages (mock implementation)"""
    symptoms_list = []
    for msg in messages:
        text = msg.get('original_text', '').lower()
        # Simple keyword matching (in production, use NLP)
        symptom_keywords = ['pain', 'headache', 'fever', 'nausea', 'fatigue', 'cough', 'dizziness']
        for keyword in symptom_keywords:
            if keyword in text and keyword not in symptoms_list:
                symptoms_list.append(keyword.capitalize())
    return ", ".join(symptoms_list) if symptoms_list else "Not specified"


def extract_diagnosis(messages):
    """Extract diagnosis from messages (mock implementation)"""
    return "Under evaluation - follow-up recommended"


def extract_medications(messages):
    """Extract medications from messages (mock implementation)"""
    meds = []
    for msg in messages:
        if 'medication' in msg.get('original_text', '').lower():
            meds.append("Prescribed medication mentioned")
    return ", ".join(meds) if meds else "No medications prescribed in this consultation"


def extract_follow_up(messages):
    """Extract follow-up actions from messages (mock implementation)"""
    return "Schedule follow-up appointment in 1-2 weeks if symptoms persist"


def show_details_tab(conv):
    """Show conversation details"""
    st.subheader("Conversation Details")

    col1, col2 = st.columns(2)

    with col1:
        st.metric("Conversation ID", conv['id'])
        st.metric("Doctor", f"{conv.get('doctor_first_name', '')} {conv.get('doctor_last_name', '')}")
        st.metric("Doctor Language", get_language_name(conv.get('doctor_language', 'en')))

    with col2:
        st.metric("Patient", f"{conv.get('patient_first_name', '')} {conv.get('patient_last_name', '')}")
        st.metric("Patient Language", get_language_name(conv.get('patient_language', 'en')))
        st.metric("Status", conv.get('status', 'active').capitalize())

    st.markdown("---")

    created = datetime.strptime(conv['created_at'], '%Y-%m-%d %H:%M:%S')
    st.metric("Created", created.strftime('%B %d, %Y at %I:%M %p'))

    if conv.get('ended_at'):
        ended = datetime.strptime(conv['ended_at'], '%Y-%m-%d %H:%M:%S')
        st.metric("Ended", ended.strftime('%B %d, %Y at %I:%M %p'))

    st.metric("Title", conv.get('title', 'N/A'))
