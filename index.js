const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

// Usuários e processos em memória (para testes)
let users = [];
const processos = [
    { id: 1, imagem: 'processoA.png', nome: 'Processo A', numero: '001', descricao: 'Descrição do Processo A', data: '2023-09-01', departamento: 'Financeiro', tipo: 'departamental', status: 'ativo' },
    { id: 2, imagem: 'processoB.png', nome: 'Processo B', numero: '002', descricao: 'Descrição do Processo B', data: '2023-09-10', departamento: ['RH', 'TI'], tipo: 'interdepartamental', status: 'ativo' },
    { id: 3, imagem: 'processoC.jpg', nome: 'Processo C', numero: '003', descricao: 'Descrição do Processo C', data: '2023-09-20', departamento: 'Vendas', tipo: 'departamental', status: 'ativo' },
    { id: 4, imagem: 'processoD.jpg', nome: 'Processo D', numero: '004', descricao: 'Descrição do Processo D', data: '2023-09-25', departamento: ['Financeiro', 'Vendas'], tipo: 'interdepartamental', status: 'ativo' },
    { id: 5, imagem: 'processoA.png', nome: 'Processo E', numero: '005', descricao: 'Descrição do Processo E', data: '2023-09-30', departamento: 'TI', tipo: 'departamental', status: 'inativo' },
    { id: 6, imagem: 'processoC.jpg', nome: 'Processo F', numero: '006', descricao: 'Descrição do Processo F', data: '2023-10-01', departamento: ['TI', 'Financeiro'], tipo: 'interdepartamental', status: 'inativo' },
    { id: 7, imagem: 'processoB.png', nome: 'Processo G', numero: '007', descricao: 'Descrição do Processo G', data: '2023-10-05', departamento: 'RH', tipo: 'departamental', status: 'ativo' },
    { id: 8, imagem: 'processoD.jpg', nome: 'Processo H', numero: '008', descricao: 'Descrição do Processo H', data: '2023-10-10', departamento: ['Vendas', 'TI'], tipo: 'interdepartamental', status: 'ativo' }
];

const cadeiasDeProcessos = [
    { id: 1, nome: 'Cadeia X', processos: [1, 2] },
    { id: 2, nome: 'Cadeia Y', processos: [3, 4] },
    { id: 3, nome: 'Cadeia Z', processos: [5, 6, 7, 8] }
];

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.get('/processos', (req, res) => { 
    res.status(200).json(processos);
});

// Servir imagens da pasta "processos"
app.use('/processos', express.static(path.join(__dirname, 'processos')));

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

app.get('/processos-inativos', (req, res) => {
    const processosInativos = processos.filter(processo => processo.status === 'inativo');
    
    if (processosInativos.length === 0) {
        return res.status(404).json({ message: 'Nenhum processo inativo encontrado.' });
    }

    res.status(200).json(processosInativos);
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

// rota para buscar por departamentos
app.get('/processos-por-departamento/:departamento', (req, res) => {
    const departamento = req.params.departamento.toLowerCase();

    // Filtra os processos que pertencem ao departamento solicitado
    const processosDoDepartamento = processos.filter(processo => {
        if (Array.isArray(processo.departamento)) {
            return processo.departamento.map(dep => dep.toLowerCase()).includes(departamento);
        }
        return processo.departamento.toLowerCase() === departamento;
    });

    if (processosDoDepartamento.length === 0) {
        return res.status(404).send('Nenhum processo encontrado para este departamento.');
    }

    res.status(200).json(processosDoDepartamento);
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

// Rota protegida (exemplo: recuperação de senha)
app.post('/forgot-password', (req, res) => {
    const { name } = req.body;

    const user = users.find(user => user.name === name);
    if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
    } else {
        // Aqui você pode adicionar lógica para envio de e-mail de recuperação
        res.status(200).json({ message: 'Recuperação iniciada. Verifique seu e-mail.' });
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
