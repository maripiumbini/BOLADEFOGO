export default async function handler(req, res) {
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    if (req.method === 'POST') {
        const { code } = req.body;

        try {
            // 1. TROCA O CÓDIGO PELO TOKEN
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
            if (!accessToken) throw new Error("Falha ao obter Token: " + JSON.stringify(tokenData));

            // 2. DESCOBRE QUEM É A MARI E EM QUAIS EMPRESAS (WORKSPACES) ELA ESTÁ
            const userResp = await fetch('https://app.asana.com/api/1.0/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userData = await userResp.json();
            const userGid = userData.data.gid;
            const workspaces = userData.data.workspaces; // Lista de todas as empresas que você está

            // 3. DEFINE AMANHÃ
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const amanhaFormatado = amanha.toISOString().split('T')[0];

            let totalReagendadas = 0;

            // 4. VARRE TODOS OS SEUS WORKSPACES ATRÁS DE TAREFAS
            for (const workspace of workspaces) {
                // Busca tarefas incompletas atribuídas a você neste workspace específico
                const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?workspace=${workspace.gid}&assignee=me&completed_since=now&opt_fields=due_on,completed`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                const tasksData = await tasksResp.json();
                const tasks = tasksData.data || [];

                // 5. ATUALIZA AS TAREFAS DESSE WORKSPACE
                for (const task of tasks) {
                    if (!task.completed) {
                        await fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                            method: 'PUT',
                            headers: { 
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json' 
                            },
                            body: JSON.stringify({ data: { due_on: amanhaFormatado } })
                        });
                        totalReagendadas++;
                    }
                }
            }

            return res.status(200).json({ success: true, reagendadas: totalReagendadas });

        } catch (error) {
            return res.status(500).json({ error: "Erro na BOLA DE FOGO", message: error.message });
        }
    }

    res.status(405).send('Método não permitido');
}
