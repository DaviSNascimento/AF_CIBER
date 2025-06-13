# Estudo de Caso: Broken Authentication - Da Vulnerabilidade à Mitigação



> 🚨 Vídeo explicativo no youtube: [https://www.youtube.com/watch?v=4nYthvVog_o](https://youtu.be/4nYthvVog_o)

Este repositório contém o material de um estudo de caso prático sobre a vulnerabilidade **Broken Authentication (Autenticação Quebrada)**, uma das falhas de segurança mais críticas e comuns segundo o OWASP Top 10.

O objetivo é demonstrar, de forma clara e objetiva, como uma implementação insegura de login e gerenciamento de sessão pode ser explorada e, em seguida, como corrigi-la aplicando boas práticas de mercado.

## 📜 Tabela de Conteúdos
1.  [Arquitetura do Projeto](#-arquitetura-do-projeto)
2.  [Cenário 1: A Aplicação Vulnerável](#-cenário-1-a-aplicação-vulnerável)
    *   [Vulnerabilidade A: SQL Injection no Login](#vulnerabilidade-a-sql-injection-no-login)
    *   [Vulnerabilidade B: Controle de Acesso Quebrado](#vulnerabilidade-b-controle-de-acesso-quebrado)
3.  [Cenário 2: A Aplicação Segura (Mitigada)](#-cenário-2-a-aplicação-segura-mitigada)
    *   [Mitigação A: Prevenção de SQL Injection e Hashing de Senhas](#mitigação-a-prevenção-de-sql-injection-e-hashing-de-senhas)
    *   [Mitigação B: Controle de Acesso com JWT](#mitigação-b-controle-de-acesso-com-jwt)
4.  [Apêndice: Como Rodar o Projeto](#-apêndice-como-rodar-o-projeto)

---

## 🏗️ Arquitetura do Projeto

Para este estudo, foram criadas duas versões da mesma aplicação, contidas em duas pastas principais:
*   **`Broken-authentication-before/`**: A versão inicial da aplicação, contendo as falhas de segurança.
*   **`Broken-authentication-after/`**: A versão corrigida, com as mitigações implementadas.

Ambas as versões utilizam a seguinte stack tecnológica:
*   **Backend**: Node.js com Express.js
*   **Banco de Dados**: PostgreSQL, rodando em um container Docker para facilitar a configuração.
*   **Frontend**: HTML, CSS e JavaScript puros, servidos por um servidor web simples (`http-server`).

---

## 💥 Cenário 1: A Aplicação Vulnerável

Nesta primeira fase, a aplicação foi desenvolvida com foco na funcionalidade, mas negligenciando aspectos cruciais de segurança. Isso resultou em duas vulnerabilidades graves.

### Vulnerabilidade A: SQL Injection no Login

A injeção de SQL ocorre quando um atacante consegue inserir e executar comandos SQL maliciosos através de uma entrada de dados da aplicação. Em nosso formulário de login, isso é possível porque a query que valida o usuário é construída por **concatenação de strings**.

**Código Vulnerável (`Broken-authentication-before/backend/index.js`):**
```javascript
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
    console.log('Executing query:', query); // logo para visualizarmos o ataque;

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
```

#### Como Explorar
Um atacante pode fazer login como qualquer usuário sem saber a senha. Por exemplo, para logar como `admin`, ele pode inserir no campo "Usuário":
```
admin' -- 
```
(A palavra "admin", seguida de um apóstrofo, espaço, dois hífens e um espaço)

A query no backend se torna:
`SELECT * FROM users WHERE username = 'admin' -- ' AND password = ''`

O `--` em SQL inicia um comentário, fazendo com que o resto da linha (a verificação da senha) seja ignorado. O banco de dados executa apenas a busca pelo `username = 'admin'`, encontra o usuário e concede o acesso.

### Vulnerabilidade B: Controle de Acesso Quebrado

A aplicação possui uma rota para buscar os dados de um perfil de usuário. No entanto, essa rota não implementa **nenhum tipo de verificação** para saber se quem está pedindo a informação tem permissão para vê-la.

**Código Vulnerável (`Broken-authentication-before/backend/index.js`):**
```javascript
// ROTA PROTEGIDA VULNERÁVEL (SEM VERIFICAÇÃO DE SESSÃO)
// Um atacante pode chamar esta rota diretamente se souber o ID ou username de alguém.
app.get('/profile/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const result = await pool.query('SELECT id, username, email, full_name FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erro no servidor.' });
    }
});
```
#### Como Explorar
Qualquer pessoa, mesmo sem estar logada, pode solicitar os dados de qualquer usuário se souber o seu nome de usuário. Basta acessar a URL `http://localhost:3001/profile/davi` (ou usar o formulário na página de teste) para obter os dados sensíveis do usuário "davi".

---

## 🛡️ Cenário 2: A Aplicação Segura (Mitigada)

Na segunda fase, corrigimos as falhas aplicando três camadas de segurança fundamentais no backend.

### Mitigação A: Prevenção de SQL Injection e Hashing de Senhas

1.  **Parameterized Queries**: A concatenação de strings foi substituída por *queries parametrizadas*. Agora, a entrada do usuário é tratada sempre como dados, e nunca como parte do comando SQL, eliminando o risco de injeção.
2.  **Hashing de Senhas**: As senhas não são mais armazenadas em texto puro. Usamos a biblioteca `bcryptjs` para gerar um "hash" criptográfico de cada senha. Durante o login, comparamos o hash da senha enviada com o hash armazenado, sem nunca expor a senha original.

**Código Seguro (`Broken-authentication-after/backend/index.js`):**
```javascript
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
```

### Mitigação B: Controle de Acesso com JWT

Para garantir que apenas usuários autenticados acessem rotas protegidas, implementamos um sistema de sessão baseado em **JSON Web Tokens (JWT)**.

1.  **Geração de Token**: Após um login bem-sucedido, o servidor gera um token JWT assinado, contendo o ID e o username do usuário. Esse token é enviado ao cliente.
2.  **Middleware de Autenticação**: Foi criado um "guarda" (middleware) que intercepta todas as requisições para rotas protegidas. Ele verifica se a requisição contém um token JWT válido no cabeçalho `Authorization`. Se o token for válido, a requisição prossegue; caso contrário, o acesso é negado com um erro 401 ou 403.

**Código do Middleware (`Broken-authentication-after/backend/authMiddleware.js`):**
```javascript
function authMiddleware(req, res, next) {
  // O token geralmente vem no cabeçalho 'Authorization' no formato "Bearer TOKEN"
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
```

**Rota de Perfil Protegida (`Broken-authentication-after/backend/index.js`):**
```javascript
// A rota agora é protegida pelo nosso "guarda" authMiddleware
app.get('/profile', authMiddleware, async (req, res) => {
  // A identidade do usuário vem do token (req.user), não mais da URL. É confiável.
  const usernameFromToken = req.user.username;
  // ... (busca os dados do usuário do token e os retorna)
});
```
Com isso, a vulnerabilidade de controle de acesso é eliminada. Um usuário só pode ver seus próprios dados, e apenas se estiver autenticado.

---

## 🚀 Apêndice: Como Rodar o Projeto

Siga os passos abaixo para configurar e executar os dois cenários na sua máquina local.

### Pré-requisitos
*   [Node.js](https://nodejs.org/) (versão 14 ou superior)
*   [Docker](https://www.docker.com/products/docker-desktop) e Docker Compose
*   [Git](https://git-scm.com/)

### Passo 1: Clonar o Repositório
```bash
git clone https://github.com/DaviSNascimento/AF_CIBER.git
cd seu-repositorio
```

### Passo 2: Configurar o Banco de Dados (Docker)
Este passo só precisa ser feito uma vez. O comando abaixo irá criar e iniciar um container com o banco de dados PostgreSQL.

```bash
# Navegue para a pasta do backend (pode ser a vulnerável ou a segura)
cd Broken-authentication-before/backend

# Inicie o container do banco de dados em segundo plano
docker-compose up -d
```

### Passo 3: Rodar o Cenário VULNERÁVEL
Você precisará de **dois terminais** abertos.

1.  **Terminal 1 (Backend Vulnerável):**
    ```bash
    # Navegue até a pasta
    cd Broken-authentication-before/backend
    
    # Instale as dependências
    npm install
    
    # Popule o banco de dados
    node db/init.js

    # Inicie o servidor
    node index.js 
    # (Servidor rodando em http://localhost:3001)
    ```

2.  **Terminal 2 (Frontend Vulnerável):**
    ```bash
    # Navegue até a pasta
    cd Broken-authentication-before/frontend

    # Instale um servidor web simples (se ainda não tiver)
    npm install -g http-server

    # Inicie o servidor do frontend
    http-server -p 8080
    # (Acesse a aplicação em http://localhost:8080)
    ```

### Passo 4: Rodar o Cenário SEGURO
**Importante:** Pare os servidores do cenário vulnerável (pressione `CTRL+C` nos dois terminais) antes de iniciar este.

1.  **Terminal 1 (Backend Seguro):**
    ```bash
    # Navegue até a pasta
    cd Broken-authentication-after/backend
    
    # Instale as dependências
    npm install
    
    # Popule o banco com senhas seguras
    node db/init.js

    # Inicie o servidor
    node index.js 
    # (Servidor rodando em http://localhost:3002)
    ```

2.  **Terminal 2 (Frontend Seguro):**
    ```bash
    # Navegue até a pasta
    cd Broken-authentication-after/frontend

    # Inicie o servidor do frontend em uma porta diferente
    http-server -p 8081
    # (Acesse a aplicação em http://localhost:8081)
    ```

---
