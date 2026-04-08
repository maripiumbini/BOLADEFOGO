export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Método não permitido');

    const { usuarios, token, modo } = req.body;

    try {
        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
        };

        // 1. Pega os dados do usuário com proteção contra erro de resposta
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me', { headers });
        const meData = await meResp.json();

        // VALIDAÇÃO CRÍTICA: Se não vier workspaces, o token deu pau
        if (!meData.data || !meData.data.workspaces) {
            return res.status(401).json({ 
                error: "Não autorizado", 
                message: "O Asana não reconheceu seu login. Tente 'Aquecer' novamente." 
            });
        }

        const workspaces = meData.data.workspaces;

        // 2. LÓGICA DE DATA (Calcula o destino)
        const calcularDataDestino = (dias) => {
            let d = new Date();
            let count = 0;
            while (count < dias) {
                d.setDate(d.getDate() + 1);
                if (d.getDay() !== 0 && d.getDay() !== 6) count++;
            }
            return d.toISOString().split('T')[0];
        };

        const hoje = new Date().toISOString().split('T')[0];
        const novaData = (modo === 'apocalipse') ? calcularDataDestino(5) : calcularDataDestino(1);

        let totalReagendadas = 0;

        // 3. VARREDURA DOS WORKSPACES
        for (const ws of workspaces) {
            const promessas = usuarios.map(async (userGid) => {
                try {
                    const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=${userGid}&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
                    const resJson = await tasksResp.json();
                    const tarefas = resJson.data || [];

                    const updates = tarefas
                        .filter(t => !t.completed && t.due_on === hoje)
                        .map(t => 
                            fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                                method: 'PUT',
                                headers,
                                body: JSON.stringify({ data: { due_on: novaData } })
                            }).then(r => { if(r.ok) totalReagendadas++; })
                        );
                    
                    return Promise.all(updates);
                } catch (e) {
                    console.error("Erro no processamento:", e.message);
                }
            });
            await Promise.all(promessas);
        }

        return res.status(200).json({ success: true, reagendadas: totalReagendadas });

    } catch (error) {
        return res.status(500).json({ error: "Erro Interno", message: error.message });
    }
}
