const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./authMiddleware');

const app = express();
const port = 3002;
const JWT_SECRET = 'minhaChave';

app.use(cors());
app.use(bodyParser.json());

// --- ROTA DE LOGIN SEGURA ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // MITIGAÇÃO 1: Prevenção de SQL Injection com Parameterized Queries.
    // O driver 'pg' substitui $1 pelo valor de 'username' de forma segura.
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];

    // MITIGAÇÃO 2: Comparando a senha fornecida com o hash armazenado no banco.
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas. Ataque não funciona mais O.o' });
    }

    // MITIGAÇÃO 3: Gerando um token JWT em vez de enviar dados do usuário.
    // O token contém informações não sensíveis que identificam o usuário.
    const tokenPayload = { id: user.id, username: user.username };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
    
    // Enviamos apenas o token para o cliente.
    res.status(200).json({ message: 'Login bem-sucedido!', token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});

// --- ROTA DE PERFIL PROTEGIDA ---
// Note que a rota agora é /profile, sem o :username. A identidade vem do token.
// Adicionamos o 'authMiddleware' aqui. Ele rodará ANTES do nosso código da rota.
app.get('/profile', authMiddleware, async (req, res) => {
  // Graças ao middleware, 'req.user' contém os dados do token (id e username).
  // Não confiamos mais em parâmetros da URL!
  const usernameFromToken = req.user.username;

  try {
    const result = await pool.query('SELECT id, username, email, full_name FROM users WHERE username = $1', [usernameFromToken]);
    
    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      // Isso não deveria acontecer se o token foi gerado corretamente, mas é uma boa prática.
      res.status(404).json({ message: 'Usuário do token não encontrado.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor.' });
  }
});


app.listen(port, () => {
  console.log(`Servidor MITIGADO rodando em http://localhost:${port}`);
});