// api/burn.js
export default async function handler(req, res) {
    const { code, client_id, client_secret, redirect_uri } = req.body;

    // 1. Trocar o CODE pelo ACCESS TOKEN (A chave mestra)
    const tokenResponse = await fetch('https://app.asana.com/-/oauth_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: client_id,
            client_secret: client_secret,
            redirect_uri: redirect_uri,
            code: code
        })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. O TRATOR: Buscar todos os projetos
    const projectsResp = await fetch('https://app.asana.com/api/1.0/projects', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const { data: projects } = await projectsResp.json();

    // 3. O LANÇAMENTO: Varre cada projeto e limpa as tarefas
    for (const project of projects) {
        const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?project=${project.gid}&completed_since=now&opt_fields=due_on,completed`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const { data: tasks } = await tasksResp.json();

        for (const task of tasks) {
            // Se a tarefa não está pronta, joga pra amanhã
            if (!task.completed) {
                const amanha = new Date();
                amanha.setDate(amanha.getDate() + 1);
                const dataFormatada = amanha.toISOString().split('T')[0];

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

    res.status(200).json({ success: true, message: "BOLA DE FOGO LANÇADA!" });
}
