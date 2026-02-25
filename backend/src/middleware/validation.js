const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

const validateRegistration = (req, res, next) => {
  const { email, password, role, firstName, lastName } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: { message: 'Valid email is required' } });
  }

  if (!password || !validatePassword(password)) {
    return res.status(400).json({ error: { message: 'Password must be at least 8 characters' } });
  }

  if (!role || !['doctor', 'patient'].includes(role)) {
    return res.status(400).json({ error: { message: 'Valid role (doctor/patient) is required' } });
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ error: { message: 'First name and last name are required' } });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: { message: 'Valid email is required' } });
  }

  if (!password) {
    return res.status(400).json({ error: { message: 'Password is required' } });
  }

  next();
};

const validateMessage = (req, res, next) => {
  const { conversationId, originalText } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: { message: 'Conversation ID is required' } });
  }

  if (!originalText && !req.file) {
    return res.status(400).json({ error: { message: 'Message text or audio is required' } });
  }

  if (originalText && originalText.length > 2000) {
    return res.status(400).json({ error: { message: 'Message text exceeds maximum length of 2000 characters' } });
  }

  next();
};

const validateConversation = (req, res, next) => {
  const { patientId, patientLanguage } = req.body;

  if (!patientId) {
    return res.status(400).json({ error: { message: 'Patient ID is required' } });
  }

  if (!patientLanguage) {
    return res.status(400).json({ error: { message: 'Patient language is required' } });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateMessage,
  validateConversation
};
