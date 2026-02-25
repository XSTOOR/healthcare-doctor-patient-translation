const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create({ email, password, role, firstName, lastName }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (email, password, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [email, hashedPassword, role, firstName, lastName]);
    return result.insertId;
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await pool.execute(query, [email]);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT id, email, role, first_name, last_name, created_at FROM users WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async listByRole(role, limit = 50) {
    const query = `
      SELECT id, email, role, first_name, last_name, created_at
      FROM users
      WHERE role = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const [rows] = await pool.execute(query, [role, limit]);
    return rows;
  }
}

module.exports = User;
