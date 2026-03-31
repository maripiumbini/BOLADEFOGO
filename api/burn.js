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

            if (!accessToken) {
                return res.status(401).json({ error: "Falha no Token", details: tokenData });
            }

            // 2. DEFINE AMANHÃ
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            const amanhaFormatado = amanha.toISOString().split('T')[0];

            // 3. BUSCA TAREFAS (Assignee me)
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${tokenData.data?.workspaces?.[0]?.gid || 'me'}&opt_fields=due_on,completed`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const tasksData = await tasksResp.json();
            const tasks = tasksData.data || [];

            let contador = 0;
            const promessas = [];

            // 4. ATUALIZA CADA TAREFA INCOMPLETA
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
