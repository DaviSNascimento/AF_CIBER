const jwt = require('jsonwebtoken');


const JWT_SECRET = 'minhaChave';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Se não houver token, o acesso é negado
  if (token == null) {
    return res.status(401).json({ message: 'Acesso negado: token não fornecido.' });
  }

  // Verificamos se o token é válido e não foi adulterado
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Acesso proibido: token inválido ou expirado.' });
    }
    // Se o token for válido, adicionamos os dados do usuário (payload do token) à requisição
    req.user = user;
    next(); // Permite que a requisição continue para a rota final
  });
}

module.exports = authMiddleware;