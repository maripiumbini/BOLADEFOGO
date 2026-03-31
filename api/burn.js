module.exports = async function (req, res) {
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    if (req.method === 'POST') {
        const { code } = req.body;

        try {
            // 1. PEGA A CHAVE (TOKEN)
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

            if (!accessToken) throw new Error("Token não gerado. Verifique o Client Secret na Vercel.");

            // 2. DESCOBRE QUEM É O USUÁRIO (Pra pegar o Workspace)
            const meResp = await fetch('https://app.asana.com/api/1.0/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const meData = await meResp.json();
            const workspaceGid = meData.data.workspaces[0].gid;

            // 3. DEFINE A DATA DE AMANHÃ
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const dataFormatada = amanha.toISOString().split('T')[0];

            // 4. O PENTE FINO: Busca TODAS as tarefas não concluídas do usuário no Workspace
            // Isso é muito mais garantido do que buscar por projeto!
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?workspace=${workspaceGid}&assignee=me&completed_since=now&opt_fields=due_on,completed`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const tasksData = await tasksResp.json();
            const tasks = tasksData.data || [];

            // 5. O LANÇAMENTO REAL (Muda a data de cada uma)
            const promessas = tasks.map(task => {
                if (!task.completed) {
                    return fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({ data: { due_on: dataFormatada } })
                    });
                }
            });

            await Promise.all(promessas);

            return res.status(200).json({ success: true, total: tasks.length });

        } catch (error) {
            console.error("ERRO NO MOTOR:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    res.status(405).send('Método não permitido');
};
