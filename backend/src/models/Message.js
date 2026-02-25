const pool = require('../config/database');

class Message {
  static async create({ conversationId, senderId, senderRole, originalText, translatedText, audioUrl, audioDuration, messageType }) {
    const query = `
      INSERT INTO messages (
        conversation_id, sender_id, sender_role, original_text,
        translated_text, audio_url, audio_duration, message_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      conversationId,
      senderId,
      senderRole,
      originalText,
      translatedText,
      audioUrl || null,
      audioDuration || null,
      messageType || 'text'
    ];
    const [result] = await pool.execute(query, params);
    return result.insertId;
  }

  static async findByConversationId(conversationId) {
    const query = `
      SELECT m.*,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `;
    const [rows] = await pool.execute(query, [conversationId]);
    return rows;
  }

  static async findById(id) {
    const query = 'SELECT * FROM messages WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async getRecentMessages(conversationId, limit = 50) {
    const query = `
      SELECT m.*,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    const [rows] = await pool.execute(query, [conversationId, limit]);
    return rows.reverse();
  }

  static async searchInConversation(conversationId, searchTerm) {
    const query = `
      SELECT * FROM messages
      WHERE conversation_id = ?
      AND (original_text LIKE ? OR translated_text LIKE ?)
      ORDER BY created_at ASC
    `;
    const pattern = `%${searchTerm}%`;
    const [rows] = await pool.execute(query, [conversationId, pattern, pattern]);
    return rows;
  }

  static async findByConversationId(conversationId, includeDeleted = false) {
    const query = `
      SELECT m.*,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `;
    const [rows] = await pool.execute(query, [conversationId]);
    return rows;
  }

  static async updateAudioUrl(filename, newAudioUrl) {
    const query = `
      UPDATE messages
      SET audio_url = ?
      WHERE audio_url LIKE ?
    `;
    const pattern = `%/audio/${filename}`;
    const [result] = await pool.execute(query, [newAudioUrl, pattern]);
    return result.affectedRows;
  }

  static async search(userId, searchTerm, dateFrom = null, dateTo = null, limit = 20, offset = 0) {
    let query = `
      SELECT DISTINCT m.*,
        c.doctor_id,
        c.patient_id,
        c.title as conversation_title
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.doctor_id = ? OR c.patient_id = ?)
      AND (m.original_text LIKE ? OR m.translated_text LIKE ?)
    `;

    const params = [userId, userId, `%${searchTerm}%`, `%${searchTerm}%`];

    if (dateFrom) {
      query += ' AND m.created_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND m.created_at <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async markAsRead(messageId, userId) {
    const query = `
      UPDATE messages
      SET read_by = ?,
          read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await pool.execute(query, [userId, messageId]);
    return result.affectedRows;
  }

  static async markConversationAsRead(conversationId, userId) {
    const query = `
      UPDATE messages
      SET read_by = ?,
          read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
      AND sender_id != ?
    `;
    const [result] = await pool.execute(query, [userId, conversationId, userId]);
    return result.affectedRows;
  }

  static async getUnreadCount(conversationId, userId) {
    const query = `
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.conversation_id = ?
      AND (c.doctor_id = ? OR c.patient_id = ?)
      AND m.sender_id != ?
      AND (m.read_by IS NULL OR m.read_by != ?)
    `;
    const [rows] = await pool.execute(query, [conversationId, userId, userId, userId, userId]);
    return rows[0].count;
  }
}

module.exports = Message;
