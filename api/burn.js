module.exports = async function (req, res) {
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

            if (!accessToken) throw new Error("Falha no Token");

            // 2. DEFINE AS DATAS
            const hoje = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
            const amanhaData = new Date();
            amanhaData.setDate(amanhaData.getDate() + 1);
            const amanhaFormatado = amanhaData.toISOString().split('T')[0];

            // 3. BUSCA TAREFAS QUE VENCEM HOJE (OU ATRASADAS)
            // Filtramos por: Atribuídas a mim + Incompletas
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=me&completed_since=now&opt_fields=due_on,completed`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const tasksData = await tasksResp.json();
            const tasks = tasksData.data || [];

            let contador = 0;
            const promessas = [];

            for (const task of tasks) {
                // SÓ ENTRA NO TRATOR SE:
                // - A tarefa não estiver concluída
                // - A data de conclusão (due_on) for HOJE ou estiver em branco/atrasada
                if (!task.completed && (task.due_on === hoje || !task.due_on || task.due_on < hoje)) {
                    promessas.push(
                        fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                            method: 'PUT',
                            headers: { 
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json' 
                            },
                            body: JSON.stringify({ data: { due_on: amanhaFormatado } })
                        })
                    );
                    contador++;
                }
            }

            // Executa todas as mudanças de data
            await Promise.all(promessas);

            return res.status(200).json({ success: true, reagendadas: contador });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    res.status(405).send('Método não permitido');
};
