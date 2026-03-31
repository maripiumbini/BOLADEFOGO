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

            // 1. DATA DE HOJE E LÓGICA DE FIM DE SEMANA
            const agora = new Date();
            const hoje = agora.toLocaleDateString('en-CA'); 
            
            const amanhaData = new Date();
            const diaDaSemana = agora.getDay(); // 0=Dom, 5=Sex, 6=Sáb

            if (diaDaSemana === 5) { 
                // Sexta -> Pula para Segunda
                amanhaData.setDate(agora.getDate() + 3);
            } else if (diaDaSemana === 6) {
                // Sábado -> Pula para Segunda
                amanhaData.setDate(agora.getDate() + 2);
            } else {
                // Dia normal -> Pula 1 dia
                amanhaData.setDate(agora.getDate() + 1);
            }

            const amanhaFormatado = amanhaData.toLocaleDateString('en-CA');

            let totalReagendadas = 0;

            for (const workspace of workspaces) {
                const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?workspace=${workspace.gid}&assignee=me&completed_since=now&opt_fields=due_on,completed`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                const tasksData = await tasksResp.json();
                const tasks = tasksData.data || [];

                for (const task of tasks) {
                    // FILTRO: Não concluída E (Vencendo hoje ou já atrasada)
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

            return res.status(200).json({ 
                success: true, 
                reagendadas: totalReagendadas,
                token: accessToken 
            });

        } catch (error) {
            return res.status(500).json({ error: "Erro", message: error.message });
        }
    }
    res.status(405).send('Método não permitido');
}
