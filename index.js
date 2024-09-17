const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

// Usuários e processos em memória (para testes)
let users = [];
const processos = [
    { id: 1, nome: 'Processo A', numero: '001', descricao: 'Descrição do Processo A', data: '2023-09-01' },
    { id: 2, nome: 'Processo B', numero: '002', descricao: 'Descrição do Processo B', data: '2023-09-10' },
    { id: 3, nome: 'Processo C', numero: '003', descricao: 'Descrição do Processo C', data: '2023-09-20' },
    { id: 4, nome: 'Processo D', numero: '004', descricao: 'Descrição do Processo D', data: '2023-09-25' }
];

const cadeiasDeProcessos = [
    { id: 1, nome: 'Cadeia X', processos: [1, 2] },
    { id: 2, nome: 'Cadeia Y', processos: [3, 4] }
];

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.get('/processos', (req, res) => { 
    res.status(200).json(processos);
});

// Rota para buscar processos por nome
app.get('/processos/:nome', async (req, res) => {
    const nome = req.params.nome.toLowerCase()

    const resultados = processos.filter(processo =>
        processo.nome.toLowerCase().includes(nome)
    );

    if(resultados.length === 0) {
        return res.status(404).send('Item não encontrado.')
    }

    res.json(resultados)
});

app.get('/cadeias-com-processos', (req, res) => {
    // Mapeia as cadeias e retorna os nomes dos processos ao invés dos seus IDs
    const cadeiasComProcessos = cadeiasDeProcessos.map(cadeia => {
        const processosDaCadeia = cadeia.processos.map(idProcesso => {
            return processos.find(processo => processo.id === idProcesso);
        });
        return {
            nomeCadeia: cadeia.nome,
            processos: processosDaCadeia
        };
    });

    res.status(200).json(cadeiasComProcessos);
});

// Rota para ver cadeias de processos
app.get('/ver-cadeias', (req, res) => {
    res.json(cadeiasDeProcessos);
});

// Cria um usuário de teste ao iniciar o servidor
async function createTestUser() {
    const name = 'Teste User';
    const password = 'Senha123';

    const hashedPassword = await bcrypt.hash(password, 10);

    users.push({ name, password: hashedPassword });

    console.log('Usuário de teste criado:', { name, password: hashedPassword });
}

createTestUser();

// Rota para registrar um usuário
app.post('/register', async (req, res) => {
    const { name, password } = req.body;
    if (!name || name.length < 3) {
        return res.status(400).json({ message: 'O nome deve ter pelo menos 3 caracteres.' });
    }
    if (password.length < 6 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ message: 'Senha inválida.' });
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

// Rota para login e geração de token JWT
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

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Algo deu errado!' });
});

app.get('/', (req, res) => {
    res.send('Hello World')
})

// Servidor rodando
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
