export default async function handler(req, res) {
    // 1. Só aceita POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // 2. Tenta pegar o token do body (suporta JSON ou string pura)
    let { token } = req.body;
    if (!token && typeof req.body === 'string') {
        try { token = JSON.parse(req.body).token; } catch (e) {}
    }

    if (!token) return res.status(400).json({ error: 'Token não fornecido' });

    try {
        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
        };

        // 3. Pega o usuário e força a vinda dos workspaces
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();

        // Checa se o Asana respondeu erro (token vencido, por exemplo)
        if (meData.errors) {
            return res.status(401).json({ message: "Token inválido ou expirado. Faça login de novo." });
        }

        const workspaces = meData.data?.workspaces || meData.workspaces;
        if (!workspaces || workspaces.length === 0) {
            return res.status(404).json({ message: "Nenhum workspace encontrado no seu perfil." });
        }

        // 4. Lógica de 1 dia útil (Pula FDS)
        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];
        let total = 0;

        // 5. Varredura e Reagendamento
        for (const ws of workspaces) {
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
            const tasksJson = await tasksResp.json();
            const tarefas = tasksJson.data || [];

            const updates = tarefas
                .filter(t => !t.completed && t.due_on === hoje)
                .map(t => fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ data: { due_on: novaData } })
                }).then(r => { if(r.ok) total++; }));
            
            await Promise.all(updates);
        }

        return res.status(200).json({ success: true, reagendadas: total });

    } catch (error) {
        return res.status(500).json({ message: "Erro interno: " + error.message });
    }
}
