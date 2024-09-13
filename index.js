const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 5000;

// Usuários em memória (para testes)
let users = [];

// Criando um usuário para testes
const name = 'Teste User';
const password = 'Senha123';

// Criptografa a senha
const hashedPassword = await bcrypt.hash(password, 10);

// Adiciona o usuário ao array
users.push({ name, password: hashedPassword });

console.log('Usuário de teste criado:', { name, password: hashedPassword });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rota para registro de usuários
app.post('/register', async (req, res) => {
    const { name, password } = req.body;

    // Validações para o nome
    if (!name || name.length < 3) {
        return res.status(400).json({ message: 'O nome deve ter pelo menos 3 caracteres.' });
    }

    if (!/^[a-zA-Z\s]+$/.test(name)) {
        return res.status(400).json({ message: 'O nome deve conter apenas letras e espaços.' });
    }

    // Validações para a senha
    if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um caractere maiúsculo.' });
    }

    if (!/\d/.test(password)) {
        return res.status(400).json({ message: 'A senha deve conter pelo menos um número.' });
    }

    // Verifica se o usuário já existe
    const existingUser = users.find(user => user.name === name);
    if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe' });
    }

    // Criptografa a senha e cria um novo usuário
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ name, password: hashedPassword });
        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

// Rota para login
app.post('/login', async (req, res) => {
    const { name, password } = req.body;

    // Verifica se o usuário existe
    const user = users.find(user => user.name === name);
    if (!user) {
        return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    // Verifica a senha
    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.status(200).json({ message: 'Login bem-sucedido' });
        } else {
            res.status(400).json({ message: 'Credenciais inválidas' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Rota para recuperação de senha
app.post('/forgot-password', (req, res) => {
    const { name } = req.body;

    // Verifica se o usuário existe
    const user = users.find(user => user.name === name);
    if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
    } else {
        // NÃO RETORNAR SENHA EM TEXTO SIMPLES, ISSO É APENAS PARA TESTES
        res.status(200).json({ message: 'Senha não retornada por segurança' });
    }
});

// Rota para verificar se o servidor está funcionando
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
