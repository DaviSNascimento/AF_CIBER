const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db/db');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

//Rota de login vulnerável: SQL Injection
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Aplicação da VULNERABILIDADE
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    // como o comando funciona: username = 'admin'  -- ' AND password = 'qualquercoisa'
    // OU ' OR 1 = 1 --
    console.log('POST | Executing query:', query); // logo para visualizarmos o ataque;

    try {
        const result = await pool.query(query);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            res.status(200).json({ message: 'Login bem-sucedido!', user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name } });
        } else {
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor.', error: err.message });
    }
});

// ROTA PROTEGIDA VULNERÁVEL (SEM VERIFICAÇÃO DE SESSÃO)
// Um atacante pode chamar esta rota diretamente se souber o ID ou username de alguém.
app.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const result = await pool.query('SELECT id, username, password, email, full_name FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
    console.log(`GET | Perfil acessado: ${username}`); // Log para monitorar acessos
});


app.listen(port, () => {
    console.log(`Servidor vulnerável rodando em http://localhost:${port}`);
});