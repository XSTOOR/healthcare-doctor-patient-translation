const pool = require('../config/database');

class Conversation {
  static async create({ doctorId, patientId, doctorLanguage, patientLanguage, title }) {
    const query = `
      INSERT INTO conversations (doctor_id, patient_id, doctor_language, patient_language, title)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [
      doctorId,
      patientId,
      doctorLanguage || 'en',
      patientLanguage,
      title
    ]);
    return result.insertId;
  }

  static async findById(id) {
    const query = `
      SELECT c.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.email as doctor_email,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.email as patient_email
      FROM conversations c
      JOIN users d ON c.doctor_id = d.id
      JOIN users p ON c.patient_id = p.id
      WHERE c.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async findByUserId(userId, role) {
    const column = role === 'doctor' ? 'doctor_id' : 'patient_id';
    const query = `
      SELECT c.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT content FROM summaries WHERE conversation_id = c.id) as summary
      FROM conversations c
      JOIN users d ON c.doctor_id = d.id
      JOIN users p ON c.patient_id = p.id
      WHERE c.${column} = ?
      ORDER BY c.updated_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows;
  }

  static async updateStatus(id, status) {
    const query = `
      UPDATE conversations
      SET status = ?, ${status === 'ended' ? 'ended_at = NOW()' : ''}
      WHERE id = ?
    `;
    await pool.execute(query, [status, id]);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    const query = `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);
  }

  static async getActiveConversation(doctorId, patientId) {
    const query = `
      SELECT * FROM conversations
      WHERE doctor_id = ? AND patient_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [doctorId, patientId]);
    return rows[0];
  }

  static async search(userId, role, searchTerm, status = null, dateFrom = null, dateTo = null, limit = 20, offset = 0) {
    const column = role === 'doctor' ? 'doctor_id' : 'patient_id';
    let query = `
      SELECT DISTINCT c.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM conversations c
      JOIN users d ON c.doctor_id = d.id
      JOIN users p ON c.patient_id = p.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.${column} = ?
      AND (
        c.title LIKE ?
        OR m.original_text LIKE ?
        OR m.translated_text LIKE ?
      )
    `;

    const params = [userId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (dateFrom) {
      query += ' AND c.created_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND c.created_at <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findByUserId(userId, role, status = null, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC') {
    const column = role === 'doctor' ? 'doctor_id' : 'patient_id';
    let query = `
      SELECT c.*,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM conversations c
      JOIN users d ON c.doctor_id = d.id
      JOIN users p ON c.patient_id = p.id
      WHERE c.${column} = ?
    `;

    const params = [userId];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ` ORDER BY c.${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }
}

module.exports = Conversation;
