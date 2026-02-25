import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { conversationsAPI, summariesAPI, messagesAPI } from '../services/api';
import { getSocket, joinConversation, leaveConversation, sendMessage } from '../services/socket';
import {
  ArrowLeft,
  Send,
  Mic,
  Square,
  PhoneOff,
  FileText,
  Sparkles,
  User,
  Volume2,
  MessageSquare
} from 'lucide-react';

const ConversationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  useEffect(() => {
    loadConversation();
    setupSocket();

    return () => {
      // Clean up socket listeners
      const socket = getSocket();
      if (socket && socketRef.current) {
        socket.off('conversation-joined');
        socket.off('new-message');
        socket.off('user-typing');
        socket.off('user-stop-typing');
      }
      leaveConversation();
    };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    try {
      const response = await conversationsAPI.get(id);
      setConversation(response.data.conversation);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    joinConversation(id);
    const socket = getSocket();

    if (socket) {
      socketRef.current = socket;

      socket.on('conversation-joined', (data) => {
        console.log('Joined conversation:', data);
      });

      socket.on('new-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('user-typing', () => {
        setOtherUserTyping(true);
        setTimeout(() => setOtherUserTyping(false), 3000);
      });

      socket.on('user-stop-typing', () => {
        setOtherUserTyping(false);
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const tempMessage = {
      id: Date.now(),
      conversation_id: parseInt(id),
      sender_id: user.id,
      sender_role: user.role,
      original_text: newMessage,
      translated_text: 'Translating...',
      created_at: new Date().toISOString(),
      temp: true
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    sendMessage({
      conversationId: parseInt(id),
      originalText: newMessage,
      messageType: 'text'
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      const socket = getSocket();
      if (socket) {
        socket.emit('typing', { conversationId: id });
      }
      setTimeout(() => {
        setIsTyping(false);
        const s = getSocket();
        if (s) s.emit('stop-typing', { conversationId: id });
      }, 2000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        // In production, upload audio to server and get URL
        // For now, create a temporary URL
        const audioUrl = URL.createObjectURL(audioBlob);
        sendAudioMessage(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const sendAudioMessage = async (audioBlob) => {
    // In production, upload audio and get transcription
    const tempMessage = {
      id: Date.now(),
      conversation_id: parseInt(id),
      sender_id: user.id,
      sender_role: user.role,
      original_text: '[Audio message]',
      translated_text: 'Processing...',
      audio_url: URL.createObjectURL(audioBlob),
      message_type: 'audio',
      created_at: new Date().toISOString(),
      temp: true
    };

    setMessages(prev => [...prev, tempMessage]);

    sendMessage({
      conversationId: parseInt(id),
      originalText: '[Voice message - transcribing...]',
      audioData: { url: tempMessage.audio_url },
      messageType: 'audio'
    });
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const response = await summariesAPI.generate(id);
      setSummary(response.data.summary);
      setShowSummary(true);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('Failed to generate summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleEndConversation = async () => {
    try {
      await conversationsAPI.updateStatus(id, 'ended');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary"
              style={{ padding: '0.5rem' }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>
                {conversation?.title || `Consultation #${id}`}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                {user.role === 'doctor'
                  ? `Patient: ${conversation?.patient_first_name} ${conversation?.patient_last_name}`
                  : `Doctor: ${conversation?.doctor_first_name} ${conversation?.doctor_last_name}`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {user.role === 'doctor' && (
              <>
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.875rem' }}
                >
                  {generatingSummary ? (
                    <>
                      <div className="spinner"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      AI Summary
                    </>
                  )}
                </button>
                <button
                  onClick={handleEndConversation}
                  className="btn btn-danger"
                  style={{ fontSize: '0.875rem' }}
                >
                  <PhoneOff size={16} />
                  End
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Panel */}
      {showSummary && summary && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: '#10b981' }} />
              Medical Summary
            </h3>
            <button
              onClick={() => setShowSummary(false)}
              className="btn btn-secondary"
              style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
            >
              Close
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <strong style={{ color: '#6b7280' }}>Symptoms:</strong>
              <p style={{ color: '#111827', marginTop: '0.25rem' }}>{summary.symptoms || 'Not specified'}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280' }}>Diagnosis:</strong>
              <p style={{ color: '#111827', marginTop: '0.25rem' }}>{summary.diagnosis || 'Pending'}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280' }}>Medications:</strong>
              <p style={{ color: '#111827', marginTop: '0.25rem' }}>{summary.medications || 'None prescribed'}</p>
            </div>
            <div>
              <strong style={{ color: '#6b7280' }}>Follow-up:</strong>
              <p style={{ color: '#111827', marginTop: '0.25rem' }}>{summary.follow_up_actions || 'None specified'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        background: 'white',
        borderRadius: '0.5rem',
        marginBottom: '1rem'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <MessageSquare size={48} style={{ margin: '0 auto 1rem' }} />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((message) => {
              const isOwn = message.sender_id === user.id;
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: '0.5rem'
                  }}
                >
                  {!isOwn && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4f46e5',
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>
                      {message.sender_role === 'doctor' ? 'D' : 'P'}
                    </div>
                  )}

                  <div style={{
                    maxWidth: '70%',
                    background: isOwn ? '#2563eb' : '#f3f4f6',
                    color: isOwn ? 'white' : '#111827',
                    padding: '0.75rem 1rem',
                    borderRadius: '1rem',
                    borderBottomLeftRadius: isOwn ? '1rem' : '0.25rem',
                    borderBottomRightRadius: isOwn ? '0.25rem' : '1rem'
                  }}>
                    {message.message_type === 'audio' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <Mic size={16} />
                          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Audio Message</span>
                        </div>
                        {message.audio_url && (
                          <audio controls style={{ width: '200px', height: '32px' }}>
                            <source src={message.audio_url} type="audio/webm" />
                          </audio>
                        )}
                        {message.original_text && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.9 }}>
                            {message.original_text}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: '1.5' }}>
                          {message.original_text}
                        </p>
                        {message.translated_text && message.translated_text !== message.original_text && (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem'
                          }}>
                            <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>Translated: </span>
                            {message.translated_text}
                          </div>
                        )}
                      </>
                    )}
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.75rem',
                      opacity: 0.7
                    }}>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            {otherUserTyping && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className="btn btn-secondary"
            disabled={isRecording}
            style={{ padding: '0.75rem' }}
          >
            {isRecording ? <Square size={20} style={{ color: '#ef4444' }} /> : <Mic size={20} />}
          </button>

          <div style={{ flex: 1 }}>
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="input"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                resize: 'none'
              }}
              disabled={isRecording}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isRecording}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.25rem' }}
          >
            <Send size={20} />
          </button>
        </div>
        {isRecording && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', marginRight: '0.5rem', animation: 'pulse 1s infinite' }}></span>
            Recording... Release to send
          </p>
        )}
      </div>
    </div>
  );
};

export default ConversationPage;
