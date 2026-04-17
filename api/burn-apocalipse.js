export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');
    const { token } = req.body;

    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();

        const workspaces = meData.data?.workspaces || meData.workspaces;
        if (!workspaces) throw new Error("Erro de autenticação no Asana.");

        let data = new Date();
        let adicionados = 0;
        while (adicionados < 5) {
            data.setDate(data.getDate() + 1);
            if (data.getDay() !== 0 && data.getDay() !== 6) adicionados++;
        }
        const novaData = data.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];
        let total = 0;

        for (const ws of workspaces) {
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
            const tasksJson = await tasksResp.json();
            const tarefas = tasksJson.data || [];

            const updates = tarefas.filter(t => !t.completed && t.due_on === hoje)
                .map(t => fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                    method: 'PUT', headers, body: JSON.stringify({ data: { due_on: novaData } })
                }).then(() => total++));
            await Promise.all(updates);
        }
        return res.status(200).json({ success: true, reagendadas: total });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
