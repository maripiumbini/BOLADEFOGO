export default async function handler(req, res) {
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    if (req.method === 'POST') {
        const { code } = req.body;

        try {
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
            if (!accessToken) throw new Error("Falha no Token");

            const userResp = await fetch('https://app.asana.com/api/1.0/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userData = await userResp.json();
            const workspaces = userData.data.workspaces;

            // 1. PEGA A DATA DE HOJE (Formato YYYY-MM-DD)
            const hoje = new Date().toISOString().split('T')[0];
            
            // 2. DEFINE AMANHÃ
            const amanhaData = new Date();
            amanhaData.setDate(amanhaData.getDate() + 1);
            const amanhaFormatado = amanhaData.toISOString().split('T')[0];

            let totalReagendadas = 0;

            for (const workspace of workspaces) {
                // Buscamos as tarefas (pedindo o campo 'due_on' para comparar)
                const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?workspace=${workspace.gid}&assignee=me&completed_since=now&opt_fields=due_on,completed`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                const tasksData = await tasksResp.json();
                const tasks = tasksData.data || [];

                for (const task of tasks) {
                    // 🔥 O FILTRO DE MESTRE:
                    // Só entra no trator se a tarefa não estiver concluída 
                    // E se a data de conclusão (due_on) for HOJE ou anterior (atrasada)
                    if (!task.completed && task.due_on && task.due_on <= hoje) {
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
            return res.status(500).json({ error: "Erro", message: error.message });
        }
    }
    res.status(405).send('Método não permitido');
}
