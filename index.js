const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require("multer");
const dataFilePath = './dataAcess.json'

const app = express();
const PORT = 5000;
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(64).toString('hex');

// Usuários e processos em memória (para testes)
const processos = [
    { id: 1, imagem: 'processoA.png', nome: 'Processo A', numero: '1', descricao: 'Descrição do Processo A', data: '2023-09-01', tipo: 'departamental', status: "ativo", categoria: "subprocesso" },
    { id: 2, imagem: 'processoB.png', nome: 'Processo B', numero: '2', descricao: 'Descrição do Processo B', data: '2023-09-10', tipo: 'interdepartamental', status: "ativo", categoria: "processo" },
    { id: 3, imagem: 'processoC.jpg', nome: 'Processo C', numero: '3', descricao: 'Descrição do Processo C', data: '2023-09-20', tipo: 'departamental', status: "ativo", categoria: "subprocesso" },
    { id: 4, imagem: 'processoD.jpg', nome: 'Processo D', numero: '4', descricao: 'Descrição do Processo D', data: '2023-09-25', tipo: 'interdepartamental', status: "ativo", categoria: "processo" },
    { id: 5, imagem: 'processoA.png', nome: 'Processo E', numero: '5', descricao: 'Descrição do Processo E', data: '2023-09-30', tipo: 'departamental', status: "inativo", categoria: "subprocesso" },
    { id: 6, imagem: 'processoC.jpg', nome: 'Processo F', numero: '6', descricao: 'Descrição do Processo F', data: '2023-10-01', tipo: 'interdepartamental', status: "inativo", categoria: "processo" },
    { id: 7, imagem: 'processoB.png', nome: 'Processo G', numero: '7', descricao: 'Descrição do Processo G', data: '2023-10-05', tipo: 'departamental', status: "ativo", categoria: "processo" },
    { id: 8, imagem: 'processoD.jpg', nome: 'Processo H', numero: '8', descricao: 'Descrição do Processo H', data: '2023-10-10', tipo: 'interdepartamental', status: "ativo", categoria: "subprocesso" }
];

const cadeiasDeProcessos = [
    { id: 1, nome: 'Cadeia X', processos: [1, 2] },
    { id: 2, nome: 'Cadeia Y', processos: [3, 4] },
    { id: 3, nome: 'Cadeia Z', processos: [5, 6, 7, 8] }
];

const processosMain = [
    {
        processo: processos[3], 
        subprocessos: [processos[0], processos[4]]
    },
    {
        processo: processos[1], 
        subprocessos: [processos[2], processos[7]]
    },
    {
        processo: processos[6], subprocessos: [] 
    },
    {
        processo: processos[5], subprocessos: []
    }
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

let { userAcess, adminAcess } = (() => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { userAcess: 0, adminAcess: 0 };
    }
})();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuração de armazenamento do multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const destinationPath =
        file.fieldname === "diagrama" ? "./processos" : "./documentos";
      cb(null, destinationPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });
  
  const upload = multer({
    storage: storage,
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
      if (
        (file.fieldname === "diagrama" &&
          ["image/jpeg", "image/png"].includes(file.mimetype)) ||
        (file.fieldname === "documento" &&
          [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.mimetype))
      ) {
        cb(null, true);
      } else {
        cb(new Error("Tipo de arquivo não permitido"));
      }
    },
  });

function validateProcessFields(req, res) {
    const { nome, numero, descricao, categoria, processoMain } = req.body;
    if (!nome || nome.length < 3) {
        return 'O nome deve ter pelo menos 3 caracteres.';
    }
    const nomeExistente = processos.some(p => p.nome === nome);
    if (nomeExistente) {
        return 'Esse nome já existe. Por favor, use outro nome.';
    }
    if (!numero) {
        return 'O número do processo é obrigatório.';
    }
    if (!descricao || descricao.length < 5) {
        return 'A descrição deve ter pelo menos 5 caracteres.';
    }
    if (categoria === 'subprocesso' && !processoMain) {
        return 'O processo main é obrigatório para subprocessos.';
    }
    if (categoria === 'subprocesso' && processoMain) {
        const processoExistente = processos.find(p => p.nome === processoMain);
        if (!processoExistente) {
            return 'O processo main não existe.';
        }
    }
    return null;
}

// Rota para criar um novo processo
app.post('/processos', upload.fields([{ name: "diagrama" }, { name: "documento" }]), (req, res) => {
    const error = validateProcessFields(req, res)
    if(error) return res.status(400).json({ message: error })

    const { nome, numero, descricao, categoria, processoMain, cadeia, departamentos } = req.body;
    const tipoProcesso = departamentos.length > 1 ? 'interdepartamental' : 'departamental';
    const nomeImagem = req.files['diagrama'][0].filename

    // Cria o novo processo
    const novoProcesso = {
        id: processos.length + 1,
        imagem: nomeImagem, // quero que a imagem seja o nome do diagrama do upload
        nome,
        numero,
        descricao,
        data: new Date().toISOString().split('T')[0],
        tipo: tipoProcesso,
        status: "ativo",
        categoria
    };

    // Adiciona o novo processo à lista de processos
    const index = processos.findIndex(proc => proc.nome.localeCompare(novoProcesso.nome) > 0);
if (index === -1) {
    processos.push(novoProcesso); // adiciona ao final se não encontrar nenhum maior
} else {
    processos.splice(index, 0, novoProcesso); // insere no índice correto
}

    // Associa o processo aos departamentos, se necessário
    if (departamentos) {
        for (const dep of departamentos) {
            const departamento = processosPorDepartamento.find(d => d.nome === dep);
            if (!departamento) {
                return res.status(400).json({ message: 'O departamento não existe.' });
            }
            departamento.processos.push(novoProcesso);
        }
    }
    // Lógica para Cadeias de Processos
    if (cadeia) {
        const cadeiaEncontrada = cadeiasDeProcessos.find(c => c.nome === cadeia);
        if (cadeiaEncontrada) {
            cadeiaEncontrada.processos.push(novoProcesso.id);
        } else {
            const novaCadeia = { id: cadeiasDeProcessos.length + 1, nome: cadeia, processos: [novoProcesso.id] };
            cadeiasDeProcessos.push(novaCadeia);
        }
    }

    if (categoria === 'subprocesso' && processoMain) {
        const processoAssociado = processosMain.find(pm => pm.processo.nome === processoMain);
        
        if (!processoAssociado) {
            return res.status(404).json({ message: 'O processo principal não existe.' });
        }
        
        // Adiciona o subprocesso à lista de subprocessos do processo principal
        processoAssociado.subprocessos.push(novoProcesso);
    }

    // Retorna a resposta de sucesso
    res.status(201).json({ message: 'Processo criado com sucesso!', processo: novoProcesso });
});

app.put("/editar-processos", (req, res) => {
    const { currentProcessName, newProcessName, newProcessNumber, newChainName, newProcessDescription, selectedDepartments, newCategoria, newProcessMain } = req.body;

    // Procura o processo que será editado
    const processToEdit = processos.find(processo => processo.nome === currentProcessName);
    if (!processToEdit) {
        console.log("Processo não encontrado");
        return res.status(404).json({ message: "Processo não encontrado." });
    }

    // Atualiza as propriedades do processo
    processToEdit.nome = newProcessName || processToEdit.nome;
    processToEdit.numero = newProcessNumber || processToEdit.numero;
    processToEdit.descricao = newProcessDescription || processToEdit.descricao;
    processToEdit.tipo = selectedDepartments && selectedDepartments.length > 1 ? 'interdepartamental' : 'departamental';
    processToEdit.categoria = newCategoria || processToEdit.categoria;

    console.log("Processo após atualização de campos básicos:", processToEdit);

    // Atualiza associações de departamentos
    if (selectedDepartments) {
        processosPorDepartamento.forEach(dep => {
            dep.processos = dep.processos.filter(p => p.id !== processToEdit.id);
            if (selectedDepartments.includes(dep.nome)) {
                dep.processos.push(processToEdit);
            }
        });
    }

    // Atualiza a cadeia de processos
    if (newChainName) {
        cadeiasDeProcessos.forEach(cadeia => {
            cadeia.processos = cadeia.processos.filter(id => id !== processToEdit.id);
        });

        let cadeiaEncontrada = cadeiasDeProcessos.find(c => c.nome === newChainName);
        if (!cadeiaEncontrada) {
            cadeiaEncontrada = { id: cadeiasDeProcessos.length + 1, nome: newChainName, processos: [] };
            cadeiasDeProcessos.push(cadeiaEncontrada);
        }
        cadeiaEncontrada.processos.push(processToEdit.id);
    }

    // Associa como subprocesso, se necessário
    if (newCategoria === 'subprocesso' && newProcessMain) {
        const mainProcess = processos.find(pm => pm.nome === newProcessMain);
        
        if (!mainProcess) {
            console.log("Processo principal não existe");
            return res.status(404).json({ message: 'O processo principal não existe.' });
        }

        processos.forEach(pm => {
            if (pm.subprocessos) {
                pm.subprocessos = pm.subprocessos.filter(sub => sub.id !== processToEdit.id);
            }
        });

        if (!mainProcess.subprocessos) {
            mainProcess.subprocessos = [];
        }
        mainProcess.subprocessos.push(processToEdit);
    }

    console.log("Processo atualizado:", processToEdit);
    res.status(200).json({ message: "Processo atualizado com sucesso!", processo: processToEdit });
});

// Servir imagens da pasta "processos"
app.use('/processos', express.static(path.join(__dirname, 'processos')));

app.get('/processos', (req, res) => { 
    // Filtra os processos com status "ativo"
    const processosAtivos = processos.filter(processo => processo.status === "ativo" && processo.categoria === "processo");
    
    res.status(200).json(processosAtivos);
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

// Servir imagens da pasta "processos"
app.use('/subprocessos', express.static(path.join(__dirname, 'processos')));

app.get("/subprocessos", (req, res) => {
    const subprocessos = processosMain.flatMap((item) => item.subprocessos);
    res.status(200).json(subprocessos); // Returns an array of all subprocesses
});

app.get('/processos-inativos', (req, res) => {
    const processosInativos = processos.filter(processo => processo.status === 'inativo');
    
    if (processosInativos.length === 0) {
        return res.status(200).json({ message: 'Nenhum processo inativo encontrado.' });
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

    console.log('Usuário de teste criado:', { name, password, permission });
}

async function createAdminUser() {
    const name = 'Admin User';
    const password = 'Admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const permission = 'admin';
    const active = "true";

    userList.push({ name, password: hashedPassword, permission, active });

    console.log('Usuário admin criado:', { name, password, permission });
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

        user.active = "false"; 
        res.send('Usuário desativado com sucesso!');
    } catch (error) {
        res.status(400).send('Erro ao desativar o usuário: ' + error.message);
    }
});

app.put('/desativar-processo', async(req, res) => {
    const { name } = req.body;
    const processo = processos.find(processo => processo.nome === name);

    try {
        if (!processo) {
            return res.status(400).send('Processo não encontrado.');
        }
        
        processo.status = "inativo";
        res.send("Processo desativado com sucesso!")
    } catch (error) {
        res.status(400).send('Erro ao editar o processo: ' + error.message);
    }
});

app.put('/reativar-processo', async(req, res) => {
    const { name } = req.body;
    const processo = processos.find(processo => processo.nome === name);

    try {
        if (!processo) {
            return res.status(400).send('Processo não encontrado.');
        }
        
        processo.status = "ativo";
        res.send("Processo ativado com sucesso!")
    } catch (error) {
        res.status(400).send('Erro ao editar o processo: ' + error.message);
    }
});

app.put('/editar', async (req, res) => {
    const { name, newUserName, newPassword, newPermission } = req.body;
    const user = userList.find(user => user.name === name);

    try {
        if (!user) {
            return res.status(404).send('Usuário não encontrado.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.name = newUserName;
        user.password = hashedPassword;
        user.permission = newPermission;

        res.send('Usuário editado com sucesso!');
        console.log(newUserName, newPassword, newPermission);
    } catch (error) {
        res.status(400).send('Erro ao editar o usuário: ' + error.message);
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

const saveAccessData = () => {
    fs.writeFileSync(dataFilePath, JSON.stringify({ userAcess, adminAcess }), 'utf8');
};

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
            
            if (user.permission === 'user'){
                userAcess += 1;
            } else {
                adminAcess += 1;
            }

            saveAccessData();

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
