export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const { usuarios, token } = req.body;

    try {
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meResp.json();
        
        if (!meData.data) throw new Error("Usuário não autenticado.");
        const workspaceGid = meData.data.workspaces[0].gid;

        // Pega a data de HOJE no formato YYYY-MM-DD (Fuso Local)
        const hoje = new Date().toLocaleDateString('en-CA'); 
        
        // Define a data de AMANHÃ
        const amanhaData = new Date();
        amanhaData.setDate(amanhaData.getDate() + 1);
        const amanhaFormatado = amanhaData.toLocaleDateString('en-CA');

        let totalReagendadas = 0;

        for (const userGid of usuarios) {
            // Procura tarefas atribuídas ao usuário no workspace
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=${userGid}&workspace=${workspaceGid}&completed_since=now&opt_fields=due_on,completed,name`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const tasksData = await tasksResp.json();
            const tasks = tasksData.data || [];

            for (const task of tasks) {
                // 🔥 A REGRA DE OURO:
                // 1. Não pode estar concluída (!task.completed)
                // 2. Tem de ter uma data definida (task.due_on)
                // 3. A data tem de ser EXATAMENTE HOJE (=== hoje)
                if (!task.completed && task.due_on && task.due_on === hoje) {
                    
                    await fetch(`https://app.asana.com/api/1.0/tasks/${task.gid}`, {
                        method: 'PUT',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
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
