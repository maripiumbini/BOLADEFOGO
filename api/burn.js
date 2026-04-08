export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');
    const { token } = req.body;

    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        
        // 1. Pega os Workspaces com segurança
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me', { headers });
        const meData = await meResp.json();

        if (!meData.data || !meData.data.workspaces) {
            throw new Error("Não foi possível carregar seus Workspaces. Tente logar novamente.");
        }

        // 2. Lógica de 1 dia útil (Pula FDS)
        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];
        let total = 0;

        // 3. Varre seus workspaces para limpar sua pauta ('me')
        for (const ws of meData.data.workspaces) {
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
            const tasksJson = await tasksResp.json();
            const tarefas = tasksJson.data || [];

            const updates = tarefas
                .filter(t => !t.completed && t.due_on === hoje)
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
