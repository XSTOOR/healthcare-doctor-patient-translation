import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { conversationsAPI, summariesAPI, messagesAPI } from '../services/api';
import {
  Plus,
  Search,
  MessageSquare,
  Clock,
  User,
  FileText,
  Sparkles,
  X,
  ArrowLeft,
  Send
} from 'lucide-react';

const DashboardPage = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newConversation, setNewConversation] = useState({
    patientEmail: '',
    patientLanguage: 'en'
  });
  const [selectedConversation, setSelectedConversation] = useState(null); // For viewing in modal
  const [conversationMessages, setConversationMessages] = useState([]); // Messages for selected conversation
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Close conversation view modal
  const closeConversationModal = () => {
    setSelectedConversation(null);
    setConversationMessages([]);
    setShowViewModal(false);
  };

  // Open conversation view modal
  const openConversationModal = async (conversation) => {
    setSelectedConversation(conversation);
    setShowViewModal(true);

    // Load messages for this conversation
    setLoadingMessages(true);
    try {
      const response = await messagesAPI.get(conversation.id);
      setConversationMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      alert('Failed to load conversation messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const filtered = conversations.filter(conv =>
        conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.patient_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.doctor_first_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchTerm, conversations]);

  const loadConversations = async () => {
    try {
      const response = await conversationsAPI.list();
      setConversations(response.data.conversations);
      setFilteredConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConversation = async (e) => {
    e.preventDefault();
    try {
      const response = await conversationsAPI.create({
        patientId: 2, // Demo patient Maria Garcia
        patientLanguage: newConversation.patientLanguage,
        title: `Consultation - ${new Date().toLocaleDateString()}`
      });
      // If the API returns a reused conversation, navigate to it
      if (response.data.reused) {
        navigate(`/conversation/${response.data.conversation.id}`);
      } else {
        setShowNewModal(false);
        setNewConversation({
          patientEmail: '',
          patientLanguage: 'en'
        });
        loadConversations();
      }
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.error?.existingConversation) {
        // Active conversation exists; ask user what to do
        const existing = error.response.data.error.existingConversation;
        const shouldReuse = window.confirm(`An active conversation with this patient already exists (started on ${new Date(existing.created_at).toLocaleDateString()}).\n\nClick OK to continue the existing conversation.\nClick Cancel to end it and start a new one.`);
        if (shouldReuse) {
          // Reuse existing conversation
          try {
            const reuseResponse = await conversationsAPI.create({
              patientId: 2,
              patientLanguage: newConversation.patientLanguage,
              title: `Consultation - ${new Date().toLocaleDateString()}`,
              action: 'reuse'
            });
            navigate(`/conversation/${reuseResponse.data.conversation.id}`);
            setShowNewModal(false);
          } catch (reuseError) {
            console.error('Failed to reuse conversation:', reuseError);
            alert('Failed to reuse conversation: ' + (reuseError.response?.data?.error?.message || reuseError.message));
          }
        } else {
          // End existing and create new
          try {
            const endResponse = await conversationsAPI.create({
              patientId: 2,
              patientLanguage: newConversation.patientLanguage,
              title: `Consultation - ${new Date().toLocaleDateString()}`,
              action: 'end_and_create'
            });
            setShowNewModal(false);
            setNewConversation({
              patientEmail: '',
              patientLanguage: 'en'
            });
            loadConversations();
          } catch (endError) {
            console.error('Failed to end and create conversation:', endError);
            alert('Failed to create new conversation: ' + (endError.response?.data?.error?.message || endError.message));
          }
        }
      } else {
        console.error('Failed to create conversation:', error);
        alert('Failed to create conversation: ' + (error.response?.data?.error?.message || error.message));
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getLanguageName = (code) => {
    const languages = {
      'en': 'English',
      'es': 'Spanish',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'fr': 'French',
      'de': 'German'
    };
    return languages[code] || code;
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': '#10b981',
      'ended': '#6b7280',
      'archived': '#9ca3af'
    };
    return colors[status] || '#6b7280';
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const response = await messagesAPI.send(selectedConversation.id, {
        text: newMessage,
        senderRole: user.role
      });

      console.log('Message sent successfully:', response.data);

      // Use the returned message data from server
      const newMessageData = response.data.data || {
        id: Date.now(),
        original_text: newMessage,
        translated_text: newMessage,
        sender_id: user.id,
        sender_first_name: user.first_name,
        sender_role: user.role,
        created_at: new Date().toISOString()
      };

      // Add message to local state
      setConversationMessages([
        ...conversationMessages,
        newMessageData
      ]);

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        alert(`Failed to send message: ${error.response.data?.error?.message || error.response.data?.message || 'Unknown error'}`);
      } else {
        alert('Failed to send message. Please try again.');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
              {hasRole('doctor') ? 'Doctor Dashboard' : 'Patient Portal'}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              {hasRole('doctor')
                ? 'Manage consultations and communicate with patients'
                : 'View your consultations and communicate with your doctor'}
            </p>
          </div>
          {hasRole('doctor') && (
            <button
              onClick={() => setShowNewModal(true)}
              className="btn btn-primary"
            >
              <Plus size={18} />
              New Consultation
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={20}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }}
          />
          <input
            type="text"
            placeholder="Search conversations..."
            className="input"
            style={{ paddingLeft: '3rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading conversations...</p>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <MessageSquare size={48} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
            {searchTerm ? 'No conversations found' : 'No conversations yet'}
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {searchTerm
              ? 'Try a different search term'
              : hasRole('doctor')
                ? 'Start a new consultation to communicate with patients'
                : 'Your consultations will appear here'}
          </p>
          {hasRole('doctor') && !searchTerm && (
            <button onClick={() => setShowNewModal(true)} className="btn btn-primary">
              <Plus size={18} />
              Start Consultation
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => openConversationModal(conversation)}
              className="card"
              style={{
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      {conversation.title || `Consultation #${conversation.id}`}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      background: conversation.status === 'active' ? '#d1fae5' : '#f3f4f6',
                      color: conversation.status === 'active' ? '#065f46' : '#6b7280'
                    }}>
                      {conversation.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <User size={16} />
                      <span>
                        {hasRole('doctor')
                          ? `${conversation.patient_first_name} ${conversation.patient_last_name}`
                          : `${conversation.doctor_first_name} ${conversation.doctor_last_name}`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={16} />
                      <span>{formatDate(conversation.created_at)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <span style={{ color: '#6b7280' }}>
                      {conversation.message_count || 0} messages
                    </span>
                    {conversation.summary && (
                      <>
                        <span style={{ color: '#d1d5db' }}>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
                          <Sparkles size={14} />
                          Summary generated
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <MessageSquare size={20} style={{ color: '#9ca3af', flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>
              Start New Consultation
            </h2>
            <form onSubmit={handleCreateConversation}>
              <div className="form-group">
                <label htmlFor="patientLanguage" className="label">Patient's Language</label>
                <select
                  id="patientLanguage"
                  className="input"
                  value={newConversation.patientLanguage}
                  onChange={(e) => setNewConversation({
                    ...newConversation,
                    patientLanguage: e.target.value
                  })}
                  required
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="zh">Chinese</option>
                  <option value="ar">Arabic</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="hi">Hindi</option>
                  <option value="vi">Vietnamese</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Start Consultation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conversation View Modal */}
      {showViewModal && selectedConversation && (
        <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}>
        <div className="card" style={{ maxWidth: '90%', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Modal Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e0e0e6' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
              Consultation
            </h3>
            <button
              onClick={closeConversationModal}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
                color: '#6b7280'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Conversation Info */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <strong>Patient:</strong> {selectedConversation.patient_first_name} {selectedConversation.patient_last_name}
              </div>
              <div>
                <strong>Language:</strong> {getLanguageName(selectedConversation.patient_language)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Status:</strong>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  background: getStatusColor(selectedConversation.status),
                  color: 'white',
                  fontWeight: '500'
                }}>
                  {selectedConversation.status}
                </span>
              </div>
              <div>
                <strong>Started:</strong> {formatDate(selectedConversation.created_at)}
              </div>
            </div>
          </div>

          {/* Messages Section */}
          {loadingMessages ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner"></div>
              <p style={{ color: '#6b7280' }}>Loading messages...</p>
            </div>
          ) : (
            <>
              {/* Messages Header */}
              <div style={{
                borderBottom: '1px solid #e0e0e6',
                paddingBottom: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                  Messages ({conversationMessages.length})
                </h4>
                <button
                  onClick={() => setShowViewModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: '0.5rem'
                  }}
                >
                  Close
                </button>
              </div>

              {/* Messages List */}
              <div style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                paddingRight: '0.5rem'
              }}>
                {conversationMessages.map((msg, index) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        marginBottom: '1rem',
                        padding: '1rem',
                        background: isOwn ? 'rgba(17, 94, 89, 0.05)' : 'rgba(243, 243, 243, 0.03)',
                        borderRadius: '12px',
                        borderLeft: isOwn ? 'none' : '3px solid #d1d5db'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          marginBottom: '0.25rem',
                          color: '#6b7280'
                        }}>
                          {isOwn ? (hasRole('doctor') ? 'You' : msg.sender_first_name) : selectedConversation.patient_first_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {msg.translated_text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* New Message Form */}
              <div style={{
                borderTop: '1px solid #e0e0e6',
                paddingTop: '1rem',
                paddingBottom: '1rem'
              }}>
                <div className="form-group">
                  <textarea
                    id="messageInput"
                    className="input"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={3}
                    style={{ width: '100%', resize: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowViewModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {sendingMessage ? (
                      <>
                        <span className="spinner-button"></span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span style={{ marginLeft: '0.5rem' }}>Send Message</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </div>
  );
};

export default DashboardPage;
