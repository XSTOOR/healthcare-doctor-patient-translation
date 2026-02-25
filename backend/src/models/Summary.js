const pool = require('../config/database');

class Summary {
  static async create({ conversationId, content, symptoms, diagnosis, medications, followUpActions, generatedBy }) {
    const query = `
      INSERT INTO summaries (
        conversation_id, content, symptoms, diagnosis,
        medications, follow_up_actions, generated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        content = VALUES(content),
        symptoms = VALUES(symptoms),
        diagnosis = VALUES(diagnosis),
        medications = VALUES(medications),
        follow_up_actions = VALUES(follow_up_actions),
        generated_at = NOW(),
        generated_by = VALUES(generated_by)
    `;
    const [result] = await pool.execute(query, [
      conversationId,
      content,
      symptoms,
      diagnosis,
      medications,
      followUpActions,
      generatedBy
    ]);
    return result.insertId;
  }

  static async findByConversationId(conversationId) {
    const query = 'SELECT * FROM summaries WHERE conversation_id = ?';
    const [rows] = await pool.execute(query, [conversationId]);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM summaries WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM summaries WHERE id = ?';
    await pool.execute(query, [id]);
  }

  static async getAllSummaries(userId, role) {
    const column = role === 'doctor' ? 'doctor_id' : 'patient_id';
    const query = `
      SELECT s.*, c.doctor_id, c.patient_id,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name
      FROM summaries s
      JOIN conversations c ON s.conversation_id = c.id
      JOIN users d ON c.doctor_id = d.id
      JOIN users p ON c.patient_id = p.id
      WHERE c.${column} = ?
      ORDER BY s.generated_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id);

    const query = `
      UPDATE summaries
      SET ${fields.join(', ')}, generated_at = NOW()
      WHERE id = ?
    `;

    const [result] = await pool.execute(query, values);
    return result.insertId || id;
  }

  static async search(userId, searchTerm, dateFrom = null, dateTo = null, limit = 20, offset = 0) {
    let query = `
      SELECT DISTINCT s.*,
        c.doctor_id,
        c.patient_id,
        c.title as conversation_title
      FROM summaries s
      JOIN conversations c ON s.conversation_id = c.id
      WHERE (c.doctor_id = ? OR c.patient_id = ?)
      AND (
        s.content LIKE ?
        OR s.symptoms LIKE ?
        OR s.diagnosis LIKE ?
        OR s.medications LIKE ?
        OR s.follow_up_actions LIKE ?
      )
    `;

    const params = [userId, userId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

    if (dateFrom) {
      query += ' AND s.generated_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND s.generated_at <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY s.generated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows;
  }
}

module.exports = Summary;
