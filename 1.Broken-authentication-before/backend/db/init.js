const pool = require('./db');

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // caso exista uma tabela users, coloquei para remover
    // para evitar conflitos ao criar a nova tabela
    await client.query('DROP TABLE IF EXISTS users;');
    console.log('Tabela "users" antiga removida (se existia).');

    // Cria a tabela de usuários
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL,
        full_name VARCHAR(100) NOT NULL
      );
    `);
    console.log('Tabela "users" criada com sucesso.');

    // Insere um usuário de exemplo
    await client.query(`
      INSERT INTO users (username, password, email, full_name) VALUES
      ('admin', 'admin123', 'admin@example.com', 'Administrador do Sistema'),
      ('davi', 'senha123', 'davi@email.com', 'Davi Nascimento'),
      ('andrey', 'senha456', 'andrey@email.com', 'Andrey Pascoa');
    `);
    console.log('Usuários inseridos com sucesso.');
  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err.stack);
  } finally {
    client.release();
    pool.end(); // Fecha o pool para que o script termine
  }
}

initializeDatabase();