export default async function handler(req, res) {
    const CLIENT_ID = process.env.ASANA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
    const REDIRECT_URI = process.env.REDIRECT_URI;

    if (req.method === 'POST') {
        const { code } = req.body;

        try {
            // 1. PEGA O TOKEN
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
            if (!accessToken) throw new Error("Erro no Token");

            // 2. DESCOBRE SEU ID E O WORKSPACE
            const userResp = await fetch('https://app.asana.com/api/1.0/users/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const userData = await userResp.json();
            const userGid = userData.data.gid;
            const workspaceGid = userData.data.workspaces[0].gid;

            // 3. BUSCA A SUA "USER TASK LIST" (Onde ficam as suas 'Minhas Tarefas')
            const utlResp = await fetch(`https://app.asana.com/api/1.0/user_task_lists?user=${userGid}&workspace=${workspaceGid}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const utlData = await utlResp.json();
            const utlGid = utlData.data[0].gid;

            // 4. PEGA TODAS AS TAREFAS DESSA LISTA (Incompletas)
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/user_task_lists/${utlGid}/tasks?completed_since=now&opt_fields=due_on,completed,name`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const tasksData = await tasksResp.json();
            const tasks = tasksData.data || [];

            // 5. DEFINE AMANHÃ
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const amanhaFormatado = amanha.toISOString().split('T')[0];

            let contador = 0;
            const promessas = [];

            // 6. REAGENDA
            for (const task of tasks) {
                if (!task.completed) {
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

            await Promise.all(promessas);

            return res.status(200).json({ success: true, reagendadas: contador });

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    res.status(405).send('Método não permitido');
}
