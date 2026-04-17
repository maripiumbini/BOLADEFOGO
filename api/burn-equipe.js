export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { usuarios, token } = req.body;

    if (!token || !usuarios) return res.status(400).json({ error: 'Dados insuficientes' });

    try {
        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
        };

        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();
        const workspaces = meData.data?.workspaces || meData.workspaces;

        // Lógica de 1 dia útil para a equipe
        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];

        let totalReagendadas = 0;

        for (const ws of workspaces) {
            const promessas = usuarios.map(async (userGid) => {
                try {
                    const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=${userGid}&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
                    const resJson = await tasksResp.json();
                    const tarefas = resJson.data || [];

                    const updates = tarefas
                        .filter(t => !t.completed && t.due_on === hoje)
                        .map(t => fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                            method: 'PUT',
                            headers,
                            body: JSON.stringify({ data: { due_on: novaData } })
                        }).then(r => { if(r.ok) totalReagendadas++; }));
                    
                    return Promise.all(updates);
                } catch (e) { console.error(e); }
            });
            await Promise.all(promessas);
        }

        return res.status(200).json({ success: true, reagendadas: totalReagendadas });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
