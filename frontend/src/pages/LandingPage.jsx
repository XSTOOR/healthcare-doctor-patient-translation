import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleRoleSelect = async (role) => {
    try {
      // Call the demo login endpoint with the selected role
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      });

      if (response.ok) {
        const data = await response.json();
        // Store token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Update AuthContext state
        setUser(data.user);

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        console.error('Failed to login with demo account');
      }
    } catch (error) {
      console.error('Error selecting role:', error);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <div className="landing-header">
          <div className="logo-section">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="28" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path d="M20 30C20 24.4772 24.4772 20 30 20C35.5228 20 40 24.4772 40 30C40 35.5228 35.5228 40 30 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              <path d="M30 20V12M30 48V40M20 30H12M48 30H40" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <h1>Healthcare Translation</h1>
            <p>Breaking language barriers in healthcare</p>
          </div>
        </div>

        <div className="role-selection">
          <h2>Select Your Role</h2>
          <p className="subtitle">Choose how you want to use the platform</p>

          <div className="role-cards">
            <button
              className="role-card doctor-card"
              onClick={() => handleRoleSelect('doctor')}
            >
              <div className="role-icon doctor-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32 4C28.5 4 25.5 7 25.5 10.5V20H20C16.5 20 13.5 23 13.5 26.5V44C13.5 47.5 16.5 50.5 20 50.5H25.5V55.5C25.5 57.5 27 59 29 59H35C37 59 38.5 57.5 38.5 55.5V50.5H44C47.5 50.5 50.5 47.5 50.5 44V26.5C50.5 23 47.5 20 44 20H38.5V10.5C38.5 7 35.5 4 32 4ZM32 8C33.5 8 34.5 9 34.5 10.5V20H29.5V10.5C29.5 9 30.5 8 32 8ZM20 24H44C45.5 24 46.5 25 46.5 26.5V44C46.5 45.5 45.5 46.5 44 46.5H38.5V55.5H25.5V46.5H20C18.5 46.5 17.5 45.5 17.5 44V26.5C17.5 25 18.5 24 20 24Z" fill="currentColor"/>
                </svg>
              </div>
              <h3>Doctor</h3>
              <p>Access medical consultation tools, manage patients, and generate AI summaries</p>
              <ul className="features">
                <li>Create and manage consultations</li>
                <li>Real-time translation with patients</li>
                <li>Generate medical summaries</li>
                <li>View conversation history</li>
              </ul>
              <span className="select-button">Continue as Doctor</span>
            </button>

            <button
              className="role-card patient-card"
              onClick={() => handleRoleSelect('patient')}
            >
              <div className="role-icon patient-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M32 4C24.5 4 18.5 10 18.5 17.5C18.5 25 24.5 31 32 31C39.5 31 45.5 25 45.5 17.5C45.5 10 39.5 4 32 4ZM32 27C26.5 27 22.5 23 22.5 17.5C22.5 12 26.5 8 32 8C37.5 8 41.5 12 41.5 17.5C41.5 23 37.5 27 32 27ZM12 35C10 35 8.5 36.5 8.5 38.5V44C8.5 45 9 45.5 10 45.5H14.5V55.5C14.5 57.5 16 59 18 59H46C48 59 49.5 57.5 49.5 55.5V45.5H54C55 45.5 55.5 45 55.5 44V38.5C55.5 36.5 54 35 52 35H12ZM18.5 39H22.5V45.5H18.5V39ZM26.5 39H37.5V45.5H26.5V39ZM41.5 39H45.5V45.5H41.5V39ZM18.5 49.5H28.5V55H18.5V49.5ZM32.5 49.5H45.5V55H32.5V49.5Z" fill="currentColor"/>
                </svg>
              </div>
              <h3>Patient</h3>
              <p>Communicate with your doctor in your preferred language</p>
              <ul className="features">
                <li>Join consultations</li>
                <li>Real-time message translation</li>
                <li>Send voice messages</li>
                <li>Access consultation summaries</li>
              </ul>
              <span className="select-button">Continue as Patient</span>
            </button>
          </div>
        </div>

        <div className="landing-footer">
          <p>Demo Mode - No authentication required</p>
          <p className="features-list">
            ✓ Real-time Translation &nbsp;•&nbsp;
            ✓ Audio Messages &nbsp;•&nbsp;
            ✓ AI Medical Summaries &nbsp;•&nbsp;
            ✓ Conversation History
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
