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
const processos = [
    { id: 1, imagem: 'processoA.png', nome: 'Processo A', numero: '001', descricao: 'Descrição do Processo A', data: '2023-09-01', tipo: 'departamental', status: "ativo" },
    { id: 2, imagem: 'processoB.png', nome: 'Processo B', numero: '002', descricao: 'Descrição do Processo B', data: '2023-09-10', tipo: 'interdepartamental', status: "ativo" },
    { id: 3, imagem: 'processoC.jpg', nome: 'Processo C', numero: '003', descricao: 'Descrição do Processo C', data: '2023-09-20', tipo: 'departamental', status: "ativo" },
    { id: 4, imagem: 'processoD.jpg', nome: 'Processo D', numero: '004', descricao: 'Descrição do Processo D', data: '2023-09-25', tipo: 'interdepartamental', status: "ativo" },
    { id: 5, imagem: 'processoA.png', nome: 'Processo E', numero: '005', descricao: 'Descrição do Processo E', data: '2023-09-30', tipo: 'departamental', status: "inativo" },
    { id: 6, imagem: 'processoC.jpg', nome: 'Processo F', numero: '006', descricao: 'Descrição do Processo F', data: '2023-10-01', tipo: 'interdepartamental' , status: "inativo" },
    { id: 7, imagem: 'processoB.png', nome: 'Processo G', numero: '007', descricao: 'Descrição do Processo G', data: '2023-10-05', tipo: 'departamental', status: "ativo" },
    { id: 8, imagem: 'processoD.jpg', nome: 'Processo H', numero: '008', descricao: 'Descrição do Processo H', data: '2023-10-10', tipo: 'interdepartamental', status: "ativo" }
];

const cadeiasDeProcessos = [
    { id: 1, nome: 'Cadeia X', processos: [1, 2] },
    { id: 2, nome: 'Cadeia Y', processos: [3, 4] },
    { id: 3, nome: 'Cadeia Z', processos: [5, 6, 7, 8] }
];

const processosPorDepartamento = [
    { nome: 'Financeiro', processos: [
        processos[0], // Processo A
        processos[3], // Processo D
        processos[5]  // Processo F
    ] },
    { nome: 'RH', processos: [
        processos[1], // Processo B
        processos[6], // Processo G
        processos[4]  // Processo E
    ] },
    { nome: 'Vendas', processos: [
        processos[2], // Processo C
        processos[3], // Processo D
        processos[7]  // Processo H
    ] },
    { nome: 'TI', processos: [
        processos[1], // Processo B
        processos[5], // Processo F
        processos[7]  // Processo H
    ] }
];

// Middleware
app.use(cors());
app.use(bodyParser.json());

app.get('/processos', (req, res) => { 
    // Filtra os processos com status "ativo"
    const processosAtivos = processos.filter(processo => processo.status === "ativo");
    res.status(200).json(processosAtivos);
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
    // Mapeia as cadeias e retorna os nomes dos processos ao invés dos seus IDs,
    // filtrando apenas os processos com status "ativo"
    const cadeiasComProcessos = cadeiasDeProcessos.map(cadeia => {
        const processosDaCadeia = cadeia.processos
            .map(idProcesso => processos.find(processo => processo.id === idProcesso))
            .filter(processo => processo.status === "ativo"); // Filtra apenas processos ativos
        return {
            nomeCadeia: cadeia.nome,
            processos: processosDaCadeia
        };
    });

    // Verifica se existem cadeias com processos ativos
    if (cadeiasComProcessos.every(cadeia => cadeia.processos.length === 0)) {
        return res.status(404).json({ message: 'Nenhuma cadeia com processos ativos encontrada.' });
    }

    res.status(200).json(cadeiasComProcessos);
});

// rota para buscar por departamentos
app.get('/processos-por-departamento', (req, res) => {
    // Retorna a lista de processos agrupados por departamento,
    // filtrando apenas os processos com status "ativo"
    const processosPorDepartamentoResponse = processosPorDepartamento.map(departamento => {
        const processosAtivos = departamento.processos.filter(processo => processo.status === "ativo");
        return {
            nomeDepartamento: departamento.nome,
            processos: processosAtivos // Retorna apenas processos ativos
        };
    }).filter(departamento => departamento.processos.length > 0); // Remove departamentos sem processos ativos

    // Verifica se existem departamentos com processos ativos
    if (processosPorDepartamentoResponse.length === 0) {
        return res.status(404).json({ message: 'Nenhum processo ativo encontrado em nenhum departamento.' });
    }

    res.status(200).json(processosPorDepartamentoResponse);
});

// rota de busca por processos interdeparmentais
app.get('/processos-interdepartamentais', (req, res) => {
    // Filtra os processos que são do tipo "interdepartamental" e estão ativos
    const processosInterdepartamentais = processos.filter(processo => 
        processo.tipo === 'interdepartamental' && processo.status === "ativo"
    );

    // Mapeia cada processo interdepartamental para incluir os departamentos associados
    const processosComDepartamentos = processosInterdepartamentais.map(processo => {
        // Encontra todos os departamentos que contêm este processo
        const departamentosAssociados = processosPorDepartamento
            .filter(departamento => departamento.processos.some(p => p.id === processo.id))
            .map(departamento => departamento.nome);

        return {
            ...processo,
            departamentos: departamentosAssociados
        };
    });

    // Verifica se existem processos interdepartamentais
    if (processosComDepartamentos.length === 0) {
        return res.status(404).json({ message: 'Nenhum processo interdepartamental ativo encontrado.' });
    }

    res.status(200).json(processosComDepartamentos);
});


const userList = [];

async function createTestUser() {
    const name = 'Teste User';
    const password = 'Senha123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const permission = 'user';
    const active = "true";

    userList.push({ name, password: hashedPassword, permission, active });

    console.log('Usuário de teste criado:', { name, permission });
}

async function createAdminUser() {
    const name = 'Admin User';
    const password = 'Admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const permission = 'admin';
    const active = "true";

    userList.push({ name, password: hashedPassword, permission, active });

    console.log('Usuário admin criado:', { name, permission });
}

// Criar usuários
(async () => {
    await createTestUser();
    await createAdminUser();
})();

function verifyAdmin(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.permission === 'admin') {
            next(); // Permite continuar para a rota
        } else {
            return res.status(403).json({ message: 'Acesso negado, somente administradores' });
        }
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido' });
    }
}

app.get('/administracao', verifyAdmin, (req, res) => {
    res.status(200).json({ message: 'Bem-vindo, administrador!' });
});

app.put('/desativar', async (req, res) => {
    const { name } = req.body;
    const user = userList.find(user => user.name === name);

    try {
        if (!user) {
            return res.status(404).send('Usuário não encontrado.');
        }

        user.active = "false"; // Supondo que você tenha um campo active no modelo de usuário
        res.send('Usuário desativado com sucesso!');
    } catch (error) {
        res.status(400).send('Erro ao desativar o usuário: ' + error.message);
    }
});

// Rota para registrar um usuário
app.post('/register', async (req, res) => {
    const { name, password, permission } = req.body;

    if (!name || name.length < 3) {
        return res.status(400).json({ message: 'O nome deve ter pelo menos 3 caracteres.' });
    }

    if (password.length < 6 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ message: 'Senha inválida. A senha deve conter pelo menos 6 caracteres, incluindo uma letra maiúscula e um número.' });
    }

    if(permission != "admin" && permission != "user") {
        return res.status(400).json({ message: 'Permissão inválida. A permissão deve ser "admin" ou "user"'})
    }

    const existingUser = userList.find(user => user.name === name);
    if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        userList.push({ name, password: hashedPassword , permission, active: "true" });
        return res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        return res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

// Rota para login e geração de token JWT
app.post('/login', async (req, res) => {
    const { name, password } = req.body;
    const user = userList.find(user => user.name === name); // Use userList aqui

    if (!user) {
        return res.status(400).json({ message: 'Credenciais inválidas' });
    } 
    if (user.active === "false") {
        return res.status(403).json({ message: 'Usuário desativado. Entre em contato com o administrador.' });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign(
                { name: user.name, permission: user.permission }, // Inclui permission no payload
                SECRET_KEY,
                { expiresIn: '1h' }
            );
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

    const user = userList.find(user => user.name === name);
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
