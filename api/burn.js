module.exports = async function (req, res) {
    // Puxando os segredos do cofre da Vercel
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    // 1. Quando o site abre e pergunta "Quem é você?" para o Login
    if (req.method === 'GET') {
        return res.status(200).json({ 
            clientId: CLIENT_ID, 
            redirectUri: REDIRECT_URI 
        });
    }

    // 2. Quando o botão é clicado e o código de login chega para o TRATOR
    if (req.method === 'POST') {
        const { code } = req.body;

        try {
            // TROCA O CÓDIGO PELO ACCESS TOKEN (A CHAVE MESTRA)
            const tokenResponse = await fetch('https://app.asana.com/-/oauth_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    code: code
                })
            });

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            if (!accessToken) {
                throw new Error("Não consegui pegar a chave do Asana. Verifique os segredos na Vercel.");
            }

            // LISTA TODOS OS PROJETOS DO USUÁRIO
            const projectsResp = await fetch('https://app.asana.com/api/1.0/projects', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const { data: projects } = await projectsResp.json();

            // DATA DE AMANHÃ (O DESTINO DA BOLA DE FOGO)
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const dataFormatada = amanha.toISOString().split('T')[0];

            // LOOP: ENTRA EM CADA PROJETO
            for (const project of projects) {
                // Pega tarefas incompletas que vencem hoje (ou antes)
                const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?project=${project.gid}&completed_since=now&opt_fields=due_on,completed`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                const { data: tasks } = await tasksResp.json();

                // REAGENDA CADA TAREFA
                for (const task of tasks) {
                    if (!task.completed) {
                        await fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                            method: 'PUT',
                            headers: { 
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json' 
                            },
                            body: JSON.stringify({ data: { due_on: dataFormatada } })
                        });
                    }
                }
            }

            return res.status(200).json({ success: true, message: "BOLA DE FOGO LANÇADA COM SUCESSO!" });

        } catch (error) {
            console.error("ERRO NO LANÇAMENTO:", error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // Se tentarem outra coisa que não seja GET ou POST
    res.status(405).json({ message: 'Método não permitido' });
}
