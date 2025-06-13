const pool = require('./db');
const bcrypt = require('bcryptjs'); // Importamos o bcrypt

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('DROP TABLE IF EXISTS users;');
    console.log('Tabela "users" antiga removida (se existia).');

    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL, -- Aumentamos o tamanho para o hash
        email VARCHAR(100) NOT NULL,
        full_name VARCHAR(100) NOT NULL
      );
    `);
    console.log('Tabela "users" criada com sucesso.');

    // --- MITIGAÇÃO: Hashing das senhas ---
    // Criamos um "hash" da senha. O '10' é o "custo" do hash, quão complexo ele é.
    const adminPassword = await bcrypt.hash('admin123', 10);
    const daviPassword = await bcrypt.hash('senha123', 10);
    const andreyPassword = await bcrypt.hash('senha456', 10);


    // Usamos queries parametrizadas ($1, $2) para inserir os dados com segurança
    await client.query(`
      INSERT INTO users (username, password, email, full_name) VALUES
      ('admin', $1, 'admin@example.com', 'Administrador do Sistema'),
      ('davi', $2, 'davi@email.com', 'Davi Nascimento'),
      ('andrey', $3, 'andrey@email.com', 'Andrey Pascoa');
    `, [adminPassword, daviPassword, andreyPassword]);
    console.log('Usuários de exemplo com senhas seguras (hash) inseridos.');

  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

initializeDatabase();