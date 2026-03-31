export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const { usuarios, token } = req.body;

    try {
        // 1. Descobre todos os seus Workspaces
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meResp.json();
        const workspaces = meData.data.workspaces;

        // 2. LÓGICA DE DATA INTELIGENTE
        const agora = new Date();
        const hoje = agora.toLocaleDateString('en-CA'); // Data de HOJE (YYYY-MM-DD)
        
        const amanhaData = new Date();
        const diaDaSemana = agora.getDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado

        if (diaDaSemana === 5) { 
            // É SEXTA! Pula 3 dias para cair na SEGUNDA
            amanhaData.setDate(agora.getDate() + 3);
        } else if (diaDaSemana === 6) {
            // Se alguém rodar no SÁBADO, pula 2 dias para SEGUNDA
            amanhaData.setDate(agora.getDate() + 2);
        } else {
            // Dias normais: pula 1 dia
            amanhaData.setDate(agora.getDate() + 1);
        }

        const amanhaFormatado = amanhaData.toLocaleDateString('en-CA');

        let totalReagendadas = 0;

        // 3. VARRE TODOS OS WORKSPACES
        for (const ws of workspaces) {
            // 4. VARRE CADA USUÁRIO SELECIONADO NESSE WORKSPACE
            for (const userGid of usuarios) {
                const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=${userGid}&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                const tasksData = await tasksResp.json();
                const tasks = tasksData.data || [];

                for (const task of tasks) {
                    // FILTRO: Não concluída E Data de entrega é EXATAMENTE HOJE
                    if (!task.completed && task.due_on === hoje) {
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
        }

        return res.status(200).json({ success: true, reagendadas: totalReagendadas });

    } catch (error) {
        return res.status(500).json({ error: "Erro", message: error.message });
    }
}
