const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const SECRET_KEY = crypto.randomBytes(64).toString('hex');

// Usuários em memória (para testes)
let users = [];

// Cria um usuário de teste ao iniciar o servidor
async function createTestUser() {
    const name = 'Teste User';
    const password = 'Senha123';
  
    const hashedPassword = await bcrypt.hash(password, 10);
  
    users.push({ name, password: hashedPassword });
  
    console.log('Usuário de teste criado:', { name, password: hashedPassword });
}

createTestUser();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rota para registro de usuários
app.post('/register', async (req, res) => {
    const { name, password } = req.body;

    // Validações para o nome e a senha
    if (!name || name.length < 3) {
        return res.status(400).json({ message: 'O nome deve ter pelo menos 3 caracteres.' });
    }

    if (!/^[a-zA-Z\s]+$/.test(name)) {
        return res.status(400).json({ message: 'O nome deve conter apenas letras e espaços.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um caractere maiúsculo.' });
    }

    if (!/\d/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um número.' });
    }

    const existingUser = users.find(user => user.name === name);
    if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ name, password: hashedPassword });
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

// Rota para login com geração de token JWT
app.post('/login', async (req, res) => {
    const { name, password } = req.body;

    const user = users.find(user => user.name === name);
    if (!user) {
        return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ name: user.name }, SECRET_KEY, { expiresIn: '1h' });
            res.status(200).json({ message: 'Login bem-sucedido', token });
        } else {
            res.status(400).json({ message: 'Credenciais inválidas' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Middleware para verificar o token JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}

// Rota protegida (exemplo: recuperação de senha)
app.post('/forgot-password', authenticateToken, (req, res) => {
    const { name } = req.body;

    const user = users.find(user => user.name === name);
    if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
    } else {
        res.status(200).json({ message: 'Recuperação de senha iniciada' });
    }
});

// Rota para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
