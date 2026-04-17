export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    let { token, code } = req.body;

    // --- PARTE 1: SE RECEBER UM "CODE", TRANSFORMA EM TOKEN ---
    if (code) {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('client_id', '1213884306145874');
            params.append('client_secret', '5686000030118835f8d97607a305943b'); // Seu Secret aqui
            params.append('redirect_uri', req.headers.origin + '/');
            params.append('code', code);

            const tokenResp = await fetch('https://app.asana.com/-/oauth_token', {
                method: 'POST',
                body: params
            });
            const tokenData = await tokenResp.json();
            
            if (tokenData.access_token) {
                return res.status(200).json({ token: tokenData.access_token });
            } else {
                return res.status(400).json({ error: 'Erro ao obter token do Asana' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Falha no servidor de autenticação' });
        }
    }

    // --- PARTE 2: SE RECEBER UM TOKEN, LANÇA A BOLA DE FOGO ---
    if (!token) return res.status(400).json({ error: 'Token não fornecido' });

    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        const meResp = await fetch('https://app.asana.com/api/1.0/users/me?opt_fields=workspaces', { headers });
        const meData = await meResp.json();

        const workspaces = meData.data?.workspaces || meData.workspaces;
        if (!workspaces) return res.status(404).json({ message: "Nenhum workspace encontrado." });

        let d = new Date();
        let pular = (d.getDay() === 5) ? 3 : (d.getDay() === 6 ? 2 : 1);
        d.setDate(d.getDate() + pular);
        const novaData = d.toISOString().split('T')[0];
        const hoje = new Date().toISOString().split('T')[0];
        let total = 0;

        for (const ws of workspaces) {
            const tasksResp = await fetch(`https://app.asana.com/api/1.0/tasks?assignee=me&workspace=${ws.gid}&completed_since=now&opt_fields=due_on,completed`, { headers });
            const tasksJson = await tasksResp.json();
            const tarefas = tasksJson.data || [];

            const updates = tarefas
                .filter(t => !t.completed && t.due_on === hoje)
                .map(t => fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, {
                    method: 'PUT', headers, body: JSON.stringify({ data: { due_on: novaData } })
                }).then(r => { if(r.ok) total++; }));
            await Promise.all(updates);
        }
        return res.status(200).json({ success: true, reagendadas: total });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
